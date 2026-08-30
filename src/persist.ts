import type { AnalysisProposal } from "./analysis";
import type { RepositoryIndex } from "./github";
import type { GapReviewMap } from "./gapReview";

export const STORAGE_KEY = "lsw.v1";
export const APP_STORY_STORAGE_KEY = "app-story.v1";

export type PersistPayload = {
  v: 1;
  worldName: string;
  snapshot: unknown;
};

export function load(storage: Storage): PersistPayload | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as PersistPayload).v !== 1 ||
      typeof (parsed as PersistPayload).worldName !== "string"
    ) {
      return null;
    }
    return parsed as PersistPayload;
  } catch {
    return null;
  }
}

export function save(
  storage: Storage,
  payload: PersistPayload,
): { ok: true } | { ok: false } {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type AppStoryPersistPayload = {
  v: 1;
  projectName: string;
  snapshot: unknown;
  repositoryIndex: RepositoryIndex | null;
  consent: boolean;
  acceptedAnalysis: AnalysisProposal;
  proposal: AnalysisProposal;
  finalized: boolean;
  readRecords: Array<{
    id: string;
    path: string;
    reason: string;
    size: number;
    time: string;
    totalLines: number;
    startLine: number;
    endLine: number;
  }>;
  analysisSessionId: string | null;
  gapReviews: GapReviewMap;
  expandedFlowIds: string[];
  repositorySource: "github" | "local" | null;
};

function withoutLocalRepositoryData(payload: AppStoryPersistPayload): AppStoryPersistPayload {
  return payload.repositorySource === "local"
    ? { ...payload, repositoryIndex: null, consent: false, readRecords: [] }
    : payload;
}

export function loadAppStory(storage: Storage): AppStoryPersistPayload | null {
  try {
    const raw = storage.getItem(APP_STORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppStoryPersistPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.projectName !== "string" ||
      typeof parsed.consent !== "boolean" ||
      !parsed.acceptedAnalysis ||
      !Array.isArray(parsed.acceptedAnalysis.nodes) ||
      !Array.isArray(parsed.acceptedAnalysis.edges) ||
      !parsed.proposal ||
      !Array.isArray(parsed.proposal.nodes) ||
      !Array.isArray(parsed.proposal.edges) ||
      typeof parsed.finalized !== "boolean" ||
      !Array.isArray(parsed.readRecords) ||
      !(typeof parsed.analysisSessionId === "string" || parsed.analysisSessionId === null) ||
      !parsed.gapReviews ||
      typeof parsed.gapReviews !== "object" ||
      !Array.isArray(parsed.expandedFlowIds)
      || !["github", "local", null].includes(parsed.repositorySource ?? null)
    ) {
      return null;
    }
    return withoutLocalRepositoryData(parsed as AppStoryPersistPayload);
  } catch {
    return null;
  }
}

export function saveAppStory(
  storage: Storage,
  payload: AppStoryPersistPayload,
): { ok: true } | { ok: false } {
  try {
    storage.setItem(APP_STORY_STORAGE_KEY, JSON.stringify(withoutLocalRepositoryData(payload)));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function deleteAppStory(storage: Storage): void {
  storage.removeItem(APP_STORY_STORAGE_KEY);
}
