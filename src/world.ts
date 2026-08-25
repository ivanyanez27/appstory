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
    return {
      ok: false,
      error: "world is full (50 cards). Delete something first.",
    };
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
  const h =
    imageUrl && input.type !== "note" && input.type !== "region"
      ? 200
      : (input.h ?? size.h);
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
  return {
    ok: true,
    id: card.id,
    world: { ...world, cards: [...world.cards, card] },
  };
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
    if (!isHttpUrl(trimmed)) {
      return { ok: false, error: "imageUrl must be an http(s) URL" };
    }
    nextUrl = trimmed;
  }
  const h = nextUrl ? 200 : DEFAULTS[card.type].h;
  return {
    ok: true,
    id,
    world: {
      ...world,
      cards: world.cards.map((c) =>
        c.id === id ? { ...c, imageUrl: nextUrl, h } : c,
      ),
    },
  };
}

export function connect(
  world: World,
  input: { fromId: string; toId: string; label?: string },
): Result<{ world: World; id: string }> {
  if (input.fromId === input.toId) {
    return { ok: false, error: "cannot connect a card to itself" };
  }
  const ids = new Set(world.cards.map((c) => c.id));
  if (!ids.has(input.fromId)) {
    return { ok: false, error: `unknown id: ${input.fromId}` };
  }
  if (!ids.has(input.toId)) {
    return { ok: false, error: `unknown id: ${input.toId}` };
  }
  if (world.links.some((l) => l.fromId === input.fromId && l.toId === input.toId)) {
    return { ok: false, error: "already connected" };
  }
  const link: Link = {
    id: makeId("link"),
    fromId: input.fromId,
    toId: input.toId,
    label: (input.label ?? "").trim(),
  };
  return {
    ok: true,
    id: link.id,
    world: { ...world, links: [...world.links, link] },
  };
}

export function deleteElement(
  world: World,
  id: string,
): Result<{ world: World; id: string }> {
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
  const index: WorldIndex = {
    name: world.name,
    cardCount: world.cards.length,
    maxCards: MAX_CARDS,
    selectedIds: selected,
    truncated,
    cards: ordered.slice(0, 20).map((c) => ({
      id: c.id,
      type: c.type,
      name: clip(c.name, 40),
    })),
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
    return { ok: true, card: { ...card, summary: clip(card.summary, 500) } };
  }
  const link = world.links.find((l) => l.id === id);
  if (link) return { ok: true, link };
  return { ok: false, error: `unknown id: ${id}` };
}
