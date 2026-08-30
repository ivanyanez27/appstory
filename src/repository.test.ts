import { describe, expect, it, vi } from "vitest";
import { connectPublicGitHub, readRepositoryLines } from "./repository";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("public GitHub repository access", () => {
  it("resolves a commit and indexes eligible files", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ sha: "a".repeat(40) }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            { type: "blob", path: "src/App.tsx", size: 200, sha: "1" },
            { type: "blob", path: ".env", size: 20, sha: "2" },
            { type: "tree", path: "src", sha: "3" },
          ],
        }),
      );

    const result = await connectPublicGitHub(
      "https://github.com/acme/app",
      fetcher,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.index.revision.commitSha).toBe("a".repeat(40));
    expect(result.index.files).toHaveLength(2);
    expect(result.index.files[0].eligibility).toEqual({ eligible: true });
    expect(result.index.files[1].eligibility).toEqual({
      eligible: false,
      reason: "environment file",
    });
  });

  it("limits a tree URL to its selected subdirectory", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ sha: "b".repeat(40) }))
      .mockResolvedValueOnce(
        jsonResponse({
          truncated: false,
          tree: [
            { type: "blob", path: "apps/web/src/App.tsx", size: 200, sha: "1" },
            { type: "blob", path: "apps/api/index.ts", size: 200, sha: "2" },
          ],
        }),
      );

    const result = await connectPublicGitHub(
      "https://github.com/acme/app/tree/main/apps/web",
      fetcher,
    );

    expect(result.ok && result.index.files.map((file) => file.path)).toEqual([
      "apps/web/src/App.tsx",
    ]);
  });

  it("returns a clear GitHub error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({}, 403));
    await expect(
      connectPublicGitHub("https://github.com/acme/app", fetcher),
    ).resolves.toEqual({
      ok: false,
      error: "GitHub refused repository access (403).",
    });
  });

  it("returns a clear network error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    await expect(
      connectPublicGitHub("https://github.com/acme/app", fetcher),
    ).resolves.toEqual({ ok: false, error: "Could not reach GitHub." });
  });

  it("reads a bounded line range and detects likely secrets", async () => {
    const revision = {
      owner: "acme",
      repo: "app",
      commitSha: "c".repeat(40),
    };
    const index = {
      revision,
      truncated: false,
      files: [
        {
          path: "src/App.tsx",
          size: 30,
          sha: "1",
          eligibility: { eligible: true as const },
        },
      ],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("one\ntwo\nthree\nfour", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    await expect(
      readRepositoryLines(index, "src/App.tsx", 2, 3, fetcher),
    ).resolves.toMatchObject({ ok: true, text: "two\nthree", startLine: 2, endLine: 3 });

    fetcher.mockResolvedValueOnce(new Response("one\ntwo", { status: 200 }));
    await expect(
      readRepositoryLines(index, "src/App.tsx", 3, 3, fetcher),
    ).resolves.toEqual({ ok: false, error: "startLine is outside this file." });

    fetcher.mockResolvedValueOnce(
      new Response("-----BEGIN PRIVATE KEY-----", { status: 200 }),
    );
    await expect(
      readRepositoryLines(index, "src/App.tsx", 1, 1, fetcher),
    ).resolves.toEqual({ ok: false, error: "Source appears to contain a private key." });

    fetcher.mockResolvedValueOnce(
      new Response(`const token = "ghp_${"a".repeat(36)}";`, { status: 200 }),
    );
    await expect(
      readRepositoryLines(index, "src/App.tsx", 1, 1, fetcher),
    ).resolves.toEqual({ ok: false, error: "Source appears to contain a secret." });

    for (const body of [
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      "-----BEGIN PGP PRIVATE KEY BLOCK-----",
      `key = "sk-ant-${"a".repeat(24)}"`,
      `API_KEY: "s3cr3t-value-here"`,
    ]) {
      fetcher.mockResolvedValueOnce(new Response(body, { status: 200 }));
      await expect(
        readRepositoryLines(index, "src/App.tsx", 1, 1, fetcher),
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it("rejects a tampered commit SHA before fetching source", async () => {
    const index = {
      revision: { owner: "acme", repo: "app", commitSha: "../evil/main" },
      truncated: false,
      files: [
        { path: "a.ts", size: 10, sha: "1", eligibility: { eligible: true as const } },
      ],
    };
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      readRepositoryLines(index, "a.ts", 1, 1, fetcher),
    ).resolves.toEqual({ ok: false, error: "The repository revision is invalid." });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses unindexed, excluded, and oversized ranges", async () => {
    const index = {
      revision: { owner: "acme", repo: "app", commitSha: "d".repeat(40) },
      truncated: false,
      files: [],
    };
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      readRepositoryLines(index, "src/missing.ts", 1, 2, fetcher),
    ).resolves.toEqual({ ok: false, error: "File is not in the repository index." });
    await expect(
      readRepositoryLines(index, "src/missing.ts", 1, 501, fetcher),
    ).resolves.toEqual({ ok: false, error: "Read ranges are limited to 500 lines." });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
