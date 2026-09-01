import type { StoryCardProps } from "./types";

type Kind = "character" | "place" | "plot" | "note" | "region";

// Self-contained hex from the "Deep Ink Canvas" brand palette. Exports (SVG /
// PNG / Markdown) render outside the app, so no CSS variables here.
const colors: Record<Kind, { stroke: string; dash?: string }> = {
  character: { stroke: "#6366f1" },
  place: { stroke: "#06b6d4" },
  plot: { stroke: "#f59e0b", dash: "6 4" },
  note: { stroke: "#647488", dash: "4 3" },
  region: { stroke: "#33405c", dash: "8 5" },
};

const labels: Record<Kind, string> = {
  character: "ACTOR",
  place: "SCREEN / SYSTEM",
  plot: "DECISION / OUTCOME",
  note: "GAP / UNKNOWN",
  region: "APPLICATION AREA",
};

function clip(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function StoryShapeSvg({ kind, props }: { kind: Kind; props: StoryCardProps }) {
  const color = colors[kind];
  // ponytail: external images stay out of exports; embed approved Screen Captures when that feature ships.
  return (
    <g>
      <rect width={props.w} height={props.h} rx={kind === "region" ? 4 : 5} fill={kind === "region" ? "#0b0f1c" : "#0e1220"} stroke={color.stroke} strokeWidth={kind === "region" ? 2 : 1.5} strokeDasharray={color.dash} />
      <text x="12" y="20" fill="#647488" fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="9" letterSpacing="1.4">{labels[kind]}</text>
      <text x="12" y="43" fill="#edeff5" fontFamily="'Instrument Sans', ui-sans-serif, sans-serif" fontSize="16" fontWeight="700">{clip(props.name || "Untitled", 36)}</text>
      {kind !== "note" && kind !== "region" && props.summary && (
        <text x="12" y="66" fill="#9ba6bc" fontFamily="'Instrument Sans', ui-sans-serif, sans-serif" fontSize="11">{clip(props.summary, 54)}</text>
      )}
    </g>
  );
}
