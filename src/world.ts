// Shared canvas vocabulary. `Card`/`Link`/`World` are the shape-agnostic
// records that `appStory.ts` (`proposalToWorld`) produces from an accepted
// analysis and `adapter.ts` (`applyWorld`) renders onto the tldraw canvas —
// the seam between "what the analysis says" and "what's drawn."
//
// This file used to also hold a full CRUD model (add/update/delete a card,
// a 50-card cap, a compact-index summarizer) for the product's earlier
// Living Story World form, where a WebMCP agent edited the board directly.
// App Story replaced that with an evidence-reviewed proposal flow, so that
// model has no caller left; only the shared types below survive it.

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
