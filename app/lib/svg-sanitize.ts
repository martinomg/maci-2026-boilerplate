/**
 * Dependency-free SVG sanitizer for layouts uploaded into Directus.
 *
 * A parking layout is rendered inline so its shapes can be styled and made
 * interactive, which means the file is trusted with the same origin as the
 * app. The file itself is operator-supplied, so it is scrubbed first.
 *
 * The implementation is a small tag scanner rather than a regex sweep: regexes
 * over `<[^>]*>` break on `>` inside quoted attribute values, which is exactly
 * where a payload hides. A DOM based sanitizer would need either `jsdom` or
 * `DOMPurify` plus a DOM shim to run in a React Server Component and in the
 * `node` vitest environment; the scanner keeps the dependency count at zero
 * and is fully unit testable.
 *
 * The policy is an allowlist for anything that can execute or reach out of the
 * document:
 *
 * - blocked elements are dropped together with their subtree;
 * - every `on*` attribute is dropped;
 * - link-ish attributes keep only same-document `#fragment` targets and inline
 *   `data:image/*` payloads, so no external reference survives;
 * - any value carrying a `javascript:` style scheme is dropped, including
 *   entity-encoded and whitespace-obfuscated spellings;
 * - CSS (both `<style>` text and `style` attributes) loses `@import`,
 *   `expression()` and every non-fragment `url()`.
 */

/** Elements dropped with their entire subtree. */
const BLOCKED_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "applet",
  "frame",
  "frameset",
  "link",
  "meta",
  "base",
  "handler",
  "audio",
  "video",
  "animate",
  "animatemotion",
  "animatetransform",
  "set",
]);

/** Attributes that may reference another document. */
const LINK_ATTRIBUTES = new Set([
  "href",
  "xlink:href",
  "src",
  "xlink:src",
  "xlink:base",
  "action",
  "formaction",
  "data",
  "poster",
  "from",
  "to",
  "by",
  "values",
  "attributename",
  "attributetype",
  "begin",
  "end",
]);

/** Drawable elements: only these can stand for a parking spot. */
export const SVG_SHAPE_TAGS = new Set([
  "rect",
  "circle",
  "ellipse",
  "polygon",
  "polyline",
  "path",
  "line",
]);

/** Inline payloads allowed in a link attribute. */
const SAFE_DATA_URI = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;

/** A same-document reference such as `#spot-a-01`. */
const FRAGMENT_REFERENCE = /^#[^\s"'<>]*$/;

const DANGEROUS_SCHEME = /(?:javascript|vbscript|livescript|mocha|data(?!:image\/(?:png|jpe?g|gif|webp|avif);base64,)):/i;

export type SvgElementRef = {
  /** The element's `id` attribute, as it survives sanitization. */
  id: string;
  /** Lowercase tag name that carries the id. */
  tag: string;
};

export type SanitizedSvg = {
  /** The scrubbed markup, safe to inline. */
  markup: string;
  /** False when the input contains no `<svg>` root at all. */
  rootFound: boolean;
  /** Lowercase names of elements that were dropped, in document order. */
  removedElements: string[];
  /** Lowercase names of attributes that were dropped, in document order. */
  removedAttributes: string[];
};

type ParsedAttribute = {
  rawName: string;
  name: string;
  value: string | null;
  quote: '"' | "'" | "";
};

type ParsedTag = {
  rawName: string;
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attributes: ParsedAttribute[];
  end: number;
};

const NAME_START = /[A-Za-z_]/;
const NAME_CHAR = /[A-Za-z0-9:._\-]/;
const WHITESPACE = /\s/;

/**
 * Decodes numeric and a few named entities and strips control characters so
 * `java&#115;cript&colon;` and `java\tscript:` are compared as `javascript:`.
 */
function normalizeValue(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_match, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "")
    .replace(/&newline;/gi, "")
    // Control characters and stray whitespace hidden inside a scheme.
    .replace(/[\u0000-\u0020\u007f-\u00a0]/g, "");
}

function parseTag(input: string, start: number): ParsedTag | null {
  let index = start + 1;
  const closing = input[index] === "/";
  if (closing) index += 1;
  if (!NAME_START.test(input[index] ?? "")) return null;

  const nameStart = index;
  while (index < input.length && NAME_CHAR.test(input[index])) index += 1;
  const rawName = input.slice(nameStart, index);

  const attributes: ParsedAttribute[] = [];
  let selfClosing = false;

  while (index < input.length) {
    while (index < input.length && WHITESPACE.test(input[index])) index += 1;
    if (index >= input.length) break;

    if (input[index] === ">") {
      index += 1;
      break;
    }
    if (input.startsWith("/>", index)) {
      selfClosing = true;
      index += 2;
      break;
    }
    if (input[index] === "/") {
      index += 1;
      continue;
    }

    const attrStart = index;
    while (
      index < input.length &&
      !WHITESPACE.test(input[index]) &&
      input[index] !== "=" &&
      input[index] !== ">" &&
      !input.startsWith("/>", index)
    ) {
      index += 1;
    }
    const attrName = input.slice(attrStart, index);
    if (!attrName) {
      index += 1;
      continue;
    }

    while (index < input.length && WHITESPACE.test(input[index])) index += 1;

    let value: string | null = null;
    let quote: '"' | "'" | "" = "";
    if (input[index] === "=") {
      index += 1;
      while (index < input.length && WHITESPACE.test(input[index])) index += 1;
      const char = input[index];
      if (char === '"' || char === "'") {
        quote = char;
        const valueStart = index + 1;
        const valueEnd = input.indexOf(char, valueStart);
        if (valueEnd === -1) {
          value = input.slice(valueStart);
          index = input.length;
        } else {
          value = input.slice(valueStart, valueEnd);
          index = valueEnd + 1;
        }
      } else {
        const valueStart = index;
        while (
          index < input.length &&
          !WHITESPACE.test(input[index]) &&
          input[index] !== ">"
        ) {
          index += 1;
        }
        value = input.slice(valueStart, index);
      }
    }

    attributes.push({
      rawName: attrName,
      name: attrName.toLowerCase(),
      value,
      quote,
    });
  }

  return {
    rawName,
    name: rawName.toLowerCase(),
    closing,
    selfClosing,
    attributes,
    end: index,
  };
}

/** Escapes the characters that could break out of an attribute value. */
function escapeAttributeValue(value: string): string {
  return value.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Strips executable and external constructs from a CSS fragment. Used for both
 * `<style>` text and `style` attributes.
 */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;{}]*(?:;|(?=\}))/gi, "")
    .replace(/@charset[^;]*;/gi, "")
    .replace(/expression\s*\((?:[^()]|\([^()]*\))*\)/gi, "")
    .replace(/behavior\s*:[^;}]*/gi, "")
    .replace(/-moz-binding\s*:[^;}]*/gi, "")
    .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (match, _quote, target: string) => {
      const normalized = normalizeValue(target);
      return FRAGMENT_REFERENCE.test(normalized) ? match : "none";
    });
}

function isSafeLinkValue(value: string): boolean {
  const normalized = normalizeValue(value);
  if (normalized === "") return true;
  if (FRAGMENT_REFERENCE.test(normalized)) return true;
  return SAFE_DATA_URI.test(value.trim());
}

/**
 * Decides what happens to one attribute.
 * Returns the value to emit, or `null` when the attribute must be dropped.
 */
function sanitizeAttribute(attribute: ParsedAttribute): string | null {
  const { name, value } = attribute;

  if (name.startsWith("on")) return null;
  if (name === "style") {
    const cleaned = sanitizeCss(value ?? "").trim();
    return cleaned === "" ? null : cleaned;
  }
  if (value === null) return null;

  if (LINK_ATTRIBUTES.has(name)) {
    return isSafeLinkValue(value) ? value : null;
  }
  if (DANGEROUS_SCHEME.test(normalizeValue(value))) return null;
  if (/url\s*\(/i.test(value)) {
    return sanitizeCss(value);
  }
  return value;
}

/**
 * Scrubs an SVG document so it can be inlined into the page.
 *
 * The result is markup only; callers decide how to render it. Diagnostics list
 * what was removed so a viewer can surface "this file carried a script" rather
 * than silently swallowing it.
 */
export function sanitizeSvg(input: string): SanitizedSvg {
  const removedElements: string[] = [];
  const removedAttributes: string[] = [];
  const out: string[] = [];

  if (typeof input !== "string" || input.trim() === "") {
    return { markup: "", rootFound: false, removedElements, removedAttributes };
  }

  let rootFound = false;
  let index = 0;
  let skipName = "";
  let skipDepth = 0;

  const emit = (chunk: string) => {
    if (skipDepth === 0) out.push(chunk);
  };

  while (index < input.length) {
    const next = input.indexOf("<", index);
    if (next === -1) {
      emit(input.slice(index));
      break;
    }
    emit(input.slice(index, next));

    if (input.startsWith("<!--", next)) {
      const end = input.indexOf("-->", next + 4);
      index = end === -1 ? input.length : end + 3;
      continue;
    }
    if (input.startsWith("<![CDATA[", next)) {
      const end = input.indexOf("]]>", next + 9);
      index = end === -1 ? input.length : end + 3;
      continue;
    }
    if (input.startsWith("<!", next) || input.startsWith("<?", next)) {
      const end = input.indexOf(">", next);
      index = end === -1 ? input.length : end + 1;
      continue;
    }

    const tag = parseTag(input, next);
    if (!tag) {
      emit("&lt;");
      index = next + 1;
      continue;
    }
    index = tag.end;

    if (skipDepth > 0) {
      if (tag.name === skipName) {
        if (tag.closing) skipDepth -= 1;
        else if (!tag.selfClosing) skipDepth += 1;
        if (skipDepth === 0) skipName = "";
      }
      continue;
    }

    if (BLOCKED_ELEMENTS.has(tag.name)) {
      removedElements.push(tag.name);
      if (!tag.closing && !tag.selfClosing) {
        skipName = tag.name;
        skipDepth = 1;
      }
      continue;
    }

    if (tag.closing) {
      emit(`</${tag.rawName}>`);
      continue;
    }

    if (tag.name === "svg") rootFound = true;

    const parts: string[] = [tag.rawName];
    for (const attribute of tag.attributes) {
      const sanitized = sanitizeAttribute(attribute);
      if (sanitized === null) {
        removedAttributes.push(attribute.name);
        continue;
      }
      parts.push(`${attribute.rawName}="${escapeAttributeValue(sanitized)}"`);
    }
    emit(`<${parts.join(" ")}${tag.selfClosing ? " />" : ">"}`);

    // `<style>` content is CSS, not markup: scrub it before it is emitted.
    if (tag.name === "style" && !tag.selfClosing) {
      const closeIndex = input.toLowerCase().indexOf("</style", index);
      const end = closeIndex === -1 ? input.length : closeIndex;
      emit(sanitizeCss(input.slice(index, end)));
      index = end;
    }
  }

  return {
    markup: rootFound ? out.join("").trim() : "",
    rootFound,
    removedElements,
    removedAttributes,
  };
}

/**
 * Collects the `id` of every element in already-sanitized markup, with the tag
 * that carries it, so the caller can decide which ids may represent a spot.
 */
export function collectSvgElementIds(markup: string): SvgElementRef[] {
  const refs: SvgElementRef[] = [];
  const seen = new Set<string>();
  let index = 0;

  while (index < markup.length) {
    const next = markup.indexOf("<", index);
    if (next === -1) break;
    const tag = parseTag(markup, next);
    if (!tag) {
      index = next + 1;
      continue;
    }
    index = tag.end;
    if (tag.closing) continue;

    const id = tag.attributes.find((attribute) => attribute.name === "id")?.value;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    refs.push({ id, tag: tag.name });
  }

  return refs;
}

/** Ids of drawable elements only — the ones that can map to a parking spot. */
export function collectSvgShapeIds(markup: string): string[] {
  return collectSvgElementIds(markup)
    .filter((ref) => SVG_SHAPE_TAGS.has(ref.tag))
    .map((ref) => ref.id);
}
