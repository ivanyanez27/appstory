import { describe, expect, it } from "vitest";
import {
  APP_STORY_STORAGE_KEY,
  STORAGE_KEY,
  deleteAppStory,
  load,
  loadAppStory,
  save,
  saveAppStory,
  type AppStoryPersistPayload,
  type PersistPayload,
} from "./persist";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  const store: Storage = {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    getItem(key: string) {
      return key in data ? data[key] : null;
    },
    key(index: number) {
      return Object.keys(data)[index] ?? null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
  return { store, data };
}

describe("persist", () => {
  it("round-trips a payload", () => {
    const { store } = memoryStorage();
    const payload: PersistPayload = {
      v: 1,
      worldName: "Eldoria",
      snapshot: { document: { store: {} }, session: {} },
    };
    expect(save(store, payload)).toEqual({ ok: true });
    expect(load(store)).toEqual(payload);
  });

  it("returns null for missing and corrupt JSON", () => {
    expect(load(memoryStorage().store)).toBeNull();
    const { store } = memoryStorage({ [STORAGE_KEY]: "{not-json" });
    expect(load(store)).toBeNull();
  });

  it("returns ok false on quota errors", () => {
    const { store } = memoryStorage();
    store.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(save(store, { v: 1, worldName: "X", snapshot: {} })).toEqual({
      ok: false,
    });
  });
});

describe("App Story persistence", () => {
  it("does not persist private local repository metadata", () => {
    const { store, data } = memoryStorage();
    const payload = {
      v: 1 as const,
      projectName: "local-app",
      snapshot: {},
      repositoryIndex: { revision: { owner: "local", repo: "private", commitSha: "a".repeat(40) }, files: [], truncated: false },
      consent: true,
      acceptedAnalysis: { nodes: [], edges: [] },
      proposal: { nodes: [], edges: [] },
      finalized: false,
      readRecords: [{ id: "1", path: "secret/path.ts", reason: "analysis", size: 1, time: "now", totalLines: 1, startLine: 1, endLine: 1 }],
      analysisSessionId: null,
      gapReviews: {},
      expandedFlowIds: [],
      repositorySource: "local" as const,
    };

    saveAppStory(store, payload);

    expect(data[APP_STORY_STORAGE_KEY]).not.toContain("secret/path.ts");
    expect(loadAppStory(store)).toMatchObject({ repositoryIndex: null, consent: false, readRecords: [] });
  });

  it("uses a separate key and deletes only App Story data", () => {
    const { store, data } = memoryStorage({ [STORAGE_KEY]: "old-world" });
    const payload: AppStoryPersistPayload = {
      v: 1,
      projectName: "acme/app",
      snapshot: {},
      repositoryIndex: null,
      consent: false,
      acceptedAnalysis: { nodes: [], edges: [] },
      proposal: { nodes: [], edges: [] },
      finalized: false,
      readRecords: [],
      analysisSessionId: null,
      gapReviews: {},
      expandedFlowIds: [],
      repositorySource: null,
    };

    expect(saveAppStory(store, payload)).toEqual({ ok: true });
    expect(loadAppStory(store)).toEqual(payload);
    deleteAppStory(store);
    expect(data[APP_STORY_STORAGE_KEY]).toBeUndefined();
    expect(data[STORAGE_KEY]).toBe("old-world");
  });
});
