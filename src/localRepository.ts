import {
  getDefaultExclusionReason,
  getRepositoryFileEligibility,
  type RepositoryIndex,
} from "./github";
import { sliceRepositorySource, type SourceResult } from "./repository";

export type LocalFile = {
  size: number;
  lastModified: number;
  text(): Promise<string>;
};

export type LocalFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<LocalFile>;
};

export type LocalDirectoryHandle = {
  kind: "directory";
  name: string;
  values(): AsyncIterable<LocalEntryHandle>;
};

export type LocalEntryHandle = LocalFileHandle | LocalDirectoryHandle;

export type LocalRepositoryConnection = {
  index: RepositoryIndex;
  readLines(path: string, startLine: number, endLine: number): Promise<SourceResult>;
};

type ConnectResult =
  | { ok: true } & LocalRepositoryConnection
  | { ok: false; error: string };

async function sha40(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export async function connectLocalRepository(
  root: LocalDirectoryHandle,
  maxFiles = 5_000,
): Promise<ConnectResult> {
  try {
    const handles = new Map<string, LocalFileHandle>();
    const metadata: Array<{ path: string; size: number; sha: string; eligible: boolean }> = [];
    let truncated = false;

    async function visit(directory: LocalDirectoryHandle, prefix = ""): Promise<void> {
      const entries: LocalEntryHandle[] = [];
      for await (const entry of directory.values()) entries.push(entry);
      entries.sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) {
        if (truncated) return;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.kind === "directory") {
          if (getDefaultExclusionReason(`${path}/index.ts`)) continue;
          await visit(entry, path);
          continue;
        }
        if (metadata.length >= maxFiles) {
          truncated = true;
          return;
        }
        const value = await entry.getFile();
        const eligibility = getRepositoryFileEligibility({ path, size: value.size });
        metadata.push({
          path,
          size: value.size,
          sha: await sha40(eligibility.eligible ? await value.text() : path),
          eligible: eligibility.eligible,
        });
        handles.set(path, entry);
      }
    }

    await visit(root);
    metadata.sort((left, right) => left.path.localeCompare(right.path));
    const files = metadata.map((file) => ({
      path: file.path,
      size: file.size,
      sha: file.sha,
      eligibility: getRepositoryFileEligibility(file),
    }));
    const fingerprint = await sha40(metadata
      .filter((file) => file.eligible)
      .map((file) => `${file.path}:${file.sha}`)
      .join("\n"));
    const index: RepositoryIndex = {
      revision: { owner: "local", repo: root.name, commitSha: fingerprint },
      files,
      truncated,
    };

    return {
      ok: true,
      index,
      async readLines(path, startLine, endLine) {
        const indexed = files.find((file) => file.path === path);
        if (!indexed) return { ok: false, error: "File is not in the repository index." };
        if (!indexed.eligibility.eligible) {
          return { ok: false, error: `File is excluded: ${indexed.eligibility.reason}.` };
        }
        const handle = handles.get(path);
        if (!handle) return { ok: false, error: "Reconnect the local folder." };
        try {
          const file = await handle.getFile();
          const currentEligibility = getRepositoryFileEligibility({ path, size: file.size });
          if (!currentEligibility.eligible) {
            return { ok: false, error: `File is excluded: ${currentEligibility.reason}.` };
          }
          return sliceRepositorySource(await file.text(), path, startLine, endLine);
        } catch {
          return { ok: false, error: "Could not read the local file." };
        }
      },
    };
  } catch {
    return { ok: false, error: "Could not read the local folder." };
  }
}
