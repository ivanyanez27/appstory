import { describe, expect, it } from "vitest";
import type { AnalysisNode, AnalysisProposal } from "./analysis";
import { groupFlows, visibleFlowNodeIds } from "./flows";

type FlowNode = AnalysisNode & { flowId?: string; flowTitle?: string };

function node(id: string, flowId?: string, flowTitle?: string): FlowNode {
  return {
    id,
    kind: "screen",
    title: id,
    applicationArea: "Web",
    evidence: [{ path: "src/App.tsx", startLine: 1, endLine: 1, source: "source_code" }],
    factors: [{ kind: "screen_implementation", strength: "strong", detail: "Rendered screen" }],
    confidence: { score: 80, label: "confirmed", reason: "Direct source", traceable: true },
    ...(flowId ? { flowId } : {}),
    ...(flowTitle ? { flowTitle } : {}),
  };
}

function proposal(nodes: readonly FlowNode[], edges: AnalysisProposal["edges"] = []): AnalysisProposal {
  return { nodes, edges };
}

const edge = {
  id: "edge:sign-in",
  kind: "screen_transition" as const,
  fromId: "screen:sign-in",
  toId: "screen:home",
  label: "Success",
  evidence: [{ path: "src/App.tsx", startLine: 1, endLine: 1, source: "source_code" as const }],
  factors: [{ kind: "transition" as const, strength: "strong" as const, detail: "Direct transition" }],
  confidence: { score: 80, label: "confirmed" as const, reason: "Direct source", traceable: true },
};

describe("groupFlows", () => {
  it("returns no groups for an empty proposal", () => {
    expect(groupFlows(proposal([]))).toEqual([]);
  });

  it("infers one main flow when nodes have no explicit flow", () => {
    expect(groupFlows(proposal([
      node("screen:sign-in"),
      node("screen:home"),
    ], [edge]))).toEqual([{
      id: "main",
      title: "Main flow",
      nodeIds: ["screen:sign-in", "screen:home"],
      edgeIds: ["edge:sign-in"],
    }]);
  });

  it("uses explicit flow IDs and titles and keeps unassigned nodes in main", () => {
    const groups = groupFlows(proposal([
      node("screen:sign-in", "authentication", "Authentication"),
      node("screen:home", "home", "Home"),
      node("screen:settings"),
    ], [edge]));

    expect(groups).toEqual([
      { id: "authentication", title: "Authentication", nodeIds: ["screen:sign-in"], edgeIds: [] },
      { id: "home", title: "Home", nodeIds: ["screen:home"], edgeIds: [] },
      { id: "main", title: "Main flow", nodeIds: ["screen:settings"], edgeIds: [] },
    ]);
  });
});

describe("flow visibility", () => {
  const groups = [
    { id: "authentication", title: "Authentication", nodeIds: ["screen:sign-in", "screen:shared"], edgeIds: [] },
    { id: "home", title: "Home", nodeIds: ["screen:home", "screen:shared"], edgeIds: [] },
  ];
  it("shows no discovered nodes for collapsed flows", () => {
    expect(visibleFlowNodeIds(groups, new Set())).toEqual([]);
  });

  it("returns canonical node IDs once when expanded flows share a reference", () => {
    expect(visibleFlowNodeIds(groups, new Set(["authentication", "home"]))).toEqual([
      "screen:sign-in",
      "screen:shared",
      "screen:home",
    ]);
  });
});
