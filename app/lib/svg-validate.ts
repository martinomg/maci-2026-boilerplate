/**
 * Server-side validation for uploaded parking layout SVGs.
 *
 * The upload route is the only thing standing between an arbitrary file and
 * Directus, so every rejection reason lives here and is unit tested. The
 * checks are deliberately string based: the file is never parsed by a DOM or
 * an XML parser that could resolve entities or execute anything.
 */

/** Maximum accepted payload for a layout file. */
export const MAX_SVG_BYTES = 2 * 1024 * 1024;

export type SvgRejectionCode = "empty" | "too-large" | "not-svg" | "unsafe-content";

export type SvgValidationResult =
  | { ok: true; elementIds: string[] }
  | { ok: false; code: SvgRejectionCode; message: string };

export type ElementIdReport = {
  /** Spot element ids that exist in the uploaded SVG. */
  matched: string[];
  /** Spot element ids the uploaded SVG does not define. */
  missing: string[];
  /** Ids present in the SVG that no parking spot claims (decoration, groups). */
  unmatched: string[];
};

type UnsafePattern = { pattern: RegExp; message: string };

const UNSAFE_PATTERNS: UnsafePattern[] = [
  {
    pattern: /<\s*script\b/i,
    message: "The SVG contains a <script> element. Remove the script and upload it again.",
  },
  {
    pattern: /<\s*foreignObject\b/i,
    message:
      "The SVG contains a <foreignObject> element, which can embed arbitrary HTML. Remove it and upload it again.",
  },
  {
    pattern: /<\s*(iframe|embed|object)\b/i,
    message: "The SVG embeds external content (<iframe>, <embed> or <object>). Remove it and upload it again.",
  },
  {
    pattern: /\son[a-z]+\s*=/i,
    message: "The SVG contains inline event handlers (on* attributes). Remove them and upload it again.",
  },
  {
    pattern: /javascript\s*:/i,
    message: "The SVG contains a javascript: reference. Remove it and upload it again.",
  },
  {
    pattern: /<!ENTITY\b/i,
    message: "The SVG declares XML entities, which are not accepted. Export a plain SVG and upload it again.",
  },
];

const ID_ATTRIBUTE = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Byte length of the document, so the size cap matches what Directus stores. */
export function svgByteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}

/** Removes comments and the XML prolog so checks never trip on inert text. */
function stripInertMarkup(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?xml[\s\S]*?\?>/gi, "");
}

/** Element ids declared in the document, in order and without duplicates. */
export function extractElementIds(content: string): string[] {
  const source = stripInertMarkup(content);
  const ids = new Set<string>();
  for (const match of source.matchAll(ID_ATTRIBUTE)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (value.length > 0) ids.add(value);
  }
  return [...ids];
}

/**
 * Validates an uploaded layout before anything is sent to Directus.
 *
 * `byteLength` lets the caller pass the real upload size instead of paying for
 * a second encode of the document.
 */
export function validateSvg(
  content: string,
  options: { byteLength?: number } = {},
): SvgValidationResult {
  const size = options.byteLength ?? svgByteLength(content);
  const oversize = describeOversize(size);

  if (oversize) {
    return { ok: false, code: "too-large", message: oversize };
  }

  if (content.trim().length === 0) {
    return { ok: false, code: "empty", message: "The file is empty." };
  }

  const source = stripInertMarkup(content);
  const withoutDoctype = source.replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?[^>]*>/i, "").trim();

  if (!/^<svg[\s>]/i.test(withoutDoctype)) {
    return {
      ok: false,
      code: "not-svg",
      message: "The file is not an SVG document. Its root element must be <svg>.",
    };
  }

  if (!/<\/\s*svg\s*>/i.test(withoutDoctype)) {
    return {
      ok: false,
      code: "not-svg",
      message: "The SVG document is incomplete: no closing </svg> tag was found.",
    };
  }

  for (const { pattern, message } of UNSAFE_PATTERNS) {
    if (pattern.test(source)) {
      return { ok: false, code: "unsafe-content", message };
    }
  }

  return { ok: true, elementIds: extractElementIds(content) };
}

/** Compares the ids in an uploaded layout against the lot's spot element ids. */
export function buildElementIdReport(
  svgElementIds: readonly string[],
  spotElementIds: readonly (string | null | undefined)[],
): ElementIdReport {
  const svgIds = new Set(svgElementIds.map((id) => id.trim()).filter(Boolean));
  const spotIds = [
    ...new Set(
      spotElementIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    ),
  ];

  const matched = spotIds.filter((id) => svgIds.has(id));
  const missing = spotIds.filter((id) => !svgIds.has(id));
  const spotIdSet = new Set(spotIds);
  const unmatched = [...svgIds].filter((id) => !spotIdSet.has(id));

  return { matched, missing, unmatched };
}

/**
 * Message for a payload above the cap, or `null` when the size is acceptable.
 *
 * The upload route calls this with the declared upload size so an oversized
 * file is refused before its bytes are read into memory.
 */
export function describeOversize(byteLength: number): string | null {
  if (byteLength <= MAX_SVG_BYTES) return null;
  return `The file is ${formatBytes(byteLength)}. Layout files must be ${formatBytes(MAX_SVG_BYTES)} or smaller.`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${trimZeros(bytes / 1024)} KB`;
  return `${trimZeros(bytes / (1024 * 1024))} MB`;
}

function trimZeros(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}
