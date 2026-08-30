export const NODE_KINDS = [
  "actor",
  "screen",
  "decision",
  "system",
  "data_store",
  "external_system",
  "outcome",
  "possible_gap",
  "unknown_path",
] as const;

export const EDGE_KINDS = [
  "user_action",
  "screen_transition",
  "data_transfer",
  "system_event",
  "validation_result",
  "dependency",
] as const;

export const EVIDENCE_SOURCES = [
  "source_code",
  "test",
  "documentation",
  "screen_capture",
] as const;

export const EVIDENCE_FACTOR_KINDS = [
  "route_declaration",
  "screen_implementation",
  "transition",
  "validation",
  "source_code",
  "test",
  "documentation",
  "screen_capture",
  "source_agreement",
  "conflict",
  "missing_source",
] as const;

export type NodeKind = (typeof NODE_KINDS)[number];
export type EdgeKind = (typeof EDGE_KINDS)[number];
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];
export type EvidenceFactorKind = (typeof EVIDENCE_FACTOR_KINDS)[number];
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type ConfidenceLabel = "confirmed" | "inferred" | "unknown";

export type EvidenceReference = {
  path: string;
  startLine: number;
  endLine: number;
  source: EvidenceSource;
};

export type EvidenceFactor = {
  kind: EvidenceFactorKind;
  strength: EvidenceStrength;
  detail: string;
};

export type AIConfidenceEstimate = {
  score: number;
  label: ConfidenceLabel;
  reason: string;
  traceable: boolean;
};

type AnalysisItem = {
  id: string;
  evidence: readonly EvidenceReference[];
  factors: readonly EvidenceFactor[];
  confidence: AIConfidenceEstimate;
};

export type AnalysisNode = AnalysisItem & {
  kind: NodeKind;
  title: string;
  applicationArea: string;
  flowId?: string;
  flowTitle?: string;
};

export type AnalysisEdge = AnalysisItem & {
  kind: EdgeKind;
  fromId: string;
  toId: string;
  label: string;
};

export type AnalysisProposal = {
  nodes: readonly AnalysisNode[];
  edges: readonly AnalysisEdge[];
};

export type ProposalBatch = AnalysisProposal;

export type RepositoryIndex = {
  files: readonly {
    path: string;
    lineCount?: number;
    hash?: string;
  }[];
};

export type ProposalValidationError = {
  code: string;
  itemType: "node" | "edge";
  itemId: string;
  path: string;
  message: string;
};

export type ApplyProposalBatchResult =
  | { ok: true; proposal: AnalysisProposal }
  | { ok: false; errors: ProposalValidationError[] };

const nodeKinds = new Set<string>(NODE_KINDS);
const edgeKinds = new Set<string>(EDGE_KINDS);
const evidenceSources = new Set<string>(EVIDENCE_SOURCES);
const factorKinds = new Set<string>(EVIDENCE_FACTOR_KINDS);
const factorStrengths = new Set<string>(["weak", "moderate", "strong"]);
const confidenceLabels = new Set<string>(["confirmed", "inferred", "unknown"]);

export function emptyAnalysisProposal(): AnalysisProposal {
  return { nodes: [], edges: [] };
}

const factorWeights: Record<EvidenceFactorKind, number> = {
  route_declaration: 35,
  screen_implementation: 50,
  transition: 35,
  validation: 25,
  source_code: 35,
  test: 20,
  documentation: 10,
  screen_capture: 20,
  source_agreement: 20,
  conflict: -45,
  missing_source: -25,
};

const strengthMultiplier: Record<EvidenceStrength, number> = {
  weak: 0.4,
  moderate: 0.7,
  strong: 1,
};

export function calculateConfidence(
  evidence: readonly EvidenceReference[],
  factors: readonly EvidenceFactor[],
  traceable: boolean,
  reason: string,
): AIConfidenceEstimate {
  if (!traceable) return { score: 0, label: "unknown", reason, traceable };
  const evidenceScore = evidence.reduce((score, item) => score + (
    item.source === "source_code" ? 30 : item.source === "test" ? 10 : item.source === "documentation" ? 5 : 10
  ), 0);
  const factorScore = factors.reduce(
    (score, factor) => score + factorWeights[factor.kind] * strengthMultiplier[factor.strength],
    0,
  );
  let score = Math.max(0, Math.min(100, Math.round(evidenceScore + factorScore)));
  const direct = evidence.some((item) => item.source === "source_code");
  const strongConflict = factors.some((factor) => factor.kind === "conflict" && factor.strength === "strong");
  if (score >= 80 && (!direct || strongConflict)) score = 79;
  const label: ConfidenceLabel = score >= 80 ? "confirmed" : score >= 40 ? "inferred" : "unknown";
  return { score, label, reason, traceable };
}

function addError(
  errors: ProposalValidationError[],
  itemType: "node" | "edge",
  itemId: string,
  code: string,
  path: string,
  message: string,
): void {
  errors.push({ code, itemType, itemId, path, message });
}

function validateEvidence(
  item: AnalysisItem,
  itemType: "node" | "edge",
  itemId: string,
  files: ReadonlyMap<string, RepositoryIndex["files"][number]>,
  errors: ProposalValidationError[],
): void {
  if (!Array.isArray(item.evidence) || item.evidence.length === 0) {
    addError(
      errors,
      itemType,
      itemId,
      "EVIDENCE_REQUIRED",
      "evidence",
      "at least one Evidence reference is required",
    );
    return;
  }

  item.evidence.forEach((evidence, index) => {
    const path = `evidence[${index}]`;
    const indexedFile = files.get(evidence.path);
    if (!indexedFile) {
      addError(
        errors,
        itemType,
        itemId,
        "UNKNOWN_EVIDENCE_PATH",
        `${path}.path`,
        `Evidence path is not in the repository index: ${evidence.path}`,
      );
    }
    if (
      !Number.isInteger(evidence.startLine) ||
      !Number.isInteger(evidence.endLine) ||
      evidence.startLine < 1 ||
      evidence.endLine < evidence.startLine
    ) {
      addError(
        errors,
        itemType,
        itemId,
        "INVALID_EVIDENCE_RANGE",
        path,
        "Evidence lines must be positive integers with startLine <= endLine",
      );
    } else if (
      indexedFile?.lineCount !== undefined &&
      evidence.endLine > indexedFile.lineCount
    ) {
      addError(
        errors,
        itemType,
        itemId,
        "EVIDENCE_RANGE_OUT_OF_BOUNDS",
        path,
        `Evidence ends at line ${evidence.endLine}, but ${evidence.path} has ${indexedFile.lineCount} lines`,
      );
    }
    if (!evidenceSources.has(evidence.source)) {
      addError(
        errors,
        itemType,
        itemId,
        "UNSUPPORTED_EVIDENCE_SOURCE",
        `${path}.source`,
        `unsupported Evidence source: ${String(evidence.source)}`,
      );
    }
  });
}

function validateFactors(
  item: AnalysisItem,
  itemType: "node" | "edge",
  itemId: string,
  errors: ProposalValidationError[],
): void {
  if (!Array.isArray(item.factors) || item.factors.length === 0) {
    addError(
      errors,
      itemType,
      itemId,
      "EVIDENCE_FACTORS_REQUIRED",
      "factors",
      "at least one Evidence Factor is required",
    );
    return;
  }
  item.factors.forEach((factor, index) => {
    const path = `factors[${index}]`;
    if (!factorKinds.has(factor.kind)) {
      addError(
        errors,
        itemType,
        itemId,
        "UNSUPPORTED_EVIDENCE_FACTOR",
        `${path}.kind`,
        `unsupported Evidence Factor: ${String(factor.kind)}`,
      );
    }
    if (!factorStrengths.has(factor.strength)) {
      addError(
        errors,
        itemType,
        itemId,
        "UNSUPPORTED_EVIDENCE_STRENGTH",
        `${path}.strength`,
        `unsupported Evidence strength: ${String(factor.strength)}`,
      );
    }
    if (!factor.detail.trim()) {
      addError(
        errors,
        itemType,
        itemId,
        "EVIDENCE_FACTOR_DETAIL_REQUIRED",
        `${path}.detail`,
        "Evidence Factor detail is required",
      );
    }
  });
}

function validateConfidence(
  item: AnalysisItem,
  itemType: "node" | "edge",
  itemId: string,
  errors: ProposalValidationError[],
): void {
  const { confidence } = item;
  if (
    !Number.isInteger(confidence.score) ||
    confidence.score < 0 ||
    confidence.score > 100
  ) {
    addError(
      errors,
      itemType,
      itemId,
      "INVALID_CONFIDENCE_SCORE",
      "confidence.score",
      "confidence score must be an integer from 0 to 100",
    );
    return;
  }
  if (!confidenceLabels.has(confidence.label)) {
    addError(
      errors,
      itemType,
      itemId,
      "UNSUPPORTED_CONFIDENCE_LABEL",
      "confidence.label",
      `unsupported confidence label: ${String(confidence.label)}`,
    );
    return;
  }
  if (!confidence.reason.trim()) {
    addError(
      errors,
      itemType,
      itemId,
      "CONFIDENCE_REASON_REQUIRED",
      "confidence.reason",
      "confidence reason is required",
    );
  }

  if (!confidence.traceable) {
    if (confidence.label !== "unknown") {
      addError(
        errors,
        itemType,
        itemId,
        "UNTRACEABLE_PATH_MUST_BE_UNKNOWN",
        "confidence.label",
        "a path with no traceable connection must be unknown",
      );
    }
    return;
  }

  if (confidence.label === "confirmed") {
    if (confidence.score < 80) {
      addError(
        errors,
        itemType,
        itemId,
        "CONFIRMED_SCORE_OUT_OF_RANGE",
        "confidence.score",
        "confirmed requires a score from 80 to 100",
      );
      return;
    }
    if (!item.evidence.some((evidence) => evidence.source === "source_code")) {
      addError(
        errors,
        itemType,
        itemId,
        "CONFIRMED_WITHOUT_DIRECT_EVIDENCE",
        "confidence.label",
        "confirmed requires direct source-code Evidence",
      );
      return;
    }
    if (
      item.factors.some(
        (factor) => factor.kind === "conflict" && factor.strength === "strong",
      )
    ) {
      addError(
        errors,
        itemType,
        itemId,
        "CONFIRMED_WITH_CONFLICT",
        "confidence.label",
        "strong conflicting Evidence prevents a confirmed label",
      );
    }
    return;
  }

  if (confidence.label === "inferred") {
    if (confidence.score < 40 || confidence.score > 79) {
      addError(
        errors,
        itemType,
        itemId,
        "INFERRED_SCORE_OUT_OF_RANGE",
        "confidence.score",
        "inferred requires a score from 40 to 79",
      );
    }
    return;
  }

  if (confidence.score > 39) {
    addError(
      errors,
      itemType,
      itemId,
      "UNKNOWN_SCORE_OUT_OF_RANGE",
      "confidence.score",
      "a traceable unknown path requires a score from 0 to 39",
    );
  }
}

function validateItem(
  item: AnalysisItem,
  itemType: "node" | "edge",
  itemId: string,
  files: ReadonlyMap<string, RepositoryIndex["files"][number]>,
  errors: ProposalValidationError[],
): void {
  validateEvidence(item, itemType, itemId, files, errors);
  validateFactors(item, itemType, itemId, errors);
  validateConfidence(item, itemType, itemId, errors);
}

export function validateProposalBatch(
  proposal: AnalysisProposal,
  batch: ProposalBatch,
  repository: RepositoryIndex,
): ProposalValidationError[] {
  const errors: ProposalValidationError[] = [];
  const files = new Map(repository.files.map((file) => [file.path, file]));
  const nodeIds = new Set(proposal.nodes.map((node) => node.id));
  const edgeIds = new Set(proposal.edges.map((edge) => edge.id));
  const reservedAreaIds = new Set(
    [...proposal.nodes, ...batch.nodes].map((node) => `area:${node.applicationArea}`),
  );
  for (const node of [...proposal.nodes, ...batch.nodes]) {
    reservedAreaIds.add(`flow:${node.flowId?.trim() || "main"}`);
  }
  const canvasIds = new Set([
    ...proposal.nodes.map((node) => node.id),
    ...proposal.edges.map((edge) => edge.id.startsWith("link_") ? edge.id : `link_${edge.id}`),
  ]);

  for (const node of batch.nodes) {
    const itemId = node.id || "(missing node id)";
    if (!node.id.trim()) {
      addError(errors, "node", itemId, "NODE_ID_REQUIRED", "id", "node id is required");
    } else if (nodeIds.has(node.id)) {
      addError(
        errors,
        "node",
        itemId,
        "DUPLICATE_NODE_ID",
        "id",
        `duplicate node id: ${node.id}`,
      );
    } else if (reservedAreaIds.has(node.id)) {
      addError(
        errors,
        "node",
        itemId,
        "RESERVED_CANVAS_ID",
        "id",
        `node id is reserved for an application area: ${node.id}`,
      );
    } else if (canvasIds.has(node.id)) {
      addError(errors, "node", itemId, "CANVAS_ID_CONFLICT", "id", `canvas id already exists: ${node.id}`);
    } else {
      nodeIds.add(node.id);
      canvasIds.add(node.id);
    }
    if (!nodeKinds.has(node.kind)) {
      addError(
        errors,
        "node",
        itemId,
        "UNSUPPORTED_NODE_KIND",
        "kind",
        `unsupported node kind: ${String(node.kind)}`,
      );
    }
    if (!node.title.trim()) {
      addError(errors, "node", itemId, "NODE_TITLE_REQUIRED", "title", "node title is required");
    }
    if (!node.applicationArea.trim()) {
      addError(
        errors,
        "node",
        itemId,
        "APPLICATION_AREA_REQUIRED",
        "applicationArea",
        "application area is required",
      );
    }
    validateItem(node, "node", itemId, files, errors);
  }

  for (const edge of batch.edges) {
    const itemId = edge.id || "(missing edge id)";
    if (!edge.id.trim()) {
      addError(errors, "edge", itemId, "EDGE_ID_REQUIRED", "id", "edge id is required");
    } else if (edgeIds.has(edge.id)) {
      addError(
        errors,
        "edge",
        itemId,
        "DUPLICATE_EDGE_ID",
        "id",
        `duplicate edge id: ${edge.id}`,
      );
    } else {
      edgeIds.add(edge.id);
      const canvasId = edge.id.startsWith("link_") ? edge.id : `link_${edge.id}`;
      if (reservedAreaIds.has(canvasId) || canvasIds.has(canvasId)) {
        addError(errors, "edge", itemId, "CANVAS_ID_CONFLICT", "id", `canvas id already exists: ${canvasId}`);
      } else {
        canvasIds.add(canvasId);
      }
    }
    if (!edgeKinds.has(edge.kind)) {
      addError(
        errors,
        "edge",
        itemId,
        "UNSUPPORTED_EDGE_KIND",
        "kind",
        `unsupported edge kind: ${String(edge.kind)}`,
      );
    }
    if (!edge.label.trim()) {
      addError(errors, "edge", itemId, "EDGE_LABEL_REQUIRED", "label", "edge label is required");
    }
    if (!nodeIds.has(edge.fromId)) {
      addError(
        errors,
        "edge",
        itemId,
        "UNKNOWN_EDGE_ENDPOINT",
        "fromId",
        `unknown edge endpoint: ${edge.fromId}`,
      );
    }
    if (!nodeIds.has(edge.toId)) {
      addError(
        errors,
        "edge",
        itemId,
        "UNKNOWN_EDGE_ENDPOINT",
        "toId",
        `unknown edge endpoint: ${edge.toId}`,
      );
    }
    validateItem(edge, "edge", itemId, files, errors);
  }

  return errors;
}

export function applyProposalBatch(
  proposal: AnalysisProposal,
  batch: ProposalBatch,
  repository: RepositoryIndex,
): ApplyProposalBatchResult {
  const errors = validateProposalBatch(proposal, batch, repository);
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    proposal: {
      nodes: [...proposal.nodes, ...batch.nodes],
      edges: [...proposal.edges, ...batch.edges],
    },
  };
}
