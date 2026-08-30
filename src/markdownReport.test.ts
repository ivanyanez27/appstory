import { describe, expect, it } from "vitest";
import { buildMarkdownReport } from "./markdownReport";

describe("Markdown report", () => {
  it("exports accepted flow evidence safely and deterministically", () => {
    const report = buildMarkdownReport({
      projectName: "<script>alert(1)</script>",
      repository: { source: "github", revision: { owner: "acme", repo: "app", commitSha: "a".repeat(40) } },
      acceptedAnalysis: {
        nodes: [{
          id: "screen:home",
          kind: "screen",
          title: "[Home](javascript:alert(1))",
          applicationArea: "web",
          flowId: "main",
          flowTitle: "Main flow",
          evidence: [{ path: "src/App.tsx", startLine: 1, endLine: 3, source: "source_code" }],
          factors: [{ kind: "screen_implementation", strength: "strong", detail: "Rendered Screen." }],
          confidence: { score: 90, label: "confirmed", reason: "Direct source.", traceable: true },
        }],
        edges: [],
      },
      gapReviews: {},
      expandedFlowIds: [],
    });

    expect(report).toContain("# &lt;script&gt;alert\\(1\\)&lt;/script&gt;");
    expect(report).not.toContain("<script>");
    expect(report).not.toContain("[Home](javascript:");
    expect(report).toContain(`/blob/${"a".repeat(40)}/src/App.tsx#L1-L3`);
    expect(report).toContain("## Flows\n\n### Main flow");
    expect(report).not.toContain("expandedFlowIds");
  });
});
