import { describe, expect, it } from "vitest";
import { addCard, emptyWorld } from "./world";
import { ADD_TOOL_NAMES, TOOLS, runTool } from "./tools";

function worldWith(name: string) {
  const r = addCard(emptyWorld(), { type: "character", name });
  if (!r.ok) throw new Error("setup");
  return r;
}

describe("runTool", () => {
  it("does not mutate when the signal is aborted", () => {
    const { world, id } = worldWith("Lyra");
    const out = runTool("delete_element", world, { id }, { aborted: true });
    expect(out.result).toEqual({ ok: false, error: "cancelled" });
    expect(out.world.cards).toHaveLength(1);
  });

  it("get_world_state returns a compact index with selectedIds", () => {
    const { world, id } = worldWith("Lyra");
    const out = runTool("get_world_state", world, {}, { selectedIds: [id] });
    expect(out.result.ok).toBe(true);
    if (!out.result.ok) return;
    expect(out.result.selectedIds).toEqual([id]);
    expect(out.result.cardCount).toBe(1);
    expect(JSON.stringify(out.result).length).toBeLessThanOrEqual(1500);
  });

  it("inspect_element returns the summary", () => {
    const added = addCard(emptyWorld(), {
      type: "character",
      name: "Lyra",
      summary: "Afraid of the dark",
    });
    if (!added.ok) throw new Error("setup");
    const out = runTool("inspect_element", added.world, { id: added.id });
    expect(out.result.ok).toBe(true);
    if (!out.result.ok) return;
    expect(out.result.card).toMatchObject({
      name: "Lyra",
      summary: "Afraid of the dark",
    });
  });

  it("add_character returns a new id and mutates the world", () => {
    const out = runTool(emptyWorld() && "add_character", emptyWorld(), {
      name: "Old Ranger",
      summary: "Knows the woods",
    });
    expect(out.result.ok).toBe(true);
    if (!out.result.ok) return;
    expect(out.world.cards[0].name).toBe("Old Ranger");
    expect(out.result.id).toBe(out.world.cards[0].id);
  });

  it("add_note maps text to the card name", () => {
    const out = runTool("add_note", emptyWorld(), { text: "She is afraid of the dark." });
    expect(out.result.ok).toBe(true);
    expect(out.world.cards[0]?.type).toBe("note");
    expect(out.world.cards[0]?.name).toBe("She is afraid of the dark.");
  });

  it("connect_elements and delete_element work", () => {
    const a = addCard(emptyWorld(), { type: "character", name: "A" });
    if (!a.ok) throw new Error("setup");
    const b = addCard(a.world, { type: "place", name: "B" });
    if (!b.ok) throw new Error("setup");
    const linked = runTool("connect_elements", b.world, {
      fromId: a.id,
      toId: b.id,
      label: "enters",
    });
    expect(linked.result.ok).toBe(true);
    expect(linked.world.links).toHaveLength(1);
    const gone = runTool("delete_element", linked.world, { id: a.id });
    expect(gone.result.ok).toBe(true);
    expect(gone.world.cards).toHaveLength(1);
    expect(gone.world.links).toHaveLength(0);
  });

  it("returns unknown id errors without mutating", () => {
    const w = emptyWorld();
    const out = runTool("focus_element", w, { id: "character_deadbeef" });
    expect(out.result).toEqual({
      ok: false,
      error: "unknown id: character_deadbeef",
    });
    expect(out.world).toBe(w);
  });

  it("unknown tool name is an error", () => {
    const out = runTool("explode", emptyWorld(), {});
    expect(out.result.ok).toBe(false);
  });
});

describe("TOOLS catalog", () => {
  it("exports 12 tools with unique names", () => {
    expect(TOOLS).toHaveLength(12);
    expect(new Set(TOOLS.map((t) => t.name)).size).toBe(12);
  });

  it("marks read-only tools and lists add-tools", () => {
    const read = TOOLS.filter((t) => t.annotations?.readOnlyHint).map((t) => t.name);
    expect(read.sort()).toEqual(
      ["focus_element", "get_world_state", "inspect_element"].sort(),
    );
    expect(ADD_TOOL_NAMES).toEqual([
      "add_character",
      "add_place",
      "add_plot_point",
      "add_note",
      "add_region",
    ]);
  });
});
