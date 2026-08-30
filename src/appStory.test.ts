import { describe, expect, it } from "vitest";
import type { AnalysisProposal } from "./analysis";
import { findUnreadEvidence, mayExposeRepositoryIndex, parseProposalBatch, proposalToWorld, searchRepositoryFiles } from "./appStory";

const evidence = [{ path: "src/App.tsx", startLine: 1, endLine: 4, source: "source_code" as const }];
const factors = [{ kind: "screen_implementation" as const, strength: "strong" as const, detail: "Rendered route." }];
const confidence = { score: 90, label: "confirmed" as const, reason: "Direct source.", traceable: true };

describe("App Story integration", () => {
  it("does not expose a local repository index before consent", () => {
    expect(mayExposeRepositoryIndex("local", false)).toBe(false);
    expect(mayExposeRepositoryIndex("local", true)).toBe(true);
    expect(mayExposeRepositoryIndex("github", false)).toBe(true);
  });

  it("maps analysis nodes and edges to the existing canvas model", () => {
    const proposal: AnalysisProposal = {
      nodes: [
        { id: "actor:user", kind: "actor", title: "User", applicationArea: "web", evidence, factors, confidence },
        { id: "screen:home", kind: "screen", title: "Home", applicationArea: "web", evidence, factors, confidence },
      ],
      edges: [
        { id: "edge:opens", kind: "screen_transition", fromId: "actor:user", toId: "screen:home", label: "Open", evidence, factors, confidence },
      ],
    };

    const world = proposalToWorld(proposal, "acme/app");

    expect(world.cards.map((card) => [card.id, card.type])).toEqual([
      ["flow:main", "region"],
      ["actor:user", "character"],
      ["screen:home", "place"],
    ]);
    expect(world.links).toEqual([
      { id: "link_edge:opens", fromId: "actor:user", toId: "screen:home", label: "Open" },
    ]);
    expect(world.cards[2].summary).toContain("Confirmed · 90%");
  });

  it("reveals the technical chain for one selected screen", () => {
    const proposal: AnalysisProposal = {
      nodes: [
        { id: "screen:home", kind: "screen", title: "Home", applicationArea: "web", evidence, factors, confidence },
        { id: "system:api", kind: "system", title: "API", applicationArea: "backend", evidence, factors, confidence },
        { id: "data:db", kind: "data_store", title: "Database", applicationArea: "backend", evidence, factors, confidence },
        { id: "system:other", kind: "system", title: "Other", applicationArea: "backend", evidence, factors, confidence },
      ],
      edges: [
        { id: "edge:api", kind: "data_transfer", fromId: "screen:home", toId: "system:api", label: "Load", evidence, factors, confidence },
        { id: "edge:db", kind: "data_transfer", fromId: "system:api", toId: "data:db", label: "Query", evidence, factors, confidence },
      ],
    };

    expect(proposalToWorld(proposal, "app").cards.map((card) => card.id)).not.toContain("system:api");
    const expanded = proposalToWorld(proposal, "app", "screen:home");
    expect(expanded.cards.map((card) => card.id)).toEqual(expect.arrayContaining(["system:api", "data:db"]));
    expect(expanded.cards.map((card) => card.id)).not.toContain("system:other");
  });

  it("keeps collapsed flows as regions without their nodes", () => {
    const proposal: AnalysisProposal = {
      nodes: [{
        id: "screen:login",
        kind: "screen",
        title: "Login",
        applicationArea: "web",
        flowId: "auth",
        flowTitle: "Authentication",
        evidence,
        factors,
        confidence,
      }],
      edges: [],
    };
    const world = proposalToWorld(proposal, "app", undefined, new Set());
    expect(world.cards.map((card) => card.id)).toEqual(["flow:auth"]);
    expect(world.cards[0].name).toContain("collapsed");
  });

  it("rejects malformed proposal input before domain validation", () => {
    expect(parseProposalBatch({ nodes: [{ id: "x" }], edges: [] })).toEqual({
      ok: false,
      error: "Proposal batch does not match the required schema.",
    });
  });

  it("rejects an oversized untrusted proposal batch", () => {
    expect(parseProposalBatch({
      nodes: Array.from({ length: 51 }, () => ({})),
      edges: [],
    })).toEqual({ ok: false, error: "Proposal batches are limited to 50 nodes and 100 connections." });
  });

  it("searches eligible repository paths with a hard result limit", () => {
    const files = Array.from({ length: 30 }, (_, index) => ({
      path: `src/screen-${index}.tsx`,
      size: 1,
      sha: String(index),
      eligibility: { eligible: true as const },
    }));
    expect(searchRepositoryFiles(files, "screen", 3)).toHaveLength(3);
    expect(searchRepositoryFiles(files, "missing", 3)).toEqual([]);
  });

  it("finds Evidence outside source ranges that the agent read", () => {
    const proposal: AnalysisProposal = {
      nodes: [{ id: "screen:home", kind: "screen", title: "Home", applicationArea: "web", evidence, factors, confidence }],
      edges: [],
    };
    expect(findUnreadEvidence(proposal, [{ path: "src/App.tsx", startLine: 1, endLine: 2 }])).toEqual([
      { itemId: "screen:home", path: "src/App.tsx", startLine: 1, endLine: 4 },
    ]);
    expect(findUnreadEvidence(proposal, [{ path: "src/App.tsx", startLine: 1, endLine: 4 }])).toEqual([]);
  });
});
