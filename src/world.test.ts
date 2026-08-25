import { describe, expect, it } from "vitest";
import {
  MAX_CARDS,
  emptyWorld,
  addCard,
  setCardImage,
  deleteElement,
  connect,
  summarizeWorld,
  inspectElement,
} from "./world";

describe("world", () => {
  it("adds a character with generated id and default size", () => {
    const r = addCard(emptyWorld(), {
      type: "character",
      name: "Queen Lyra",
      summary: "Afraid of the dark",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.id).toMatch(/^character_[a-f0-9]{8}$/);
    const card = r.world.cards[0];
    expect(card.w).toBe(220);
    expect(card.h).toBe(140);
    expect(card.x).toBe(0);
    expect(card.y).toBe(0);
  });

  it("auto-layouts on a 260px grid, 4 columns", () => {
    let w = emptyWorld();
    for (let i = 0; i < 5; i++) {
      const r = addCard(w, { type: "place", name: `P${i}` });
      expect(r.ok).toBe(true);
      if (r.ok) w = r.world;
    }
    expect(w.cards[4].x).toBe(0);
    expect(w.cards[4].y).toBe(260);
  });

  it("rejects empty name", () => {
    const r = addCard(emptyWorld(), { type: "character", name: "  " });
    expect(r).toEqual({ ok: false, error: "name is required" });
  });

  it("caps at 50 cards", () => {
    let w = emptyWorld();
    for (let i = 0; i < MAX_CARDS; i++) {
      const r = addCard(w, { type: "note", name: `n${i}` });
      expect(r.ok).toBe(true);
      if (r.ok) w = r.world;
    }
    const r = addCard(w, { type: "note", name: "one more" });
    expect(r).toEqual({
      ok: false,
      error: "world is full (50 cards). Delete something first.",
    });
  });

  it("deletes a card and its incident links", () => {
    let w = emptyWorld();
    const a = addCard(w, { type: "character", name: "A" });
    if (!a.ok) throw new Error("fail");
    w = a.world;
    const b = addCard(w, { type: "place", name: "B" });
    if (!b.ok) throw new Error("fail");
    w = b.world;
    const c = connect(w, { fromId: a.id, toId: b.id, label: "lives in" });
    if (!c.ok) throw new Error("fail");
    w = c.world;
    const d = deleteElement(w, a.id);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.world.cards).toHaveLength(1);
    expect(d.world.links).toHaveLength(0);
  });

  it("rejects self-link and duplicate link", () => {
    let w = emptyWorld();
    const a = addCard(w, { type: "character", name: "A" });
    if (!a.ok) throw new Error("fail");
    w = a.world;
    const b = addCard(w, { type: "place", name: "B" });
    if (!b.ok) throw new Error("fail");
    w = b.world;
    expect(connect(w, { fromId: a.id, toId: a.id }).ok).toBe(false);
    const c = connect(w, { fromId: a.id, toId: b.id });
    if (!c.ok) throw new Error("fail");
    expect(connect(c.world, { fromId: a.id, toId: b.id })).toEqual({
      ok: false,
      error: "already connected",
    });
  });

  it("rejects non-http(s) image and images on notes", () => {
    const n = addCard(emptyWorld(), { type: "note", name: "secret" });
    if (!n.ok) throw new Error("fail");
    expect(setCardImage(n.world, n.id, "https://example.com/a.png").ok).toBe(
      false,
    );
    const ch = addCard(emptyWorld(), { type: "character", name: "A" });
    if (!ch.ok) throw new Error("fail");
    expect(setCardImage(ch.world, ch.id, "ftp://x").ok).toBe(false);
    const ok = setCardImage(ch.world, ch.id, "https://example.com/a.png");
    expect(ok.ok).toBe(true);
  });

  it("summarizeWorld puts selected first, max 20, truncates names", () => {
    let w = emptyWorld();
    w = { ...w, name: "Eldoria" };
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      const r = addCard(w, {
        type: "character",
        name: `Hero ${i} ${"x".repeat(50)}`,
      });
      if (!r.ok) throw new Error("fail");
      w = r.world;
      ids.push(r.id);
    }
    const selected = ids[20];
    const s = summarizeWorld(w, [selected]);
    expect(s.cardCount).toBe(25);
    expect(s.maxCards).toBe(50);
    expect(s.truncated).toBe(true);
    expect(s.cards.length).toBeGreaterThan(0);
    expect(s.cards.length).toBeLessThanOrEqual(20);
    expect(s.cards[0].id).toBe(selected);
    expect(s.cards[0].name.length).toBeLessThanOrEqual(40);
    expect(s.selectedIds).toEqual([selected]);
    expect(JSON.stringify(s).length).toBeLessThanOrEqual(1500);
  });

  it("inspectElement returns full summary", () => {
    const r = addCard(emptyWorld(), {
      type: "character",
      name: "Lyra",
      summary: "Afraid of the dark",
    });
    if (!r.ok) throw new Error("fail");
    const ins = inspectElement(r.world, r.id);
    expect(ins.ok).toBe(true);
    if (!ins.ok) return;
    expect(ins.card?.summary).toBe("Afraid of the dark");
  });
});
