import {
  createShapeId,
  toRichText,
  type Editor,
  type TLShapeId,
} from "tldraw";
import { isStoryShapeType, type StoryShapeType } from "./shapes";
import type { CardType, World } from "./world";

const TYPE_TO_SHAPE: Record<CardType, StoryShapeType> = {
  character: "lsw-character",
  place: "lsw-place",
  plot: "lsw-plot",
  note: "lsw-note",
  region: "lsw-region",
};

export function shapeIdFor(id: string): TLShapeId {
  return createShapeId(id);
}

export function worldIdFromShapeId(id: string): string {
  return id.startsWith("shape:") ? id.slice("shape:".length) : id;
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
            // Labels wrap to the arrow's length. At the default size a short
            // connection broke "connect()" across three lines.
            size: "s",
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
