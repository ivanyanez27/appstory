import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_FILE_BYTES,
  buildGitHubEvidenceUrl,
  getRepositoryFileEligibility,
  parseGitHubRepositoryUrl,
} from "./github";

describe("parseGitHubRepositoryUrl", () => {
  it("parses a public repository and an optional tree scope", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/openai/codex")).toEqual({
      ok: true,
      repository: { owner: "openai", repo: "codex" },
    });
    expect(
      parseGitHubRepositoryUrl(
        "https://github.com/openai/codex/tree/main/packages/web",
      ),
    ).toEqual({
      ok: true,
      repository: {
        owner: "openai",
        repo: "codex",
        ref: "main",
        subdir: "packages/web",
      },
    });
  });

  it.each([
    "https://gitlab.com/openai/codex",
    "https://github.com/openai",
    "https://github.com/openai/codex/issues",
    "https://user@github.com/openai/codex",
    "https://github.com/openai/codex?tab=readme",
    "not a URL",
  ])("rejects a non-GitHub or malformed URL: %s", (url) => {
    expect(parseGitHubRepositoryUrl(url).ok).toBe(false);
  });
});

describe("getRepositoryFileEligibility", () => {
  it.each([
    [".git/config", "git metadata"],
    ["node_modules/react/index.js", "dependency"],
    ["Pods/Alamofire/Source.swift", "dependency"],
    ["dist/app.js", "build output"],
    [".next/server/app.js", "build output"],
    ["public/logo.PNG", "binary"],
    [".env.local", "environment file"],
    ["config/private-key.pem", "likely secret"],
    ["credentials.json", "likely secret"],
    ["src/secrets.local.json", "likely secret"],
    ["config/api_credentials.json", "likely secret"],
    ["top-secret-plan.md", "likely secret"],
    // Secret directories, not just secret filenames.
    ["secrets/prod.json", "likely secret"],
    ["config/credentials/aws.yml", "likely secret"],
    [".secrets/db.yml", "likely secret"],
    // Credential-family filenames the enumerated list now covers.
    ["deploy/.netrc", "likely secret"],
    ["home/.pgpass", "likely secret"],
    [".ssh/id_ecdsa", "likely secret"],
    ["gpg/secring.gpg", "likely secret"],
    ["infra/terraform.tfstate", "likely secret"],
    // Environment files by exact name and by trailing-whitespace variant.
    [".envrc", "environment file"],
    ["service/.flaskenv", "environment file"],
    ["app/.env ", "environment file"],
  ])("excludes %s as %s", (path, reason) => {
    expect(getRepositoryFileEligibility({ path, size: 100 })).toEqual({
      eligible: false,
      reason,
    });
  });

  it("allows useful source files and names that only resemble excluded paths", () => {
    expect(
      getRepositoryFileEligibility({ path: "src/build.ts", size: 100 }),
    ).toEqual({ eligible: true });
    expect(
      getRepositoryFileEligibility({ path: ".gitignore", size: 100 }),
    ).toEqual({ eligible: true });
    // "secret(s)"/"credential(s)" must be a bounded segment, not a substring
    // match, or ordinary words get swept up with it.
    expect(
      getRepositoryFileEligibility({ path: "src/secretary.ts", size: 100 }),
    ).toEqual({ eligible: true });
    // An `env/` directory or an `environment` file is not an environment file.
    expect(
      getRepositoryFileEligibility({ path: "env/config.ts", size: 100 }),
    ).toEqual({ eligible: true });
    expect(
      getRepositoryFileEligibility({ path: "src/environment.ts", size: 100 }),
    ).toEqual({ eligible: true });
  });

  it("excludes oversized and unsafe paths", () => {
    expect(
      getRepositoryFileEligibility({
        path: "src/generated.ts",
        size: DEFAULT_MAX_FILE_BYTES + 1,
      }),
    ).toEqual({ eligible: false, reason: "oversized" });
    expect(
      getRepositoryFileEligibility({ path: "../outside.ts", size: 100 }),
    ).toEqual({ eligible: false, reason: "unsafe path" });
  });
});

describe("buildGitHubEvidenceUrl", () => {
  it("builds a commit-pinned link with an encoded path and line range", () => {
    expect(
      buildGitHubEvidenceUrl({
        owner: "openai",
        repo: "codex",
        commitSha: "a".repeat(40),
        path: "packages/app story/main.tsx",
        startLine: 12,
        endLine: 18,
      }),
    ).toBe(
      `https://github.com/openai/codex/blob/${"a".repeat(40)}/packages/app%20story/main.tsx#L12-L18`,
    );
  });

  it("rejects a branch name, unsafe path, or invalid line range", () => {
    expect(() =>
      buildGitHubEvidenceUrl({
        owner: "openai",
        repo: "codex",
        commitSha: "main",
        path: "src/main.ts",
        startLine: 1,
      }),
    ).toThrow("commit SHA");
    expect(() =>
      buildGitHubEvidenceUrl({
        owner: "openai",
        repo: "codex",
        commitSha: "a".repeat(40),
        path: "../secret",
        startLine: 1,
      }),
    ).toThrow("path");
    expect(() =>
      buildGitHubEvidenceUrl({
        owner: "openai",
        repo: "codex",
        commitSha: "a".repeat(40),
        path: "src/main.ts",
        startLine: 4,
        endLine: 3,
      }),
    ).toThrow("line range");
  });
});
