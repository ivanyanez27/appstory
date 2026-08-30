import { describe, expect, it } from "vitest";
import type { AnalysisNode } from "./analysis";
import { applyGapReview } from "./gapReview";

const evidence = [{ path: "src/App.tsx", startLine: 1, endLine: 2, source: "source_code" as const }];
const factors = [{ kind: "missing_source" as const, strength: "moderate" as const, detail: "No retry path found." }];
const confidence = { score: 45, label: "inferred" as const, reason: "Partial evidence.", traceable: true };

function node(kind: AnalysisNode["kind"]): AnalysisNode {
  return { id: `node:${kind}`, kind, title: kind, applicationArea: "web", evidence, factors, confidence };
}

describe("gap review", () => {
  it("records a human decision without changing discovered nodes", () => {
    const nodes = [node("possible_gap")];
    const snapshot = structuredClone(nodes);
    const result = applyGapReview(nodes, {}, {
      nodeId: "node:possible_gap",
      status: "confirmed",
      impact: "high",
      reason: "Checkout has no retry action.",
      reviewer: "Sam",
    });

    expect(result).toEqual({
      "node:possible_gap": {
          nodeId: "node:possible_gap",
          status: "confirmed",
          impact: "high",
          reason: "Checkout has no retry action.",
          reviewer: "Sam",
          reviewerVerified: false,
      },
    });
    expect(nodes).toEqual(snapshot);
  });

  it("requires a reason for a final review decision", () => {
    expect(() => applyGapReview([node("unknown_path")], {}, {
        nodeId: "node:unknown_path",
        status: "not_applicable",
        impact: "low",
        reason: "  ",
      })).toThrow("A reason is required");
  });

  it("rejects reviews for ordinary graph nodes", () => {
    expect(() => applyGapReview([node("screen")], {}, {
        nodeId: "node:screen",
        status: "confirmed",
        impact: "critical",
        reason: "Not a gap.",
      })).toThrow("Only possible_gap and unknown_path nodes can be reviewed");
  });
});
