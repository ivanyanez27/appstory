import type { AnalysisNode, AnalysisProposal } from "./analysis";

export type UIFlowGroup = {
  id: string;
  title: string;
  nodeIds: readonly string[];
  edgeIds: readonly string[];
};

type FlowMetadata = {
  flowId?: unknown;
  flowTitle?: unknown;
};

function flowMetadata(node: AnalysisNode): { id: string; title: string } {
  // ponytail: one flowId permits one primary flow per node; add flowIds only when discovery must assign several flows.
  const metadata = node as AnalysisNode & FlowMetadata;
  const id = typeof metadata.flowId === "string" && metadata.flowId.trim()
    ? metadata.flowId.trim()
    : "main";
  const title = typeof metadata.flowTitle === "string" && metadata.flowTitle.trim()
    ? metadata.flowTitle.trim()
    : id === "main" ? "Main flow" : id;
  return { id, title };
}

export function groupFlows(proposal: AnalysisProposal): UIFlowGroup[] {
  const groups = new Map<string, { id: string; title: string; nodeIds: string[]; edgeIds: string[] }>();
  const flowByNode = new Map<string, string>();

  for (const node of proposal.nodes) {
    const flow = flowMetadata(node);
    const group = groups.get(flow.id) ?? { ...flow, nodeIds: [], edgeIds: [] };
    group.nodeIds.push(node.id);
    groups.set(flow.id, group);
    flowByNode.set(node.id, flow.id);
  }

  for (const edge of proposal.edges) {
    const flowId = flowByNode.get(edge.fromId);
    if (flowId && flowId === flowByNode.get(edge.toId)) groups.get(flowId)?.edgeIds.push(edge.id);
  }

  return [...groups.values()];
}

export function visibleFlowNodeIds(
  groups: readonly UIFlowGroup[],
  expandedFlowIds: ReadonlySet<string>,
): string[] {
  const visible = new Set<string>();
  for (const group of groups) {
    if (!expandedFlowIds.has(group.id)) continue;
    for (const nodeId of group.nodeIds) visible.add(nodeId);
  }
  return [...visible];
}

export function visibleFlowEdgeIds(
  proposal: AnalysisProposal,
  visibleNodeIds: readonly string[],
): string[] {
  const visible = new Set(visibleNodeIds);
  return proposal.edges
    .filter((edge) => visible.has(edge.fromId) && visible.has(edge.toId))
    .map((edge) => edge.id);
}
