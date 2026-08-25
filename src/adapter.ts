import {
  createShapeId,
  toRichText,
  type Editor,
  type TLShapeId,
} from "tldraw";
import { isStoryShapeType, type StoryShapeType } from "./shapes";
import type { Card, CardType, Link, World } from "./world";

const TYPE_TO_SHAPE: Record<CardType, StoryShapeType> = {
  character: "lsw-character",
  place: "lsw-place",
  plot: "lsw-plot",
  note: "lsw-note",
  region: "lsw-region",
};

const SHAPE_TO_TYPE: Record<StoryShapeType, CardType> = {
  "lsw-character": "character",
  "lsw-place": "place",
  "lsw-plot": "plot",
  "lsw-note": "note",
  "lsw-region": "region",
};

export function shapeIdFor(id: string): TLShapeId {
  return createShapeId(id);
}

export function worldIdFromShapeId(id: string): string {
  return id.startsWith("shape:") ? id.slice("shape:".length) : id;
}

export function worldFromEditor(editor: Editor, worldName: string): World {
  const cards: Card[] = [];
  const links: Link[] = [];
  for (const shape of editor.getCurrentPageShapes()) {
    if (isStoryShapeType(shape.type)) {
      const props = shape.props as {
        w: number;
        h: number;
        name: string;
        summary: string;
        imageUrl: string;
      };
      cards.push({
        id: worldIdFromShapeId(shape.id),
        type: SHAPE_TO_TYPE[shape.type],
        name: props.name,
        summary: props.summary,
        imageUrl: props.imageUrl ? props.imageUrl : null,
        x: shape.x,
        y: shape.y,
        w: props.w,
        h: props.h,
      });
      continue;
    }
    if (shape.type !== "arrow") continue;
    const id = worldIdFromShapeId(shape.id);
    if (!id.startsWith("link_")) continue;
    const bindings = editor.getBindingsFromShape(shape.id, "arrow");
    const start = bindings.find((b) => b.props.terminal === "start");
    const end = bindings.find((b) => b.props.terminal === "end");
    if (!start || !end) continue;
    const meta = shape.meta as { lswLabel?: string };
    links.push({
      id,
      fromId: worldIdFromShapeId(start.toId),
      toId: worldIdFromShapeId(end.toId),
      label: meta.lswLabel ?? "",
    });
  }
  return { name: worldName, cards, links };
}

export function applyWorld(editor: Editor, next: World): void {
  editor.run(() => {
    editor.markHistoryStoppingPoint("agent-world");
    const wantedCards = new Set(next.cards.map((c) => shapeIdFor(c.id)));
    const wantedLinks = new Set(next.links.map((l) => shapeIdFor(l.id)));

    for (const shape of editor.getCurrentPageShapes()) {
      if (isStoryShapeType(shape.type) && !wantedCards.has(shape.id)) {
        editor.deleteShape(shape.id);
      }
      if (
        shape.type === "arrow" &&
        worldIdFromShapeId(shape.id).startsWith("link_") &&
        !wantedLinks.has(shape.id)
      ) {
        editor.deleteShape(shape.id);
      }
    }

    for (const card of next.cards) {
      const id = shapeIdFor(card.id);
      const type = TYPE_TO_SHAPE[card.type];
      const props = {
        w: card.w,
        h: card.h,
        name: card.name,
        summary: card.summary,
        imageUrl: card.imageUrl ?? "",
      };
      if (editor.getShape(id)) {
        editor.updateShape({ id, type, x: card.x, y: card.y, props });
      } else {
        editor.createShape({ id, type, x: card.x, y: card.y, props });
      }
    }

    for (const link of next.links) {
      const id = shapeIdFor(link.id);
      const fromId = shapeIdFor(link.fromId);
      const toId = shapeIdFor(link.toId);
      if (!editor.getShape(fromId) || !editor.getShape(toId)) continue;
      if (!editor.getShape(id)) {
        editor.createShape({
          id,
          type: "arrow",
          x: 0,
          y: 0,
          props: {
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
            richText: toRichText(link.label || " "),
          },
          meta: { lswLabel: link.label },
        });
        editor.createBindings([
          {
            type: "arrow",
            fromId: id,
            toId: fromId,
            props: {
              terminal: "start",
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isPrecise: false,
              isExact: false,
              snap: "none",
            },
          },
          {
            type: "arrow",
            fromId: id,
            toId: toId,
            props: {
              terminal: "end",
              normalizedAnchor: { x: 0.5, y: 0.5 },
              isPrecise: false,
              isExact: false,
              snap: "none",
            },
          },
        ]);
      } else {
        editor.updateShape({
          id,
          type: "arrow",
          props: { richText: toRichText(link.label || " ") },
          meta: { lswLabel: link.label },
        });
      }
    }
  });
}

export function focusCard(editor: Editor, id: string): void {
  const shapeId = shapeIdFor(id);
  const bounds = editor.getShapePageBounds(shapeId);
  if (!bounds) return;
  editor.setSelectedShapes([shapeId]);
  editor.zoomToBounds(bounds, { animation: { duration: 280 }, inset: 80 });
}

export function pulseCards(editor: Editor, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    const shape = editor.getShape(shapeIdFor(id));
    if (!shape) continue;
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      meta: { ...shape.meta, pulseAt: now },
    });
  }
  editor.setSelectedShapes(
    ids.map(shapeIdFor).filter((sid) => editor.getShape(sid)),
  );
}

export function selectedWorldIds(editor: Editor): string[] {
  return editor.getSelectedShapeIds().map(worldIdFromShapeId);
}
