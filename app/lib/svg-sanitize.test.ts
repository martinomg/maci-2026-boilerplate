import { describe, expect, it } from "vitest";
import {
  collectSvgElementIds,
  collectSvgShapeIds,
  sanitizeCss,
  sanitizeSvg,
} from "./svg-sanitize";

const MALICIOUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- a comment with <script>alert('comment')</script> inside -->
  <script>alert('boom')</script>
  <SCRIPT type="text/javascript">alert('case')</SCRIPT>
  <foreignObject width="100" height="100">
    <body xmlns="http://www.w3.org/1999/xhtml"><iframe src="https://evil.test"></iframe></body>
  </foreignObject>
  <rect id="spot-a-01" x="0" y="0" width="10" height="10" onclick="alert('click')" onmouseover="alert('hover')" fill="#fff" />
  <a href="javascript:alert('link')"><rect id="spot-a-02" x="20" y="0" width="10" height="10" /></a>
  <a href="java&#115;cript:alert('encoded')"><text>encoded</text></a>
  <image id="banner" href="https://evil.test/pixel.png" width="10" height="10" />
  <use href="#spot-a-01" />
  <rect id="spot-a-03" style="fill: url(https://evil.test/x.svg#f); background: expression(alert(1))" width="10" height="10" />
  <style>
    @import url("https://evil.test/theme.css");
    .spot { fill: #fafaf9; }
    .brand { background-image: url(https://evil.test/bg.png); }
  </style>
  <g id="row-a"><rect id="spot-a-04" width="10" height="10" /></g>
</svg>`;

describe("sanitizeSvg", () => {
  const result = sanitizeSvg(MALICIOUS_SVG);

  it("keeps the svg root and the drawable shapes", () => {
    expect(result.rootFound).toBe(true);
    expect(result.markup).toContain("<svg");
    expect(result.markup).toContain('id="spot-a-01"');
    expect(result.markup).toContain('id="spot-a-04"');
  });

  it("strips script elements and their content, whatever the casing", () => {
    expect(result.markup).not.toMatch(/<script/i);
    expect(result.markup).not.toContain("alert('boom')");
    expect(result.markup).not.toContain("alert('case')");
    expect(result.removedElements).toContain("script");
  });

  it("strips foreignObject together with its subtree", () => {
    expect(result.markup).not.toMatch(/foreignobject/i);
    expect(result.markup).not.toMatch(/<iframe/i);
    expect(result.removedElements).toContain("foreignobject");
  });

  it("strips every event handler attribute", () => {
    expect(result.markup).not.toMatch(/\son[a-z]+=/i);
    expect(result.removedAttributes).toContain("onclick");
    expect(result.removedAttributes).toContain("onmouseover");
  });

  it("drops javascript: hrefs, including entity-encoded ones", () => {
    expect(result.markup).not.toMatch(/javascript/i);
    expect(result.markup).not.toContain("&#115;");
  });

  it("drops external references but keeps same-document fragments", () => {
    expect(result.markup).not.toContain("evil.test");
    expect(result.markup).toContain('href="#spot-a-01"');
  });

  it("scrubs css in both style elements and style attributes", () => {
    expect(result.markup).not.toContain("@import");
    expect(result.markup).not.toMatch(/expression\s*\(/i);
    expect(result.markup).toContain(".spot { fill: #fafaf9; }");
    expect(result.markup).toContain("background-image: none;");
    expect(result.markup).toContain('style="fill: none; background:"');
  });

  it("does not comment out a payload, it removes it", () => {
    expect(result.markup).not.toContain("<!--");
  });
});

describe("sanitizeSvg edge cases", () => {
  it("survives a > inside a quoted attribute value", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><rect id="spot-a-01" data-note="width > height" onclick="x()" /></svg>`,
    );
    expect(result.markup).toContain('id="spot-a-01"');
    expect(result.markup).not.toContain("onclick");
    expect(result.markup).toContain("width &gt; height");
  });

  it("removes a script nested inside a group", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><g id="row-a"><script><g>alert(1)</g></script><rect id="spot-a-01" /></g></svg>`,
    );
    expect(result.markup).not.toContain("alert(1)");
    expect(result.markup).toContain('id="spot-a-01"');
    expect(result.markup).toContain('id="row-a"');
  });

  it("removes animation elements that can rewrite attributes", () => {
    const result = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><a><set attributeName="href" to="javascript:alert(1)" /><rect id="spot-a-01" /></a></svg>`,
    );
    expect(result.markup).not.toMatch(/<set/i);
    expect(result.markup).not.toMatch(/javascript/i);
    expect(result.removedElements).toContain("set");
  });

  it("keeps an inline data image but drops a remote one", () => {
    const inline = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,iVBORw0KGgo=" /></svg>`,
    );
    expect(inline.markup).toContain("data:image/png;base64");

    const remote = sanitizeSvg(
      `<svg xmlns="http://www.w3.org/2000/svg"><image href="//evil.test/x.png" /></svg>`,
    );
    expect(remote.markup).not.toContain("evil.test");
  });

  it("reports a missing svg root instead of emitting fragments", () => {
    const result = sanitizeSvg("<div>not an svg</div>");
    expect(result.rootFound).toBe(false);
    expect(result.markup).toBe("");
  });

  it("treats empty input as empty output", () => {
    expect(sanitizeSvg("   ")).toMatchObject({ markup: "", rootFound: false });
  });
});

describe("sanitizeCss", () => {
  it("keeps fragment urls and neutralizes the rest", () => {
    expect(sanitizeCss("fill: url(#hatch)")).toBe("fill: url(#hatch)");
    expect(sanitizeCss("fill: url('https://evil.test/a.svg#x')")).toBe("fill: none");
    expect(sanitizeCss("@import 'x.css'; .a { color: red }")).toContain(".a { color: red }");
  });
});

describe("collectSvgElementIds", () => {
  const markup = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg"><title id="layout-title">t</title><g id="row-a"><rect id="spot-a-01" /><rect id="spot-a-02" /><text id="label-a-01">A01</text></g></svg>`,
  ).markup;

  it("lists every id with the tag carrying it", () => {
    expect(collectSvgElementIds(markup)).toEqual([
      { id: "layout-title", tag: "title" },
      { id: "row-a", tag: "g" },
      { id: "spot-a-01", tag: "rect" },
      { id: "spot-a-02", tag: "rect" },
      { id: "label-a-01", tag: "text" },
    ]);
  });

  it("keeps only drawable ids as spot candidates", () => {
    expect(collectSvgShapeIds(markup)).toEqual(["spot-a-01", "spot-a-02"]);
  });
});
