import {
  getRepositoryFileEligibility,
  parseGitHubRepositoryUrl,
  type RepositoryIndex,
} from "./github";

type RepositoryResult =
  | { ok: true; index: RepositoryIndex }
  | { ok: false; error: string };

export type SourceResult =
  | {
      ok: true;
      path: string;
      text: string;
      startLine: number;
      endLine: number;
      totalLines: number;
    }
  | { ok: false; error: string };

const API = "https://api.github.com";
const RAW = "https://raw.githubusercontent.com";
const MAX_READ_LINES = 500;

function validateReadRange(startLine: number, endLine: number): string | null {
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine
  ) return "Enter a valid line range.";
  if (endLine - startLine + 1 > MAX_READ_LINES) {
    return `Read ranges are limited to ${MAX_READ_LINES} lines.`;
  }
  return null;
}

export function sliceRepositorySource(
  source: string,
  path: string,
  startLine: number,
  endLine: number,
): SourceResult {
  const rangeError = validateReadRange(startLine, endLine);
  if (rangeError) return { ok: false, error: rangeError };
  if (source.includes("\0")) {
    return { ok: false, error: "Source appears to contain binary data." };
  }
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/.test(source)) {
    return { ok: false, error: "Source appears to contain a private key." };
  }
  if (
    /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/.test(source) ||
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/.test(source) ||
    /\bglpat-[A-Za-z0-9_-]{20,}\b/.test(source) ||
    /\bAKIA[A-Z0-9]{16}\b/.test(source) ||
    /\bASIA[A-Z0-9]{16}\b/.test(source) ||
    /\b(?:r|s)k_(?:live|test)_[A-Za-z0-9]{20,}\b/.test(source) ||
    /\bAIza[A-Za-z0-9_-]{35}\b/.test(source) ||
    /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/.test(source) ||
    /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/.test(source) ||
    /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(source) ||
    /(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|auth[_-]?token|password|passwd)\s*[:=]\s*["'][^"'\s]{8,}["']/i.test(source)
  ) {
    return { ok: false, error: "Source appears to contain a secret." };
  }
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (startLine > lines.length) {
    return { ok: false, error: "startLine is outside this file." };
  }
  const actualEnd = Math.min(endLine, lines.length);
  return {
    ok: true,
    path,
    text: lines.slice(startLine - 1, actualEnd).join("\n"),
    startLine,
    endLine: actualEnd,
    totalLines: lines.length,
  };
}

function githubError(status: number): { ok: false; error: string } {
  return { ok: false, error: `GitHub refused repository access (${status}).` };
}

async function connectPublicGitHubUnsafe(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryResult> {
  const parsed = parseGitHubRepositoryUrl(url);
  if (!parsed.ok) return parsed;
  const { owner, repo, ref, subdir } = parsed.repository;
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const commitResponse = await fetcher(
    `${base}/commits/${encodeURIComponent(ref ?? "HEAD")}`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (!commitResponse.ok) return githubError(commitResponse.status);
  const commit = (await commitResponse.json()) as { sha?: unknown };
  if (typeof commit.sha !== "string" || !/^[a-f0-9]{40}$/i.test(commit.sha)) {
    return { ok: false, error: "GitHub returned an invalid commit." };
  }

  const treeResponse = await fetcher(`${base}/git/trees/${commit.sha}?recursive=1`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!treeResponse.ok) return githubError(treeResponse.status);
  const tree = (await treeResponse.json()) as {
    truncated?: unknown;
    tree?: Array<{ type?: unknown; path?: unknown; size?: unknown; sha?: unknown }>;
  };
  if (!Array.isArray(tree.tree)) {
    return { ok: false, error: "GitHub returned an invalid repository tree." };
  }

  const prefix = subdir ? `${subdir}/` : "";
  const files = tree.tree.flatMap((entry) => {
    if (
      entry.type !== "blob" ||
      typeof entry.path !== "string" ||
      typeof entry.sha !== "string" ||
      (subdir && entry.path !== subdir && !entry.path.startsWith(prefix))
    ) {
      return [];
    }
    const size = typeof entry.size === "number" ? entry.size : 0;
    return [{
      path: entry.path,
      size,
      sha: entry.sha,
      eligibility: getRepositoryFileEligibility({ path: entry.path, size }),
    }];
  });

  return {
    ok: true,
    index: {
      revision: { owner, repo, ...(ref ? { ref } : {}), ...(subdir ? { subdir } : {}), commitSha: commit.sha },
      files,
      truncated: tree.truncated === true,
    },
  };
}

export async function connectPublicGitHub(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<RepositoryResult> {
  try {
    return await connectPublicGitHubUnsafe(url, fetcher);
  } catch {
    return { ok: false, error: "Could not reach GitHub." };
  }
}

async function readRepositoryLinesUnsafe(
  index: RepositoryIndex,
  path: string,
  startLine: number,
  endLine: number,
  fetcher: typeof fetch = fetch,
): Promise<SourceResult> {
  const rangeError = validateReadRange(startLine, endLine);
  if (rangeError) return { ok: false, error: rangeError };
  const file = index.files.find((candidate) => candidate.path === path);
  if (!file) return { ok: false, error: "File is not in the repository index." };
  if (!file.eligibility.eligible) {
    return { ok: false, error: `File is excluded: ${file.eligibility.reason}.` };
  }

  const { owner, repo, commitSha } = index.revision;
  // Re-assert the pinned commit. `owner`/`repo`/path segments are all
  // `encodeURIComponent`d below, but `commitSha` goes into the URL raw; a
  // tampered persisted index must not be able to redirect this fetch.
  if (!/^[a-f0-9]{40}$/i.test(commitSha)) {
    return { ok: false, error: "The repository revision is invalid." };
  }
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetcher(
    `${RAW}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${commitSha}/${encodedPath}`,
  );
  if (!response.ok) return githubError(response.status);
  return sliceRepositorySource(await response.text(), path, startLine, endLine);
}

export async function readRepositoryLines(
  index: RepositoryIndex,
  path: string,
  startLine: number,
  endLine: number,
  fetcher: typeof fetch = fetch,
): Promise<SourceResult> {
  try {
    return await readRepositoryLinesUnsafe(index, path, startLine, endLine, fetcher);
  } catch {
    return { ok: false, error: "Could not reach GitHub." };
  }
}
