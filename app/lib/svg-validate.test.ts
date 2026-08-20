import { describe, expect, it } from "vitest";
import {
  MAX_SVG_BYTES,
  buildElementIdReport,
  describeOversize,
  extractElementIds,
  svgByteLength,
  validateSvg,
} from "./svg-validate";

const layout = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-labelledby="layout-title">
  <title id="layout-title">Demo lot</title>
  <style>.spot { fill: #fff; }</style>
  <g id="level-1">
    <rect class="spot" id="spot-a-01" x="0" y="0" width="10" height="10" />
    <rect class="spot" id="spot-a-02" x="12" y="0" width="10" height="10" />
    <rect class="spot" id="spot-a-03" x="24" y="0" width="10" height="10" />
  </g>
</svg>`;

describe("validateSvg", () => {
  it("accepts a well formed layout and returns its element ids", () => {
    const result = validateSvg(layout);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.elementIds).toEqual([
      "layout-title",
      "level-1",
      "spot-a-01",
      "spot-a-02",
      "spot-a-03",
    ]);
  });

  it("rejects a file that is not an SVG document", () => {
    const result = validateSvg("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>");

    expect(result).toMatchObject({ ok: false, code: "not-svg" });
  });

  it("rejects an HTML document that merely mentions svg", () => {
    const result = validateSvg("<html><body><p>svg</p></body></html>");

    expect(result).toMatchObject({ ok: false, code: "not-svg" });
  });

  it("rejects an empty file", () => {
    expect(validateSvg("   \n")).toMatchObject({ ok: false, code: "empty" });
  });

  it("rejects a file above the 2 MB cap without reading it twice", () => {
    const result = validateSvg(layout, { byteLength: MAX_SVG_BYTES + 1 });

    expect(result).toMatchObject({ ok: false, code: "too-large" });
    if (result.ok) return;
    expect(result.message).toContain("2 MB or smaller");
  });

  it("describes an oversized payload only when the cap is exceeded", () => {
    expect(describeOversize(MAX_SVG_BYTES)).toBeNull();
    expect(describeOversize(MAX_SVG_BYTES + 10_000)).toContain("2.01 MB");
  });

  it("rejects an SVG carrying a script element", () => {
    const result = validateSvg(
      layout.replace("<g id=\"level-1\">", "<script>alert(1)</script><g id=\"level-1\">"),
    );

    expect(result).toMatchObject({ ok: false, code: "unsafe-content" });
    if (result.ok) return;
    expect(result.message).toContain("<script>");
  });

  it("rejects inline event handlers", () => {
    const result = validateSvg(layout.replace("id=\"spot-a-01\"", "id=\"spot-a-01\" onload=\"steal()\""));

    expect(result).toMatchObject({ ok: false, code: "unsafe-content" });
  });

  it("rejects foreignObject content", () => {
    const result = validateSvg(
      layout.replace("</svg>", "<foreignObject><body>hi</body></foreignObject></svg>"),
    );

    expect(result).toMatchObject({ ok: false, code: "unsafe-content" });
  });

  it("rejects javascript: references", () => {
    const result = validateSvg(
      layout.replace("</svg>", "<a href=\"javascript:alert(1)\"><rect /></a></svg>"),
    );

    expect(result).toMatchObject({ ok: false, code: "unsafe-content" });
  });

  it("rejects entity declarations", () => {
    const result = validateSvg(
      `<!DOCTYPE svg [<!ENTITY lol "lol">]>${layout.replace(/<\?xml[\s\S]*?\?>/, "")}`,
    );

    expect(result).toMatchObject({ ok: false, code: "unsafe-content" });
  });

  it("ignores markup that only appears inside comments", () => {
    const result = validateSvg(layout.replace("</svg>", "<!-- <script>alert(1)</script> --></svg>"));

    expect(result.ok).toBe(true);
  });
});

describe("extractElementIds", () => {
  it("ignores comments, duplicates and attributes that merely end in id", () => {
    const ids = extractElementIds(
      `<svg><!-- <rect id="ghost" /> --><rect data-id="nope" id="spot-a-01" /><rect id='spot-a-01' /></svg>`,
    );

    expect(ids).toEqual(["spot-a-01"]);
  });
});

describe("svgByteLength", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(svgByteLength("<svg>ñ</svg>")).toBe(13);
  });
});

describe("buildElementIdReport", () => {
  it("counts matched and missing spot ids for a layout missing one known id", () => {
    const result = validateSvg(layout);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const report = buildElementIdReport(result.elementIds, [
      "spot-a-01",
      "spot-a-02",
      "spot-a-03",
      "spot-a-04",
    ]);

    expect(report.matched).toEqual(["spot-a-01", "spot-a-02", "spot-a-03"]);
    expect(report.missing).toEqual(["spot-a-04"]);
    expect(report.unmatched).toEqual(["layout-title", "level-1"]);
  });

  it("skips spots that have no element id yet", () => {
    const report = buildElementIdReport(["spot-a-01"], ["spot-a-01", null, "", "  ", undefined]);

    expect(report).toEqual({ matched: ["spot-a-01"], missing: [], unmatched: [] });
  });
});
