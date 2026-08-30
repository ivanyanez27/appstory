import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StoryShapeSvg } from "./shapeSvg";

describe("Story shape SVG", () => {
  it("renders card text as escaped SVG content", () => {
    const card = createElement(StoryShapeSvg, { kind: "place", props: { w: 220, h: 140, name: "Home <script>", summary: "Main Screen", imageUrl: "https://example.com/private.png" } });
    const svg = renderToStaticMarkup(createElement("svg", null, card));

    expect(svg).toContain("Home &lt;script&gt;");
    expect(svg).toContain("Main Screen");
    expect(svg).not.toContain("private.png");
  });
});
