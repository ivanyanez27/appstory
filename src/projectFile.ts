import { applyProposalBatch, emptyAnalysisProposal, type AnalysisProposal } from "./analysis";
import { parseProposalBatch } from "./appStory";
import { groupFlows } from "./flows";
import { applyGapReview, type GapReviewMap } from "./gapReview";
import { isValidGitHubRepositoryIdentity } from "./github";

export const MAX_PROJECT_FILE_BYTES = 5_000_000;

type RepositoryIdentity =
  | { source: "github"; revision: { owner: string; repo: string; commitSha: string; ref?: string; subdir?: string } }
  | { source: "local"; revision: { repo: string; commitSha: string } };

export type AppStoryProject = {
  projectName: string;
  repository: RepositoryIdentity;
  acceptedAnalysis: AnalysisProposal;
  gapReviews: GapReviewMap;
  expandedFlowIds: string[];
};

type AppStoryProjectFile = AppStoryProject & { format: "app-story.project"; version: 1 };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseRepository(value: unknown): RepositoryIdentity | null {
  if (!record(value) || !record(value.revision) || !["github", "local"].includes(String(value.source))) return null;
  const revision = value.revision;
  if (typeof revision.repo !== "string" || !revision.repo.trim() || revision.repo.length > 100 ||
      typeof revision.commitSha !== "string" || !/^[a-f0-9]{40}$/i.test(revision.commitSha)) return null;
  if (value.source === "local") return { source: "local", revision: { repo: revision.repo, commitSha: revision.commitSha } };
  if (typeof revision.owner !== "string" || !isValidGitHubRepositoryIdentity(revision.owner, revision.repo)) return null;
  return {
    source: "github",
    revision: {
      owner: revision.owner,
      repo: revision.repo,
      commitSha: revision.commitSha,
      ...(typeof revision.ref === "string" ? { ref: revision.ref } : {}),
      ...(typeof revision.subdir === "string" ? { subdir: revision.subdir } : {}),
    },
  };
}

function parseAnalysis(value: unknown): AnalysisProposal | null {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 200 || value.edges.length > 300) return null;
  const nodes = [];
  const edges = [];
  for (let start = 0; start < value.nodes.length; start += 50) {
    const parsed = parseProposalBatch({ nodes: value.nodes.slice(start, start + 50), edges: [] });
    if (!parsed.ok) return null;
    nodes.push(...parsed.batch.nodes);
  }
  for (let start = 0; start < value.edges.length; start += 100) {
    const parsed = parseProposalBatch({ nodes: [], edges: value.edges.slice(start, start + 100) });
    if (!parsed.ok) return null;
    edges.push(...parsed.batch.edges);
  }
  const lineCounts = new Map<string, number>();
  for (const item of [...nodes, ...edges]) {
    for (const evidence of item.evidence) lineCounts.set(evidence.path, Math.max(lineCounts.get(evidence.path) ?? 0, evidence.endLine));
  }
  const result = applyProposalBatch(emptyAnalysisProposal(), { nodes, edges }, {
    files: [...lineCounts].map(([path, lineCount]) => ({ path, lineCount })),
  });
  return result.ok ? result.proposal : null;
}

export function serializeProjectFile(project: AppStoryProject): string {
  return JSON.stringify({ format: "app-story.project", version: 1, ...project } satisfies AppStoryProjectFile, null, 2);
}

export function parseProjectFile(text: string): { ok: true; project: AppStoryProject } | { ok: false; error: string } {
  if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_FILE_BYTES) return { ok: false, error: "Project File is larger than 5 MB." };
  try {
    const value: unknown = JSON.parse(text);
    if (!record(value) || value.format !== "app-story.project" || value.version !== 1 ||
        typeof value.projectName !== "string" || !value.projectName.trim() || value.projectName.length > 200) {
      return { ok: false, error: "Project File format is invalid." };
    }
    const repository = parseRepository(value.repository);
    const acceptedAnalysis = parseAnalysis(value.acceptedAnalysis);
    if (!repository || !acceptedAnalysis) return { ok: false, error: "Project File analysis is invalid." };
    if (!record(value.gapReviews) || !Array.isArray(value.expandedFlowIds)) return { ok: false, error: "Project File review data is invalid." };
    let gapReviews: GapReviewMap = {};
    for (const [nodeId, review] of Object.entries(value.gapReviews)) {
      if (!record(review) || review.nodeId !== nodeId || typeof review.status !== "string" || typeof review.impact !== "string" ||
          typeof review.reason !== "string" || (review.reviewer !== undefined && typeof review.reviewer !== "string")) {
        return { ok: false, error: "Project File review data is invalid." };
      }
      gapReviews = applyGapReview(acceptedAnalysis.nodes, gapReviews, {
        nodeId,
        status: review.status as Parameters<typeof applyGapReview>[2]["status"],
        impact: review.impact as Parameters<typeof applyGapReview>[2]["impact"],
        reason: review.reason,
        ...(review.reviewer ? { reviewer: review.reviewer } : {}),
      });
    }
    const flowIds = new Set(groupFlows(acceptedAnalysis).map((flow) => flow.id));
    const expandedFlowIds = value.expandedFlowIds.filter((id): id is string => typeof id === "string" && flowIds.has(id));
    return { ok: true, project: { projectName: value.projectName, repository, acceptedAnalysis, gapReviews, expandedFlowIds } };
  } catch {
    return { ok: false, error: "Project File is invalid." };
  }
}
