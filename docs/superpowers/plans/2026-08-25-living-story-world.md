# Living Story World Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a parchment infinite-canvas web app where a human and ChatGPT co-build a story world via 12 in-page WebMCP tools, ready for the WebMCP Challenge.

**Architecture:** Pure Vite + React SPA. Canonical story logic lives in `world.ts` (pure, tested). Tool executors in `tools.ts` call `world.ts` and return compact JSON. A tldraw adapter projects `World` onto custom parchment shapes. Chrome’s `useWebMCP` hook (`use-webmcp-tool`) registers tools on `document.modelContext` with AbortSignal lifecycle; add-tools unmount at the 50-card cap. Persistence is `getSnapshot`/`loadSnapshot` in localStorage.

**Tech Stack:** Vite, React 19, TypeScript, tldraw, Vitest, `use-webmcp-tool`, `webmcp-types`. Static host (Netlify/Cloudflare Pages/Vercel). No backend, no app-owned LLM.

**Judging alignment:**
- **WebMCP Leverage:** 12 real tools, annotations, compact vs inspect, selectedIds, abort, dynamic add-tool registry, visible actuation.
- **Execution:** Full product chrome (header, legend, How to play, empty state, persist, parchment theme).
- **Impact:** Writers / GMs / kids building a story together without the agent guessing clicks.
- **Creativity:** Shared living parchment, not a form or storefront.

**Spec:** `docs/superpowers/specs/2026-08-25-living-story-world-design.md`

---

## File map

```
src/
  main.tsx
  App.tsx
  styles.css
  world.ts              # pure World model
  world.test.ts
  tools.ts              # tool defs + execute(world, input, signal?)
  tools.test.ts
  persist.ts
  persist.test.ts
  adapter.ts            # World <-> tldraw editor
  webmcp-status.ts      # feature detect helpers
  canvas.tsx
  WorldTools.tsx        # useWebMCP registrations
  status.tsx
  help.tsx
  toast.tsx
  legend.tsx
  shapes/
    types.ts
    StoryCardUtil.tsx   # character | place | plot
    NoteUtil.tsx
    RegionUtil.tsx
    index.ts
public/_headers         # Origin-Agent-Cluster + Permissions-Policy
vite.config.ts          # vitest + dev headers
index.html
LICENSE
README.md
netlify.toml
```

tldraw shape ids: `createShapeId(card.id)` → `shape:${card.id}`. Tool-facing ids stay `character_ab12cd34` (no `shape:` prefix). Adapter translates.

---

### Task 1: Scaffold Vite React TS + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/vite-env.d.ts`

- [ ] **Step 1: Create Vite app in the repo root**

From `Z:\Dev\storytime` (already a git repo with spec files — do not nest a second git repo):

```bash
npm create vite@latest . -- --template react-ts
```

If the tool refuses a non-empty directory, create files manually with the same template shape. Then:

```bash
npm install
npm install tldraw use-webmcp-tool
npm install -D vitest @vitest/coverage-v8 jsdom webmcp-types
```

- [ ] **Step 2: Configure Vitest and WebMCP types**

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Origin-Agent-Cluster": "?1",
      "Permissions-Policy": "tools=(self)",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

Add `"types": ["vite/client", "webmcp-types"]` under `compilerOptions` in `tsconfig.app.json`. Add npm script `"test": "vitest run"`.

- [ ] **Step 3: Smoke-run tests (zero tests is OK / pass)**

```bash
npm test
```

Expected: Vitest runs, 0 tests or placeholder pass, exit 0.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/living-story-world
git add -A
git commit -m "chore: scaffold Vite React app with Vitest and WebMCP types"
```

---

### Task 2: Pure world model (TDD)

**Files:**
- Create: `src/world.ts`, `src/world.test.ts`

Follow TDD. Watch each new test fail before implementing.

- [ ] **Step 1: Write failing tests**

```ts
// src/world.test.ts
import { describe, expect, it } from "vitest";
import {
  MAX_CARDS,
  emptyWorld,
  addCard,
  updateCard,
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
    let w = emptyWorld();
    const n = addCard(w, { type: "note", name: "secret" });
    if (!n.ok) throw new Error("fail");
    expect(setCardImage(n.world, n.id, "https://x.com/a.png").ok).toBe(false);
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
      const r = addCard(w, { type: "character", name: `Hero ${i} ${"x".repeat(50)}` });
      if (!r.ok) throw new Error("fail");
      w = r.world;
      ids.push(r.id);
    }
    const selected = ids[20];
    const s = summarizeWorld(w, [selected]);
    expect(s.cardCount).toBe(25);
    expect(s.maxCards).toBe(50);
    expect(s.truncated).toBe(true);
    expect(s.cards).toHaveLength(20);
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
```

- [ ] **Step 2: Run tests — expect FAIL (modules not found)**

```bash
npm test
```

- [ ] **Step 3: Implement `src/world.ts`**

```ts
export const MAX_CARDS = 50;
export const GRID = 260;
export const COLS = 4;

export type CardType = "character" | "place" | "plot" | "note" | "region";

export type Card = {
  id: string;
  type: CardType;
  name: string;
  summary: string;
  imageUrl: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Link = {
  id: string;
  fromId: string;
  toId: string;
  label: string;
};

export type World = {
  name: string;
  cards: Card[];
  links: Link[];
};

export type Ok<T> = { ok: true } & T;
export type Err = { ok: false; error: string };
export type Result<T> = Ok<T> | Err;

const DEFAULTS: Record<CardType, { w: number; h: number }> = {
  character: { w: 220, h: 140 },
  place: { w: 220, h: 140 },
  plot: { w: 220, h: 140 },
  note: { w: 180, h: 100 },
  region: { w: 480, h: 320 },
};

export function emptyWorld(): World {
  return { name: "Untitled world", cards: [], links: [] };
}

export function makeId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function occupiedCell(world: World, x: number, y: number): boolean {
  return world.cards.some((c) => c.x === x && c.y === y);
}

export function autoPosition(world: World): { x: number; y: number } {
  for (let i = 0; i < MAX_CARDS + 8; i++) {
    const x = (i % COLS) * GRID;
    const y = Math.floor(i / COLS) * GRID;
    if (!occupiedCell(world, x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}

export function addCard(
  world: World,
  input: {
    type: CardType;
    name: string;
    summary?: string;
    imageUrl?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  },
): Result<{ world: World; id: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "name is required" };
  if (world.cards.length >= MAX_CARDS) {
    return { ok: false, error: "world is full (50 cards). Delete something first." };
  }
  let imageUrl: string | null = null;
  if (input.imageUrl) {
    if (input.type === "note" || input.type === "region") {
      return { ok: false, error: "notes and regions cannot have images" };
    }
    if (!isHttpUrl(input.imageUrl)) {
      return { ok: false, error: "imageUrl must be an http(s) URL" };
    }
    imageUrl = input.imageUrl;
  }
  const size = DEFAULTS[input.type];
  const pos =
    input.x !== undefined && input.y !== undefined
      ? { x: input.x, y: input.y }
      : autoPosition(world);
  const h = imageUrl && input.type !== "note" ? 200 : (input.h ?? size.h);
  const card: Card = {
    id: makeId(input.type),
    type: input.type,
    name,
    summary: (input.summary ?? "").trim(),
    imageUrl,
    x: pos.x,
    y: pos.y,
    w: input.w ?? size.w,
    h,
  };
  return { ok: true, id: card.id, world: { ...world, cards: [...world.cards, card] } };
}

export function updateCard(
  world: World,
  input: {
    id: string;
    name?: string;
    summary?: string;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
  },
): Result<{ world: World; id: string }> {
  const idx = world.cards.findIndex((c) => c.id === input.id);
  if (idx < 0) return { ok: false, error: `unknown id: ${input.id}` };
  const has =
    input.name !== undefined ||
    input.summary !== undefined ||
    input.x !== undefined ||
    input.y !== undefined ||
    input.w !== undefined ||
    input.h !== undefined;
  if (!has) return { ok: false, error: "no fields to update" };
  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, error: "name is required" };
  }
  const prev = world.cards[idx];
  const next: Card = {
    ...prev,
    name: input.name !== undefined ? input.name.trim() : prev.name,
    summary: input.summary !== undefined ? input.summary.trim() : prev.summary,
    x: input.x ?? prev.x,
    y: input.y ?? prev.y,
    w: input.w ?? prev.w,
    h: input.h ?? prev.h,
  };
  const cards = world.cards.slice();
  cards[idx] = next;
  return { ok: true, id: next.id, world: { ...world, cards } };
}

export function setCardImage(
  world: World,
  id: string,
  imageUrl: string,
): Result<{ world: World; id: string }> {
  const card = world.cards.find((c) => c.id === id);
  if (!card) return { ok: false, error: `unknown id: ${id}` };
  if (card.type === "note" || card.type === "region") {
    return { ok: false, error: "notes and regions cannot have images" };
  }
  const trimmed = imageUrl.trim();
  let nextUrl: string | null = null;
  if (trimmed) {
    if (!isHttpUrl(trimmed)) return { ok: false, error: "imageUrl must be an http(s) URL" };
    nextUrl = trimmed;
  }
  return updateCard(world, {
    id,
    h: nextUrl ? 200 : DEFAULTS[card.type].h,
  }).ok
    ? {
        ok: true,
        id,
        world: {
          ...world,
          cards: world.cards.map((c) =>
            c.id === id ? { ...c, imageUrl: nextUrl, h: nextUrl ? 200 : DEFAULTS[c.type].h } : c,
          ),
        },
      }
    : { ok: false, error: `unknown id: ${id}` };
}

export function connect(
  world: World,
  input: { fromId: string; toId: string; label?: string },
): Result<{ world: World; id: string }> {
  if (input.fromId === input.toId) return { ok: false, error: "cannot connect a card to itself" };
  const ids = new Set(world.cards.map((c) => c.id));
  if (!ids.has(input.fromId)) return { ok: false, error: `unknown id: ${input.fromId}` };
  if (!ids.has(input.toId)) return { ok: false, error: `unknown id: ${input.toId}` };
  if (world.links.some((l) => l.fromId === input.fromId && l.toId === input.toId)) {
    return { ok: false, error: "already connected" };
  }
  const link: Link = {
    id: makeId("link"),
    fromId: input.fromId,
    toId: input.toId,
    label: (input.label ?? "").trim(),
  };
  return { ok: true, id: link.id, world: { ...world, links: [...world.links, link] } };
}

export function deleteElement(world: World, id: string): Result<{ world: World; id: string }> {
  const card = world.cards.find((c) => c.id === id);
  const link = world.links.find((l) => l.id === id);
  if (!card && !link) return { ok: false, error: `unknown id: ${id}` };
  if (link) {
    return {
      ok: true,
      id,
      world: { ...world, links: world.links.filter((l) => l.id !== id) },
    };
  }
  return {
    ok: true,
    id,
    world: {
      ...world,
      cards: world.cards.filter((c) => c.id !== id),
      links: world.links.filter((l) => l.fromId !== id && l.toId !== id),
    },
  };
}

function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export type WorldIndex = {
  name: string;
  cardCount: number;
  maxCards: number;
  selectedIds: string[];
  truncated: boolean;
  cards: { id: string; type: CardType; name: string }[];
  links: { id: string; fromId: string; toId: string; label: string }[];
};

export function summarizeWorld(world: World, selectedIds: string[]): WorldIndex {
  const selected = selectedIds.filter((id) => world.cards.some((c) => c.id === id));
  const rest = world.cards.filter((c) => !selected.includes(c.id)).slice().reverse();
  const ordered = [
    ...selected.map((id) => world.cards.find((c) => c.id === id)!),
    ...rest,
  ];
  const truncated = ordered.length > 20;
  const cards = ordered.slice(0, 20).map((c) => ({
    id: c.id,
    type: c.type,
    name: clip(c.name, 40),
  }));
  const index: WorldIndex = {
    name: world.name,
    cardCount: world.cards.length,
    maxCards: MAX_CARDS,
    selectedIds: selected,
    truncated,
    cards,
    links: world.links.map((l) => ({
      id: l.id,
      fromId: l.fromId,
      toId: l.toId,
      label: clip(l.label, 24),
    })),
  };
  let json = JSON.stringify(index);
  while (json.length > 1500 && index.cards.length > 1) {
    index.cards.pop();
    index.truncated = true;
    json = JSON.stringify(index);
  }
  while (json.length > 1500 && index.links.length > 0) {
    index.links.pop();
    index.truncated = true;
    json = JSON.stringify(index);
  }
  return index;
}

export function inspectElement(
  world: World,
  id: string,
): Result<{ card?: Card; link?: Link }> {
  const card = world.cards.find((c) => c.id === id);
  if (card) {
    return {
      ok: true,
      card: { ...card, summary: clip(card.summary, 500) },
    };
  }
  const link = world.links.find((l) => l.id === id);
  if (link) return { ok: true, link };
  return { ok: false, error: `unknown id: ${id}` };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/world.ts src/world.test.ts
git commit -m "feat: add pure story world model with cap, links, and compact index"
```

---

### Task 3: Tool executors (TDD)

**Files:**
- Create: `src/tools.ts`, `src/tools.test.ts`

- [ ] **Step 1: Write failing tests** covering: `get_world_state` compact + selectedIds; `inspect_element`; add/update/delete/connect; cancelled signal does not mutate; unknown id errors.

Tool executor signature:

```ts
export type ToolSignal = { aborted?: boolean };
export type ToolResult = { ok: true; message: string } & Record<string, unknown> | { ok: false; error: string };

export function runTool(
  name: string,
  world: World,
  input: Record<string, unknown>,
  signal?: ToolSignal,
): { result: ToolResult; world: World }
```

If `signal?.aborted`, return `{ result: { ok: false, error: "cancelled" }, world }` unchanged.

Map `add_note` input `text` → `addCard({ type: "note", name: text })`.

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement `src/tools.ts` with TOOLS array:** `{ name, title, description, inputSchema, annotations, execute(world, input, signal) }`. Names, titles, descriptions, schemas, annotations match the spec (12 tools).
- [ ] **Step 4: PASS**
- [ ] **Step 5: Commit** `feat: add WebMCP tool executors with abort and compact world index`

---

### Task 4: Persist (TDD)

**Files:**
- Create: `src/persist.ts`, `src/persist.test.ts`

Payload: `{ v: 1, worldName: string, snapshot: unknown }`.

- `save(storage, payload)` / `load(storage)` 
- corrupt JSON → `null`
- missing key → `null`
- quota throw → return `{ ok: false }` without throwing

Use an in-memory Storage fake in tests.

Commit: `feat: persist tldraw snapshot and world name in localStorage`

---

### Task 5: tldraw custom shapes + adapter

**Files:**
- Create: `src/shapes/types.ts`, `src/shapes/StoryCardUtil.tsx`, `src/shapes/NoteUtil.tsx`, `src/shapes/RegionUtil.tsx`, `src/shapes/index.ts`, `src/adapter.ts`, `src/canvas.tsx`

Shape types: `lsw-character`, `lsw-place`, `lsw-plot`, `lsw-note`, `lsw-region`.

Props: `{ w, h, name, summary, imageUrl: string }` (empty string = none).

`declare module 'tldraw' { interface TLGlobalShapePropsMap { ... } }`

Use `BaseBoxShapeUtil` or `ShapeUtil` with parchment HTMLContainer styles from the spec (gold/green/crimson rules).

`adapter.ts`:
- `applyWorld(editor, prev, next)` — create/update/delete custom shapes; create arrows + `createBindings` for new links; delete arrows for removed links. Shape id = `createShapeId(card.id)`.
- `worldFromEditor(editor): World` — read custom shapes + arrow bindings.
- `focusCard(editor, id)` — `editor.zoomToBounds` / `centerOnPoint`.
- `pulseIds(ids)` — CSS class via `meta.pulseAt = Date.now()` or select shapes.

`canvas.tsx`: full-bleed `<Tldraw shapeUtils={...} onMount={...} />` parchment background via CSS override of `.tl-background`.

No unit tests for React shapes; adapter helpers that map World↔shape records can be tested if kept free of Editor (optional). Manual verify later.

Commit: `feat: parchment tldraw shapes and world adapter`

---

### Task 6: App shell + useWebMCP registration

**Files:**
- Create: `src/WorldTools.tsx`, `src/status.tsx`, `src/help.tsx`, `src/toast.tsx`, `src/legend.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

`WorldTools.tsx` uses Chrome’s `useWebMCP` from `use-webmcp-tool` for each tool. Always-on tools always mounted. Add-tools rendered only when `cardCount < 50`.

Each `execute` reads world from editor via adapter, runs `runTool`, applies world, toasts, pulses, persists.

`App.tsx` layout: header (title, editable world name, status chip, How to play) + canvas + bottom legend.

Empty state overlay until first card.

Commit: `feat: register WebMCP tools with useWebMCP and product chrome`

---

### Task 7: Hosting headers, LICENSE, README (judging narrative)

**Files:**
- Create: `public/_headers`, `LICENSE`, `README.md`, `netlify.toml`

`public/_headers`:

```
/*
  Origin-Agent-Cluster: ?1
  Permissions-Policy: tools=(self)
```

README must include: what it is, who it is for, How to play, Chrome flag, ChatGPT in-app browser, inspector extension, 12 tools, demo script, MIT.

Commit: `docs: add README, MIT license, and WebMCP isolation headers`

---

### Task 8: Visual polish

Parchment CSS (`#e8d9b8` / `#e4d2a8`), Georgia cards, pulse keyframes, hide tldraw style panel if it fights the theme (`components={{ StylePanel: null }}` only if tools still usable). Agent toast styling.

Commit: `feat: parchment theme and visible agent actuation`

---

## Verification

```bash
npm test
npm run build
```

Manual: `npm run dev` → canvas, persist, Chrome flag tools, How to play.

Deploy to Netlify/Cloudflare Pages for the live URL judges need.
