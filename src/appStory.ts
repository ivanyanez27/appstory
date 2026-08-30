import {
  EDGE_KINDS,
  EVIDENCE_FACTOR_KINDS,
  EVIDENCE_SOURCES,
  NODE_KINDS,
  type AnalysisProposal,
  type ProposalBatch,
} from "./analysis";
import type { IndexedRepositoryFile } from "./github";
import { groupFlows, visibleFlowNodeIds } from "./flows";
import type { CardType, World } from "./world";

const nodeKinds = new Set<string>(NODE_KINDS);
const edgeKinds = new Set<string>(EDGE_KINDS);
const evidenceSources = new Set<string>(EVIDENCE_SOURCES);
const factorKinds = new Set<string>(EVIDENCE_FACTOR_KINDS);

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validEvidence(value: unknown): boolean {
  return record(value) &&
    typeof value.path === "string" &&
    typeof value.startLine === "number" &&
    typeof value.endLine === "number" &&
    typeof value.source === "string" && evidenceSources.has(value.source);
}

function validFactor(value: unknown): boolean {
  return record(value) &&
    typeof value.kind === "string" && factorKinds.has(value.kind) &&
    ["weak", "moderate", "strong"].includes(String(value.strength)) &&
    typeof value.detail === "string";
}

function validConfidence(value: unknown): boolean {
  return record(value) &&
    typeof value.score === "number" &&
    ["confirmed", "inferred", "unknown"].includes(String(value.label)) &&
    typeof value.reason === "string" &&
    typeof value.traceable === "boolean";
}

function validCommon(value: Record<string, unknown>): boolean {
  return typeof value.id === "string" &&
    Array.isArray(value.evidence) && value.evidence.length <= 10 && value.evidence.every(validEvidence) &&
    Array.isArray(value.factors) && value.factors.length <= 20 && value.factors.every(validFactor) &&
    validConfidence(value.confidence);
}

export function parseProposalBatch(
  value: unknown,
): { ok: true; batch: ProposalBatch } | { ok: false; error: string } {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return { ok: false, error: "Proposal batch does not match the required schema." };
  }
  if (value.nodes.length > 50 || value.edges.length > 100) {
    return { ok: false, error: "Proposal batches are limited to 50 nodes and 100 connections." };
  }
  const nodesValid = value.nodes.every((node) =>
    record(node) && validCommon(node) && typeof node.kind === "string" &&
    nodeKinds.has(node.kind) && typeof node.title === "string" &&
    typeof node.applicationArea === "string" &&
    (node.flowId === undefined || (typeof node.flowId === "string" && Boolean(node.flowId.trim()))) &&
    (node.flowTitle === undefined || (typeof node.flowTitle === "string" && Boolean(node.flowTitle.trim())))
  );
  const edgesValid = value.edges.every((edge) =>
    record(edge) && validCommon(edge) && typeof edge.kind === "string" &&
    edgeKinds.has(edge.kind) && typeof edge.fromId === "string" &&
    typeof edge.toId === "string" && typeof edge.label === "string"
  );
  return nodesValid && edgesValid
    ? { ok: true, batch: value as ProposalBatch }
    : { ok: false, error: "Proposal batch does not match the required schema." };
}

export function searchRepositoryFiles(
  files: readonly IndexedRepositoryFile[],
  query: string,
  limit = 50,
): IndexedRepositoryFile[] {
  const needle = query.trim().toLowerCase();
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return files
    .filter((file) => file.eligibility.eligible && file.path.toLowerCase().includes(needle))
    .slice(0, safeLimit);
}

export type ReadWindow = { path: string; startLine: number; endLine: number };

export function mayExposeRepositoryIndex(source: "github" | "local" | null, consent: boolean): boolean {
  return source !== "local" || consent;
}

export function findUnreadEvidence(
  proposal: AnalysisProposal,
  windows: readonly ReadWindow[],
): Array<{ itemId: string; path: string; startLine: number; endLine: number }> {
  // Merge each path's read windows into maximal ranges first. An agent hits the
  // 500-line read cap on a long file and reads it in adjacent chunks; evidence
  // that spans a chunk boundary was fully read even though no single window
  // contains it.
  const readRanges = new Map<string, Array<[number, number]>>();
  for (const window of windows) {
    const list = readRanges.get(window.path) ?? [];
    list.push([window.startLine, window.endLine]);
    readRanges.set(window.path, list);
  }
  for (const [path, list] of readRanges) {
    list.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of list) {
      const last = merged.at(-1);
      if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    readRanges.set(path, merged);
  }
  const wasRead = (path: string, startLine: number, endLine: number): boolean =>
    (readRanges.get(path) ?? []).some(
      ([start, end]) => start <= startLine && end >= endLine,
    );
  return [...proposal.nodes, ...proposal.edges].flatMap((item) =>
    item.evidence
      .filter((evidence) => !wasRead(evidence.path, evidence.startLine, evidence.endLine))
      .map((evidence) => ({ itemId: item.id, path: evidence.path, startLine: evidence.startLine, endLine: evidence.endLine })),
  );
}

const TYPE_BY_NODE: Record<(typeof NODE_KINDS)[number], CardType> = {
  actor: "character",
  screen: "place",
  decision: "plot",
  system: "place",
  data_store: "place",
  external_system: "place",
  outcome: "plot",
  possible_gap: "note",
  unknown_path: "note",
};

export function proposalToWorld(
  proposal: AnalysisProposal,
  name: string,
  technicalRootId?: string,
  expandedFlowIds?: ReadonlySet<string>,
): World {
  const flows = groupFlows(proposal);
  const expanded = expandedFlowIds ?? new Set(flows.map((flow) => flow.id));
  const flowVisibleIds = new Set(visibleFlowNodeIds(flows, expanded));
  const technicalKinds = new Set(["system", "data_store", "external_system"]);
  const technicalIds = new Set<string>();
  if (technicalRootId) {
    const queue = [technicalRootId];
    const visited = new Set(queue);
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of proposal.edges) {
        const other = edge.fromId === current ? edge.toId : edge.toId === current ? edge.fromId : null;
        if (!other || visited.has(other)) continue;
        const node = proposal.nodes.find((candidate) => candidate.id === other);
        if (!node || !technicalKinds.has(node.kind)) continue;
        visited.add(other);
        technicalIds.add(other);
        queue.push(other);
      }
    }
  }
  // Canvas layout. The column pitch leaves room between cards for an arrow
  // label: tldraw wraps a label to the arrow's length, and at the previous
  // 40px gap "connect()" broke across three lines.
  const CARD_W = 260;
  const NOTE_W = 240;
  const COLUMNS = 3;
  const COLUMN_PITCH = 380;
  const ROW_PITCH = 240;
  const FLOW_PADDING = 40;
  const FLOW_W = (COLUMNS - 1) * COLUMN_PITCH + CARD_W + FLOW_PADDING * 2;
  const FLOW_PITCH = FLOW_W + 120;

  const visibleNodes = proposal.nodes.filter(
    (node) => flowVisibleIds.has(node.id) && (!technicalKinds.has(node.kind) || technicalIds.has(node.id)),
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));

  // Group the visible nodes by flow once. Both loops below need per-flow
  // ordering; recomputing it per node made this O(V²) on every canvas render.
  const flowIndexById = new Map(flows.map((flow, index) => [flow.id, index]));
  const nodesByFlow = new Map<string, typeof visibleNodes>();
  const localIndexById = new Map<string, number>();
  for (const node of visibleNodes) {
    const flowId = node.flowId?.trim() || "main";
    const list = nodesByFlow.get(flowId) ?? [];
    localIndexById.set(node.id, list.length);
    list.push(node);
    nodesByFlow.set(flowId, list);
  }

  const cards: World["cards"] = flows.map((flow, flowIndex) => ({
    id: `flow:${flow.id}`,
    type: "region",
    name: expanded.has(flow.id) ? flow.title : `${flow.title} · collapsed`,
    summary: "UI Flow",
    imageUrl: null,
    x: flowIndex * FLOW_PITCH - FLOW_PADDING,
    y: -FLOW_PADDING,
    w: expanded.has(flow.id) ? FLOW_W : 340,
    h: expanded.has(flow.id)
      ? Math.max(420, Math.ceil((nodesByFlow.get(flow.id)?.length ?? 0) / COLUMNS) * ROW_PITCH + 100)
      : 120,
  }));

  for (const node of visibleNodes) {
    const flowId = node.flowId?.trim() || "main";
    const flowIndex = Math.max(0, flowIndexById.get(flowId) ?? -1);
    const localIndex = localIndexById.get(node.id) ?? 0;
    const type = TYPE_BY_NODE[node.kind];
    cards.push({
      id: node.id,
      type,
      name: node.title,
      summary: `${node.applicationArea} · ${node.kind.replaceAll("_", " ")} · ${node.confidence.label[0].toUpperCase()}${node.confidence.label.slice(1)} · ${node.confidence.score}% · ${node.evidence.length} source${node.evidence.length === 1 ? "" : "s"}`,
      imageUrl: null,
      x: flowIndex * FLOW_PITCH + (localIndex % COLUMNS) * COLUMN_PITCH,
      y: Math.floor(localIndex / COLUMNS) * ROW_PITCH + 60,
      w: type === "note" ? NOTE_W : CARD_W,
      h: type === "note" ? 120 : 150,
    });
  }

  return {
    name,
    cards,
    links: proposal.edges.filter((edge) => visibleIds.has(edge.fromId) && visibleIds.has(edge.toId)).map((edge) => ({
      id: edge.id.startsWith("link_") ? edge.id : `link_${edge.id}`,
      fromId: edge.fromId,
      toId: edge.toId,
      label: edge.label,
    })),
  };
}
