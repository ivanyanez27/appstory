import { describe, expect, it } from "vitest";
import type { AnalysisNode, AnalysisProposal } from "./analysis";
import { compareAnalysisRevisions } from "./revisionComparison";

const evidence = [{ path: "src/App.tsx", startLine: 1, endLine: 3, source: "source_code" as const }];
const factors = [{ kind: "screen_implementation" as const, strength: "strong" as const, detail: "Rendered Screen." }];
const confidence = { score: 90, label: "confirmed" as const, reason: "Direct source.", traceable: true };

function node(id: string, title = id): AnalysisNode {
  return { id, kind: "screen", title, applicationArea: "web", evidence, factors, confidence };
}

describe("revision comparison", () => {
  it("classifies complete replacement facts by stable identity", () => {
    const accepted: AnalysisProposal = {
      nodes: [node("same"), node("changed", "Old"), node("removed")],
      edges: [{ id: "removed-edge", kind: "screen_transition", fromId: "same", toId: "removed", label: "Open", evidence, factors: [{ ...factors[0], kind: "transition" }], confidence }],
    };
    const replacement: AnalysisProposal = {
      nodes: [node("same"), node("changed", "New"), node("added")],
      edges: [],
    };

    expect(compareAnalysisRevisions(accepted, replacement)).toEqual([
      { itemType: "node", itemId: "same", status: "unchanged" },
      { itemType: "node", itemId: "changed", status: "changed" },
      { itemType: "node", itemId: "added", status: "added" },
      { itemType: "node", itemId: "removed", status: "possibly_removed" },
      { itemType: "edge", itemId: "removed-edge", status: "possibly_removed" },
    ]);
  });
});
