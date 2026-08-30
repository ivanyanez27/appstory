import { describe, expect, it } from "vitest";
import { parseProjectFile, serializeProjectFile } from "./projectFile";

const evidence = [{ path: "src/App.tsx", startLine: 1, endLine: 3, source: "source_code" as const }];
const factors = [{ kind: "screen_implementation" as const, strength: "strong" as const, detail: "Rendered Screen." }];
const confidence = { score: 90, label: "confirmed" as const, reason: "Direct source.", traceable: true };

describe("Project File", () => {
  it("round-trips portable analysis data without repository source state", () => {
    const text = serializeProjectFile({
      projectName: "acme/app",
      repository: { source: "github", revision: { owner: "acme", repo: "app", commitSha: "a".repeat(40) } },
      acceptedAnalysis: { nodes: [{ id: "screen:app", kind: "screen", title: "App", applicationArea: "web", evidence, factors, confidence }], edges: [] },
      gapReviews: {},
      expandedFlowIds: ["main"],
    });

    expect(text).not.toContain("repositoryIndex");
    expect(text).not.toContain("readRecords");
    expect(parseProjectFile(text)).toMatchObject({ ok: true, project: { projectName: "acme/app" } });
  });

  it("rejects invalid graph data without returning a partial project", () => {
    const parsed = parseProjectFile(JSON.stringify({
      format: "app-story.project",
      version: 1,
      projectName: "Bad",
      repository: { source: "github", revision: { owner: "acme", repo: "app", commitSha: "a".repeat(40) } },
      acceptedAnalysis: { nodes: [], edges: [{ id: "edge:x" }] },
      gapReviews: {},
      expandedFlowIds: [],
    }));

    expect(parsed).toEqual({ ok: false, error: "Project File analysis is invalid." });
  });

  it("rejects a GitHub identity that cannot create safe Evidence links", () => {
    const parsed = parseProjectFile(JSON.stringify({
      format: "app-story.project",
      version: 1,
      projectName: "Bad identity",
      repository: { source: "github", revision: { owner: "acme/team", repo: "app", commitSha: "a".repeat(40) } },
      acceptedAnalysis: { nodes: [], edges: [] },
      gapReviews: {},
      expandedFlowIds: [],
    }));

    expect(parsed).toEqual({ ok: false, error: "Project File analysis is invalid." });
  });
});
