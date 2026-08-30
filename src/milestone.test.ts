import { describe, expect, it, vi } from "vitest";
import { applyProposalBatch, calculateConfidence, emptyAnalysisProposal } from "./analysis";
import { proposalToWorld } from "./appStory";
import { applyGapReview } from "./gapReview";
import { buildGitHubEvidenceUrl } from "./github";
import { connectPublicGitHub, readRepositoryLines } from "./repository";

describe("essential milestone", () => {
  it("connects, reads, validates, reviews, and renders an evidence-backed flow", async () => {
    const sha = "a".repeat(40);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        truncated: false,
        tree: [{ type: "blob", path: "src/App.tsx", size: 100, sha: "blob" }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response("export function App() {\n  return <main />;\n}", { status: 200 }));

    const connected = await connectPublicGitHub("https://github.com/acme/app", fetcher);
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const source = await readRepositoryLines(connected.index, "src/App.tsx", 1, 3, fetcher);
    expect(source.ok).toBe(true);
    if (!source.ok) return;

    const evidence = [{ path: "src/App.tsx", startLine: 1, endLine: 3, source: "source_code" as const }];
    const screenFactors = [{ kind: "screen_implementation" as const, strength: "strong" as const, detail: "App renders the main Screen." }];
    const gapFactors = [{ kind: "missing_source" as const, strength: "moderate" as const, detail: "No error state found." }];
    const edgeFactors = [{ kind: "transition" as const, strength: "strong" as const, detail: "The user opens the App Screen." }];
    const result = applyProposalBatch(emptyAnalysisProposal(), {
      nodes: [
        {
          id: "screen:app",
          kind: "screen",
          title: "App",
          applicationArea: "web",
          flowId: "main",
          flowTitle: "Main flow",
          evidence,
          factors: screenFactors,
          confidence: calculateConfidence(evidence, screenFactors, true, "Direct implementation."),
        },
        {
          id: "gap:error",
          kind: "possible_gap",
          title: "Missing error state",
          applicationArea: "web",
          flowId: "main",
          flowTitle: "Main flow",
          evidence,
          factors: gapFactors,
          confidence: calculateConfidence(evidence, gapFactors, true, "No error state was found."),
        },
      ],
      edges: [{
        id: "edge:opens",
        kind: "screen_transition",
        fromId: "screen:app",
        toId: "gap:error",
        label: "Missing failure path",
        evidence,
        factors: edgeFactors,
        confidence: calculateConfidence(evidence, edgeFactors, true, "Direct transition evidence."),
      }],
    }, { files: [{ path: "src/App.tsx", lineCount: source.totalLines }] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(proposalToWorld(result.proposal, "acme/app", undefined, new Set()).cards.map((card) => card.id)).toEqual(["flow:main"]);
    expect(proposalToWorld(result.proposal, "acme/app", undefined, new Set(["main"])).cards.map((card) => card.id)).toEqual(expect.arrayContaining(["screen:app", "gap:error"]));
    expect(result.proposal.edges[0]).toMatchObject({
      confidence: { reason: "Direct transition evidence." },
      evidence,
      factors: edgeFactors,
    });
    expect(applyGapReview(result.proposal.nodes, {}, {
      nodeId: "gap:error",
      status: "confirmed",
      impact: "high",
      reason: "A failed request has no visible recovery path.",
    })["gap:error"].status).toBe("confirmed");
    expect(buildGitHubEvidenceUrl({ owner: "acme", repo: "app", commitSha: sha, path: "src/App.tsx", startLine: 1, endLine: 3 })).toContain(`/blob/${sha}/src/App.tsx#L1-L3`);
  });
});
