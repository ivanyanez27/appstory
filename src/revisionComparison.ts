import type { AnalysisEdge, AnalysisNode, AnalysisProposal } from "./analysis";

export type RevisionComparisonItem = {
  itemType: "node" | "edge";
  itemId: string;
  status: "added" | "changed" | "unchanged" | "possibly_removed";
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function compareItems<T extends AnalysisNode | AnalysisEdge>(
  accepted: readonly T[],
  replacement: readonly T[],
  itemType: RevisionComparisonItem["itemType"],
): RevisionComparisonItem[] {
  const oldById = new Map(accepted.map((item) => [item.id, item]));
  const newIds = new Set(replacement.map((item) => item.id));
  return [
    ...replacement.map((item): RevisionComparisonItem => {
      const previous = oldById.get(item.id);
      return {
        itemType,
        itemId: item.id,
        status: !previous ? "added" : canonical(previous) === canonical(item) ? "unchanged" : "changed",
      };
    }),
    ...accepted
      .filter((item) => !newIds.has(item.id))
      .map((item): RevisionComparisonItem => ({ itemType, itemId: item.id, status: "possibly_removed" })),
  ];
}

export function compareAnalysisRevisions(
  accepted: AnalysisProposal,
  replacement: AnalysisProposal,
): RevisionComparisonItem[] {
  return [
    ...compareItems(accepted.nodes, replacement.nodes, "node"),
    ...compareItems(accepted.edges, replacement.edges, "edge"),
  ];
}
