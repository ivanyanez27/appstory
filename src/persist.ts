export const STORAGE_KEY = "lsw.v1";

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
