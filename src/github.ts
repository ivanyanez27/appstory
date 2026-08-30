export interface GitHubRepositoryLocation {
  owner: string;
  repo: string;
  ref?: string;
  subdir?: string;
}

export type ParseGitHubRepositoryUrlResult =
  | { ok: true; repository: GitHubRepositoryLocation }
  | { ok: false; error: string };

export interface GitHubRepositoryRevision extends GitHubRepositoryLocation {
  commitSha: string;
}

export interface RepositoryFile {
  path: string;
  size: number;
  sha: string;
}

export type RepositoryExclusionReason =
  | "git metadata"
  | "dependency"
  | "build output"
  | "binary"
  | "environment file"
  | "likely secret"
  | "oversized"
  | "unsafe path";

export type RepositoryFileEligibility =
  | { eligible: true }
  | { eligible: false; reason: RepositoryExclusionReason };

export interface IndexedRepositoryFile extends RepositoryFile {
  eligibility: RepositoryFileEligibility;
}

export interface RepositoryIndex {
  revision: GitHubRepositoryRevision;
  files: IndexedRepositoryFile[];
  truncated: boolean;
}

export interface GitHubEvidenceLocation {
  owner: string;
  repo: string;
  commitSha: string;
  path: string;
  startLine: number;
  endLine?: number;
}

export const DEFAULT_MAX_FILE_BYTES = 1_000_000;

const OWNER_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/;
const REPO_PATTERN = /^(?!\.{1,2}$)[a-zA-Z0-9._-]{1,100}$/;

export function isValidGitHubRepositoryIdentity(owner: string, repo: string): boolean {
  return OWNER_PATTERN.test(owner) && REPO_PATTERN.test(repo);
}
const DEPENDENCY_DIRECTORIES = new Set([
  "node_modules",
  "bower_components",
  "jspm_packages",
  "vendor",
  "pods",
  ".gradle",
  ".yarn",
  ".pnpm-store",
]);
const BUILD_DIRECTORIES = new Set([
  "build",
  "dist",
  "out",
  "target",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".cache",
]);
const BINARY_EXTENSIONS = new Set([
  "7z",
  "a",
  "avi",
  "bin",
  "bmp",
  "class",
  "dmg",
  "doc",
  "docx",
  "exe",
  "gif",
  "gz",
  "ico",
  "jar",
  "jpeg",
  "jpg",
  "mov",
  "mp3",
  "mp4",
  "o",
  "otf",
  "pdf",
  "png",
  "rar",
  "so",
  "tar",
  "ttf",
  "wav",
  "webm",
  "webp",
  "woff",
  "woff2",
  "xls",
  "xlsx",
  "zip",
]);
const SECRET_EXTENSIONS = new Set([
  "key",
  "keystore",
  "p12",
  "pem",
  "pfx",
  "jks",
]);
const SECRET_FILENAMES = new Set([
  "credentials.json",
  "service-account.json",
  "id_rsa",
  "id_ed25519",
  ".npmrc",
  ".pypirc",
]);

function pathParts(path: string): string[] | null {
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("\\") ||
    Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return null;
  }
  const parts = path.split("/");
  return parts.some((part) => !part || part === "." || part === "..")
    ? null
    : parts;
}

export function getDefaultExclusionReason(
  path: string,
): RepositoryExclusionReason | null {
  const parts = pathParts(path);
  if (!parts) return "unsafe path";

  const lowerParts = parts.map((part) => part.toLowerCase());
  if (lowerParts.includes(".git")) return "git metadata";
  if (lowerParts.some((part) => DEPENDENCY_DIRECTORIES.has(part))) {
    return "dependency";
  }
  if (lowerParts.some((part) => BUILD_DIRECTORIES.has(part))) {
    return "build output";
  }

  const filename = lowerParts.at(-1) ?? "";
  const extension = filename.includes(".") ? filename.split(".").at(-1)! : "";
  if (/^\.env(?:\.|$)/.test(filename)) return "environment file";
  if (
    SECRET_FILENAMES.has(filename) ||
    SECRET_EXTENSIONS.has(extension) ||
    /^service-account(?:[._-].*)?\.json$/.test(filename)
  ) {
    return "likely secret";
  }
  if (BINARY_EXTENSIONS.has(extension)) return "binary";
  return null;
}

export function getRepositoryFileEligibility(
  file: Pick<RepositoryFile, "path" | "size">,
  maxBytes = DEFAULT_MAX_FILE_BYTES,
): RepositoryFileEligibility {
  const reason = getDefaultExclusionReason(file.path);
  if (reason) return { eligible: false, reason };
  if (
    !Number.isSafeInteger(file.size) ||
    file.size < 0 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    file.size > maxBytes
  ) {
    return { eligible: false, reason: "oversized" };
  }
  return { eligible: true };
}

export function buildGitHubEvidenceUrl(
  evidence: GitHubEvidenceLocation,
): string {
  if (!isValidGitHubRepositoryIdentity(evidence.owner, evidence.repo)) {
    throw new Error("Invalid GitHub repository identity.");
  }
  if (!/^[a-f0-9]{40}$/i.test(evidence.commitSha)) {
    throw new Error("Evidence requires a full commit SHA.");
  }
  const parts = pathParts(evidence.path);
  if (!parts) throw new Error("Evidence requires a safe repository path.");
  if (
    !Number.isSafeInteger(evidence.startLine) ||
    evidence.startLine < 1 ||
    (evidence.endLine !== undefined &&
      (!Number.isSafeInteger(evidence.endLine) ||
        evidence.endLine < evidence.startLine))
  ) {
    throw new Error("Evidence requires a valid line range.");
  }

  const path = parts.map(encodeURIComponent).join("/");
  const end =
    evidence.endLine === undefined || evidence.endLine === evidence.startLine
      ? ""
      : `-L${evidence.endLine}`;
  return `https://github.com/${encodeURIComponent(evidence.owner)}/${encodeURIComponent(evidence.repo)}/blob/${evidence.commitSha}/${path}#L${evidence.startLine}${end}`;
}

export function parseGitHubRepositoryUrl(
  input: string,
): ParseGitHubRepositoryUrlResult {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Enter a valid GitHub repository URL." };
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return { ok: false, error: "Enter a public https://github.com URL." };
  }

  let parts: string[];
  try {
    parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
  } catch {
    return { ok: false, error: "The GitHub URL contains invalid encoding." };
  }

  const [owner, rawRepo, marker, ref, ...subdirParts] = parts;
  const repo = rawRepo?.replace(/\.git$/, "");
  const isTree = marker === "tree" && Boolean(ref);
  if (
    !owner ||
    !repo ||
    !OWNER_PATTERN.test(owner) ||
    !REPO_PATTERN.test(repo) ||
    parts.some((part) => part.includes("/") || part === "." || part === "..") ||
    (parts.length > 2 && !isTree) ||
    (marker === "tree" && !ref)
  ) {
    return { ok: false, error: "Enter a GitHub repository or tree URL." };
  }

  return {
    ok: true,
    repository: {
      owner,
      repo,
      ...(ref ? { ref } : {}),
      ...(subdirParts.length ? { subdir: subdirParts.join("/") } : {}),
    },
  };
}
