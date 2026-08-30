import type { StoryCardProps } from "./types";

type Kind = "character" | "place" | "plot" | "note" | "region";

const colors: Record<Kind, { stroke: string; dash?: string }> = {
  character: { stroke: "#a67c3a" },
  place: { stroke: "#5a7a3a" },
  plot: { stroke: "#8b4a3a", dash: "6 4" },
  note: { stroke: "#c4b48a" },
  region: { stroke: "#a67c3a", dash: "8 5" },
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
      <rect width={props.w} height={props.h} rx={kind === "region" ? 0 : 4} fill={kind === "region" ? "#f4ead059" : "#f4ead0"} stroke={color.stroke} strokeWidth={kind === "region" ? 2 : 1} strokeDasharray={color.dash} />
      <text x="12" y="20" fill="#80672f" fontFamily="sans-serif" fontSize="9" letterSpacing="1.4">{labels[kind]}</text>
      <text x="12" y="43" fill="#2d281f" fontFamily="sans-serif" fontSize="16" fontWeight="700">{clip(props.name || "Untitled", 36)}</text>
      {kind !== "note" && kind !== "region" && props.summary && (
        <text x="12" y="66" fill="#514838" fontFamily="sans-serif" fontSize="11" fontStyle="italic">{clip(props.summary, 54)}</text>
      )}
    </g>
  );
}
