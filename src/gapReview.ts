import type { AnalysisNode } from "./analysis";

export const GAP_REVIEW_STATUSES = [
  "possible",
  "confirmed",
  "accepted_risk",
  "not_applicable",
] as const;

export const GAP_IMPACTS = ["low", "medium", "high", "critical"] as const;

export type GapReviewStatus = (typeof GAP_REVIEW_STATUSES)[number];
export type GapImpact = (typeof GAP_IMPACTS)[number];

export type GapReview = Readonly<{
  nodeId: string;
  status: GapReviewStatus;
  impact: GapImpact;
  reason: string;
  reviewer?: string;
  reviewerVerified: false;
}>;

export type GapReviewMap = Readonly<Record<string, GapReview>>;

export type GapReviewRequest = Readonly<{
  nodeId: string;
  status: GapReviewStatus;
  impact: GapImpact;
  reason?: string;
  reviewer?: string;
}>;

const statuses = new Set<string>(GAP_REVIEW_STATUSES);
const impacts = new Set<string>(GAP_IMPACTS);

export function applyGapReview(
  nodes: readonly AnalysisNode[],
  current: GapReviewMap,
  request: GapReviewRequest,
): GapReviewMap {
  if (!statuses.has(request.status)) {
    throw new Error(`Unsupported gap review status: ${String(request.status)}`);
  }
  if (!impacts.has(request.impact)) {
    throw new Error(`Unsupported gap impact: ${String(request.impact)}`);
  }

  const target = nodes.find((node) => node.id === request.nodeId);
  if (!target) throw new Error(`Analysis node not found: ${request.nodeId}`);
  if (target.kind !== "possible_gap" && target.kind !== "unknown_path") {
    throw new Error(
      `Only possible_gap and unknown_path nodes can be reviewed: ${request.nodeId}`,
    );
  }

  const reason = request.reason?.trim() ?? "";
  if (request.status !== "possible" && !reason) {
    throw new Error(`A reason is required when changing a gap to ${request.status}.`);
  }

  const reviewer = request.reviewer?.trim();
  const review = Object.freeze({
    nodeId: request.nodeId,
    status: request.status,
    impact: request.impact,
    reason,
    ...(reviewer ? { reviewer } : {}),
    reviewerVerified: false as const,
  });

  return Object.freeze({
    ...Object.fromEntries(
      Object.entries(current).map(([nodeId, value]) => [nodeId, Object.freeze({ ...value })]),
    ),
    [request.nodeId]: review,
  });
}
