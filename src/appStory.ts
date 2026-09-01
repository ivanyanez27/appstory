import {
  EDGE_KINDS,
  EVIDENCE_FACTOR_KINDS,
  EVIDENCE_SOURCES,
  NODE_KINDS,
  type AnalysisEdge,
  type AnalysisNode,
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

const CARD_W = 300;
const CARD_H = 180;
const NOTE_W = 270;
const NOTE_H = 140;
const FLOW_PADDING = 80;
const COLUMN_PITCH = 440;
const ROW_PITCH = 320;

type FlowLayout = {
  positions: ReadonlyMap<string, { x: number; y: number }>;
  w: number;
  h: number;
};

function isGap(node: AnalysisNode): boolean {
  return node.kind === "possible_gap" || node.kind === "unknown_path";
}

function cardSize(node: AnalysisNode): { w: number; h: number } {
  return isGap(node) ? { w: NOTE_W, h: NOTE_H } : { w: CARD_W, h: CARD_H };
}

function flowLayout(nodes: readonly AnalysisNode[], edges: readonly AnalysisEdge[]): FlowLayout {
  if (!nodes.length) return { positions: new Map(), w: 340, h: 120 };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const mainNodes = nodes.filter((node) => !isGap(node));
  const mainNodeIds = new Set(mainNodes.map((node) => node.id));
  const outgoing = new Map(mainNodes.map((node) => [node.id, [] as string[]]));
  const indegree = new Map(mainNodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!outgoing.has(edge.fromId) || !indegree.has(edge.toId)) continue;
    outgoing.get(edge.fromId)!.push(edge.toId);
    indegree.set(edge.toId, indegree.get(edge.toId)! + 1);
  }

  const rank = new Map<string, number>();
  const queue = mainNodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  for (const id of queue) rank.set(id, 0);
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    const nextRank = (rank.get(id) ?? 0) + 1;
    for (const nextId of outgoing.get(id) ?? []) {
      rank.set(nextId, Math.max(rank.get(nextId) ?? 0, nextRank));
      const remaining = indegree.get(nextId)! - 1;
      indegree.set(nextId, remaining);
      if (remaining === 0) queue.push(nextId);
    }
  }

  // A cycle is not a user journey, but it must still render. Keep its cards
  // below the known path instead of failing to lay out the whole flow.
  let fallbackRank = Math.max(0, ...rank.values()) + 1;
  for (const node of mainNodes) {
    if (!rank.has(node.id)) rank.set(node.id, fallbackRank++);
  }

  const nodesByRank = new Map<number, AnalysisNode[]>();
  for (const node of mainNodes) {
    const level = rank.get(node.id) ?? 0;
    const row = nodesByRank.get(level) ?? [];
    row.push(node);
    nodesByRank.set(level, row);
  }

  const gapsByAnchor = new Map<string, AnalysisNode[]>();
  const unanchoredGaps: AnalysisNode[] = [];
  for (const gap of nodes.filter(isGap)) {
    const anchorId = edges.find((edge) => edge.fromId === gap.id && mainNodeIds.has(edge.toId))?.toId
      ?? edges.find((edge) => edge.toId === gap.id && mainNodeIds.has(edge.fromId))?.fromId;
    if (!anchorId) {
      unanchoredGaps.push(gap);
      continue;
    }
    const attached = gapsByAnchor.get(anchorId) ?? [];
    attached.push(gap);
    gapsByAnchor.set(anchorId, attached);
  }

  for (const [level, row] of nodesByRank) {
    const withGaps: AnalysisNode[] = [];
    for (const node of row) {
      if (withGaps.length % 2) withGaps.push(...(gapsByAnchor.get(node.id) ?? []));
      withGaps.push(node);
      if (withGaps.length % 2 === 1) withGaps.push(...(gapsByAnchor.get(node.id) ?? []));
    }
    nodesByRank.set(level, withGaps);
  }
  if (unanchoredGaps.length) {
    const level = Math.max(0, ...nodesByRank.keys()) + 1;
    nodesByRank.set(level, unanchoredGaps);
  }

  const rawPositions = new Map<string, { x: number; y: number }>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [level, row] of nodesByRank) {
    // ponytail: fixed rank ordering; add crossing reduction only if large flows make connections hard to follow.
    for (const [index, node] of row.entries()) {
      const { w, h } = cardSize(node);
      const x = (index - (row.length - 1) / 2) * COLUMN_PITCH;
      const y = level * ROW_PITCH;
      rawPositions.set(node.id, { x, y });
      minX = Math.min(minX, x - w / 2);
      maxX = Math.max(maxX, x + w / 2);
      minY = Math.min(minY, y - h / 2);
      maxY = Math.max(maxY, y + h / 2);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [id, position] of rawPositions) {
    const node = nodeById.get(id)!;
    const { w, h } = cardSize(node);
    positions.set(id, {
      x: position.x - w / 2 - minX + FLOW_PADDING,
      y: position.y - h / 2 - minY + FLOW_PADDING,
    });
  }
  return {
    positions,
    w: Math.max(340, maxX - minX + FLOW_PADDING * 2),
    h: Math.max(240, maxY - minY + FLOW_PADDING * 2),
  };
}

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
  const visibleNodes = proposal.nodes.filter(
    (node) => flowVisibleIds.has(node.id) && (!technicalKinds.has(node.kind) || technicalIds.has(node.id)),
  );
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const nodesByFlow = new Map<string, typeof visibleNodes>();
  for (const node of visibleNodes) {
    const flowId = node.flowId?.trim() || "main";
    const list = nodesByFlow.get(flowId) ?? [];
    list.push(node);
    nodesByFlow.set(flowId, list);
  }

  const layouts = new Map(flows.map((flow) => {
    const nodes = nodesByFlow.get(flow.id) ?? [];
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = proposal.edges.filter((edge) => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId));
    return [flow.id, flowLayout(nodes, edges)];
  }));

  const flowPositions = new Map<string, { x: number; y: number }>();
  let rowY = 0;
  let firstColumnWidth = 0;
  let rowHeight = 0;
  for (const [index, flow] of flows.entries()) {
    if (index > 0 && index % 2 === 0) {
      rowY += rowHeight + 160;
      firstColumnWidth = 0;
      rowHeight = 0;
    }
    const layout = layouts.get(flow.id)!;
    const w = expanded.has(flow.id) ? layout.w : 340;
    const h = expanded.has(flow.id) ? layout.h : 120;
    const x = index % 2 === 0 ? 0 : firstColumnWidth + 160;
    flowPositions.set(flow.id, { x, y: rowY });
    if (index % 2 === 0) firstColumnWidth = w;
    rowHeight = Math.max(rowHeight, h);
  }

  const cards: World["cards"] = flows.map((flow) => {
    const layout = layouts.get(flow.id)!;
    const position = flowPositions.get(flow.id)!;
    return {
      id: `flow:${flow.id}`,
      type: "region",
      name: expanded.has(flow.id) ? flow.title : `${flow.title} · collapsed`,
      summary: "UI Flow",
      imageUrl: null,
      x: position.x,
      y: position.y,
      w: expanded.has(flow.id) ? layout.w : 340,
      h: expanded.has(flow.id) ? layout.h : 120,
    };
  });

  for (const node of visibleNodes) {
    const flowId = node.flowId?.trim() || "main";
    const type = TYPE_BY_NODE[node.kind];
    const flowPosition = flowPositions.get(flowId)!;
    const position = layouts.get(flowId)!.positions.get(node.id)!;
    const { w, h } = cardSize(node);
    cards.push({
      id: node.id,
      type,
      name: node.title,
      summary: `${node.applicationArea} · ${node.kind.replaceAll("_", " ")} · ${node.confidence.label[0].toUpperCase()}${node.confidence.label.slice(1)} · ${node.confidence.score}% · ${node.evidence.length} source${node.evidence.length === 1 ? "" : "s"}`,
      imageUrl: null,
      x: flowPosition.x + position.x,
      y: flowPosition.y + position.y,
      w,
      h,
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
