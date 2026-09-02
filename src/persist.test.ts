import { describe, expect, it } from "vitest";
import {
  APPSTORY_STORAGE_KEY,
  deleteAppStory,
  loadAppStory,
  saveAppStory,
  type AppStoryPersistPayload,
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

const APPSTORY_PAYLOAD: AppStoryPersistPayload = {
  v: 1,
  projectName: "acme/app",
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

describe("AppStory persistence", () => {
  it("round-trips a payload", () => {
    const { store } = memoryStorage();
    expect(saveAppStory(store, APPSTORY_PAYLOAD)).toEqual({ ok: true });
    expect(loadAppStory(store)).toEqual(APPSTORY_PAYLOAD);
  });

  it("returns null for missing and corrupt JSON", () => {
    expect(loadAppStory(memoryStorage().store)).toBeNull();
    const { store } = memoryStorage({ [APPSTORY_STORAGE_KEY]: "{not-json" });
    expect(loadAppStory(store)).toBeNull();
  });

  it("returns ok false on quota errors", () => {
    const { store } = memoryStorage();
    store.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    expect(saveAppStory(store, APPSTORY_PAYLOAD)).toEqual({ ok: false });
  });

  it("does not persist private local repository metadata", () => {
    const { store, data } = memoryStorage();
    const payload = {
      v: 1 as const,
      projectName: "local-app",
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

    expect(data[APPSTORY_STORAGE_KEY]).not.toContain("secret/path.ts");
    expect(loadAppStory(store)).toMatchObject({ repositoryIndex: null, consent: false, readRecords: [] });
  });

  it("never persists canvas geometry, and drops a leftover snapshot on load", () => {
    const { store, data } = memoryStorage();
    saveAppStory(store, APPSTORY_PAYLOAD);
    expect(data[APPSTORY_STORAGE_KEY]).not.toContain("snapshot");

    // A payload saved before the canvas stopped persisting its own geometry
    // can still be sitting in a returning user's browser.
    const { store: legacyStore } = memoryStorage({
      [APPSTORY_STORAGE_KEY]: JSON.stringify({ ...APPSTORY_PAYLOAD, snapshot: { shape: { x: 1 } } }),
    });
    expect(loadAppStory(legacyStore)).toEqual(APPSTORY_PAYLOAD);
  });

  it("uses a separate key and deletes only AppStory data", () => {
    const otherKey = "unrelated.storage.key";
    const { store, data } = memoryStorage({ [otherKey]: "keep me" });

    expect(saveAppStory(store, APPSTORY_PAYLOAD)).toEqual({ ok: true });
    expect(loadAppStory(store)).toEqual(APPSTORY_PAYLOAD);
    deleteAppStory(store);
    expect(data[APPSTORY_STORAGE_KEY]).toBeUndefined();
    expect(data[otherKey]).toBe("keep me");
  });
});
