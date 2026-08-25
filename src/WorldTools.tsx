import { useWebMCP } from "use-webmcp-tool";
import type { Editor } from "tldraw";
import { ADD_TOOL_NAMES, TOOLS, runTool, type ToolDef } from "./tools";
import {
  applyWorld,
  focusCard,
  pulseCards,
  selectedWorldIds,
  worldFromEditor,
} from "./adapter";
import { MAX_CARDS } from "./world";

type Props = {
  editor: Editor | null;
  worldName: string;
  cardCount: number;
  onToast: (message: string) => void;
  onPersist: () => void;
};

function RegisteredTool({
  tool,
  enabled,
  editor,
  worldName,
  onToast,
  onPersist,
}: {
  tool: ToolDef;
  enabled: boolean;
  editor: Editor | null;
  worldName: string;
  onToast: (message: string) => void;
  onPersist: () => void;
}) {
  useWebMCP({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
    enabled: enabled && Boolean(editor),
    execute: (args: Record<string, unknown> | undefined) => {
      if (!editor) return { ok: false, error: "canvas not ready" };
      const world = worldFromEditor(editor, worldName);
      const { result, world: next } = runTool(tool.name, world, args ?? {}, {
        selectedIds: selectedWorldIds(editor),
      });
      if (!result.ok) return result;
      if (next !== world) applyWorld(editor, next);
      const id =
        "id" in result && typeof result.id === "string" ? result.id : undefined;
      if (tool.name === "focus_element" && id) focusCard(editor, id);
      if (id) pulseCards(editor, [id]);
      onToast(result.message);
      onPersist();
      return result;
    },
  });
  return null;
}

export function WorldTools({ editor, worldName, cardCount, onToast, onPersist }: Props) {
  const canAdd = cardCount < MAX_CARDS;
  const addSet = new Set<string>(ADD_TOOL_NAMES);

  return (
    <>
      {TOOLS.map((tool) => (
        <RegisteredTool
          key={tool.name}
          tool={tool}
          enabled={!addSet.has(tool.name) || canAdd}
          editor={editor}
          worldName={worldName}
          onToast={onToast}
          onPersist={onPersist}
        />
      ))}
    </>
  );
}

export function webmcpSupported(): boolean {
  if (typeof document === "undefined") return false;
  const nav = navigator as Navigator & { modelContext?: { registerTool?: unknown } };
  const ctx = document.modelContext ?? nav.modelContext;
  return Boolean(ctx && typeof ctx.registerTool === "function");
}
