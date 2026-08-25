import { describe, expect, it } from "vitest";
import { STORAGE_KEY, load, save, type PersistPayload } from "./persist";

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
