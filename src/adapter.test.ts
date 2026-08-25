import { describe, expect, it } from "vitest";
import { shapeIdFor, worldIdFromShapeId } from "./adapter";

describe("adapter ids", () => {
  it("round-trips a card id through a tldraw shape id", () => {
    const id = "character_ab12cd34";
    expect(shapeIdFor(id)).toBe("shape:character_ab12cd34");
    expect(worldIdFromShapeId(shapeIdFor(id))).toBe(id);
  });
});
