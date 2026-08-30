import { describe, expect, it } from "vitest";
import { connectLocalRepository, type LocalDirectoryHandle, type LocalEntryHandle } from "./localRepository";

function file(name: string, text: string, lastModified = 1): LocalEntryHandle {
  return {
    kind: "file",
    name,
    async getFile() {
      return { size: new TextEncoder().encode(text).byteLength, lastModified, text: async () => text };
    },
  };
}

function directory(name: string, entries: LocalEntryHandle[]): LocalDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *values() { yield* entries; },
  };
}

describe("local repository", () => {
  it("indexes eligible files, excludes dependencies, and reads bounded source", async () => {
    const root = directory("my-app", [
      directory("src", [file("App.tsx", "one\ntwo\nthree")]),
      directory("node_modules", [file("package.js", "ignored")]),
      file(".env", "SECRET=x"),
    ]);

    const result = await connectLocalRepository(root);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index.revision).toMatchObject({ owner: "local", repo: "my-app" });
    expect(result.index.revision.commitSha).toMatch(/^[a-f0-9]{40}$/);
    expect(result.index.files.map((entry) => [entry.path, entry.eligibility])).toEqual([
      [".env", { eligible: false, reason: "environment file" }],
      ["src/App.tsx", { eligible: true }],
    ]);
    await expect(result.readLines("src/App.tsx", 2, 3)).resolves.toMatchObject({ ok: true, text: "two\nthree" });
    await expect(result.readLines(".env", 1, 1)).resolves.toEqual({ ok: false, error: "File is excluded: environment file." });
  });

  it("creates the same fingerprint regardless of entry order", async () => {
    const first = await connectLocalRepository(directory("app", [file("b.ts", "b"), file("a.ts", "a")]));
    const second = await connectLocalRepository(directory("app", [file("a.ts", "a"), file("b.ts", "b")]));
    expect(first.ok && second.ok && first.index.revision.commitSha).toBe(second.ok ? second.index.revision.commitSha : "");
  });

  it("fingerprints eligible content and its path instead of file metadata", async () => {
    const first = await connectLocalRepository(directory("app", [file("a.ts", "one", 1)]));
    const second = await connectLocalRepository(directory("app", [file("a.ts", "two", 1)]));
    const renamed = await connectLocalRepository(directory("app", [file("b.ts", "one", 1)]));

    expect(first.ok && second.ok && first.index.revision.commitSha).not.toBe(second.ok ? second.index.revision.commitSha : "");
    expect(first.ok && renamed.ok && first.index.revision.commitSha).not.toBe(renamed.ok ? renamed.index.revision.commitSha : "");
  });

  it("stops at the file cap and marks the index truncated", async () => {
    const result = await connectLocalRepository(directory("app", [file("a.ts", "a"), file("b.ts", "b")]), 1);
    expect(result.ok && result.index).toMatchObject({ truncated: true, files: [{ path: "a.ts" }] });
  });
});
