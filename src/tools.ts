import type { CardType, World } from "./world";
import {
  addCard,
  connect,
  deleteElement,
  inspectElement,
  setCardImage,
  summarizeWorld,
  updateCard,
} from "./world";

export type ToolSignal = { aborted?: boolean };

export type ToolOk = { ok: true; message: string } & Record<string, unknown>;
export type ToolErr = { ok: false; error: string };
export type ToolResult = ToolOk | ToolErr;

export type RunOptions = {
  aborted?: boolean;
  selectedIds?: string[];
};

export type JsonSchema = Record<string, unknown>;

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (world: World, input: Record<string, unknown>, options?: RunOptions) => {
    result: ToolResult;
    world: World;
  };
};

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function cancelled(options?: RunOptions): boolean {
  return Boolean(options?.aborted);
}

function addOf(type: CardType, message: (name: string) => string): ToolDef["execute"] {
  return (world, input, options) => {
    if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
    const name = str(input.name) ?? "";
    const r = addCard(world, {
      type,
      name,
      summary: str(input.summary),
      imageUrl: str(input.imageUrl),
      x: num(input.x),
      y: num(input.y),
      w: num(input.w),
      h: num(input.h),
    });
    if (!r.ok) return { result: r, world };
    return {
      result: { ok: true, message: message(name.trim()), id: r.id },
      world: r.world,
    };
  };
}

const idSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "Card or link id from get_world_state." },
  },
  required: ["id"],
};

const addFields = {
  name: { type: "string", description: "Display name on the parchment card." },
  summary: { type: "string", description: "Short description or traits." },
  imageUrl: { type: "string", description: "Optional http(s) image URL." },
  x: { type: "number", description: "Page X. Omit to auto-place." },
  y: { type: "number", description: "Page Y. Omit to auto-place." },
};

export const TOOLS: ToolDef[] = [
  {
    name: "get_world_state",
    title: "Read the world",
    description:
      "Compact index of the story world plus whatever the human currently has selected. Call this before changing anything. Does not include full summaries — use inspect_element for one card.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(world, _input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const index = summarizeWorld(world, options?.selectedIds ?? []);
      return {
        result: {
          ok: true,
          message: `${index.name} · ${index.cardCount}/${index.maxCards} cards`,
          ...index,
        },
        world,
      };
    },
  },
  {
    name: "inspect_element",
    title: "Inspect a card",
    description:
      "Return the full fields of one card, note, region, or link (summary, image URL, position). Use after get_world_state when you need the text, not just the name.",
    inputSchema: idSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const id = str(input.id) ?? "";
      const r = inspectElement(world, id);
      if (!r.ok) return { result: r, world };
      return {
        result: {
          ok: true,
          message: r.card ? `Inspected ${r.card.name}` : `Inspected link ${id}`,
          card: r.card,
          link: r.link,
        },
        world,
      };
    },
  },
  {
    name: "add_character",
    title: "Add character",
    description: "Add a character card to the parchment.",
    inputSchema: {
      type: "object",
      properties: addFields,
      required: ["name"],
    },
    annotations: { untrustedContentHint: true },
    execute: addOf("character", (n) => `Added character ${n}`),
  },
  {
    name: "add_place",
    title: "Add place",
    description: "Add a location card to the parchment.",
    inputSchema: {
      type: "object",
      properties: addFields,
      required: ["name"],
    },
    annotations: { untrustedContentHint: true },
    execute: addOf("place", (n) => `Added place ${n}`),
  },
  {
    name: "add_plot_point",
    title: "Add plot beat",
    description: "Add a plot-beat card (something that happens in the story).",
    inputSchema: {
      type: "object",
      properties: addFields,
      required: ["name"],
    },
    annotations: { untrustedContentHint: true },
    execute: addOf("plot", (n) => `Added plot beat ${n}`),
  },
  {
    name: "add_note",
    title: "Pin a note",
    description:
      "Pin a short parchment note (a thought, secret, or reminder). Not a character, place, or plot beat.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Note body." },
        x: addFields.x,
        y: addFields.y,
      },
      required: ["text"],
    },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const text = str(input.text) ?? "";
      const r = addCard(world, {
        type: "note",
        name: text,
        x: num(input.x),
        y: num(input.y),
      });
      if (!r.ok) return { result: r, world };
      return {
        result: { ok: true, message: "Pinned a note", id: r.id },
        world: r.world,
      };
    },
  },
  {
    name: "add_region",
    title: "Draw a region",
    description:
      "Draw a labeled dashed frame to group an area of the world (for example “The Northern Reaches”).",
    inputSchema: {
      type: "object",
      properties: {
        name: addFields.name,
        x: addFields.x,
        y: addFields.y,
        w: { type: "number", description: "Width. Default 480." },
        h: { type: "number", description: "Height. Default 320." },
      },
      required: ["name"],
    },
    execute: addOf("region", (n) => `Drew region ${n}`),
  },
  {
    name: "connect_elements",
    title: "Connect two cards",
    description: "Draw a labeled arrow from one card, note, or region to another.",
    inputSchema: {
      type: "object",
      properties: {
        fromId: { type: "string", description: "Source card id." },
        toId: { type: "string", description: "Target card id." },
        label: { type: "string", description: "Optional arrow label." },
      },
      required: ["fromId", "toId"],
    },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const r = connect(world, {
        fromId: str(input.fromId) ?? "",
        toId: str(input.toId) ?? "",
        label: str(input.label),
      });
      if (!r.ok) return { result: r, world };
      return {
        result: { ok: true, message: "Connected cards", id: r.id },
        world: r.world,
      };
    },
  },
  {
    name: "update_element",
    title: "Update a card",
    description: "Change name, summary, or position of an existing card, note, or region.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Card id to change." },
        name: addFields.name,
        summary: addFields.summary,
        x: addFields.x,
        y: addFields.y,
        w: { type: "number", description: "New width." },
        h: { type: "number", description: "New height." },
      },
      required: ["id"],
    },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const r = updateCard(world, {
        id: str(input.id) ?? "",
        name: str(input.name),
        summary: str(input.summary),
        x: num(input.x),
        y: num(input.y),
        w: num(input.w),
        h: num(input.h),
      });
      if (!r.ok) return { result: r, world };
      return {
        result: { ok: true, message: "Updated card", id: r.id },
        world: r.world,
      };
    },
  },
  {
    name: "set_element_image",
    title: "Set card image",
    description:
      "Set or clear the image URL on a character, place, or plot card. Does not generate an image. Pass an empty string to clear.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Character, place, or plot id." },
        imageUrl: { type: "string", description: "http(s) URL, or empty to clear." },
      },
      required: ["id", "imageUrl"],
    },
    annotations: { untrustedContentHint: true },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const r = setCardImage(world, str(input.id) ?? "", str(input.imageUrl) ?? "");
      if (!r.ok) return { result: r, world };
      return {
        result: { ok: true, message: "Updated image", id: r.id },
        world: r.world,
      };
    },
  },
  {
    name: "focus_element",
    title: "Focus a card",
    description:
      "Pan and zoom the canvas so a card is centered on screen. Does not change the world.",
    inputSchema: idSchema,
    annotations: { readOnlyHint: true },
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const id = str(input.id) ?? "";
      const found =
        world.cards.some((c) => c.id === id) || world.links.some((l) => l.id === id);
      if (!found) return { result: { ok: false, error: `unknown id: ${id}` }, world };
      return { result: { ok: true, message: `Focused ${id}`, id }, world };
    },
  },
  {
    name: "delete_element",
    title: "Delete a card",
    description:
      "Remove a card, note, region, or link. Incident arrows are removed with a card. The human can undo from the canvas (Ctrl/Cmd+Z).",
    inputSchema: idSchema,
    execute(world, input, options) {
      if (cancelled(options)) return { result: { ok: false, error: "cancelled" }, world };
      const r = deleteElement(world, str(input.id) ?? "");
      if (!r.ok) return { result: r, world };
      return {
        result: { ok: true, message: "Deleted", id: r.id },
        world: r.world,
      };
    },
  },
];

export const ADD_TOOL_NAMES = [
  "add_character",
  "add_place",
  "add_plot_point",
  "add_note",
  "add_region",
] as const;

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function runTool(
  name: string,
  world: World,
  input: Record<string, unknown>,
  options?: RunOptions,
): { result: ToolResult; world: World } {
  const tool = BY_NAME.get(name);
  if (!tool) return { result: { ok: false, error: `unknown tool: ${name}` }, world };
  return tool.execute(world, input ?? {}, options);
}
