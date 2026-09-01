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
      { id: "link_edge:opens", fromId: "actor:user", toId: "screen:home", label: "Open", labelPosition: 0.5 },
    ]);
    expect(world.cards[2].summary).toContain("Confirmed · 90%");
  });

  it("lays out the main journey top to bottom and puts possible gaps beside their step", () => {
    const proposal: AnalysisProposal = {
      nodes: [
        { id: "actor:user", kind: "actor", title: "User", applicationArea: "web", evidence, factors, confidence },
        { id: "screen:sign-in", kind: "screen", title: "Sign in", applicationArea: "web", evidence, factors, confidence },
        { id: "decision:valid", kind: "decision", title: "Details valid?", applicationArea: "web", evidence, factors, confidence },
        { id: "outcome:dashboard", kind: "outcome", title: "Dashboard", applicationArea: "web", evidence, factors, confidence },
        { id: "outcome:error", kind: "outcome", title: "Show validation error", applicationArea: "web", evidence, factors, confidence },
        { id: "gap:reset", kind: "possible_gap", title: "Forgot password", applicationArea: "web", evidence, factors, confidence },
      ],
      edges: [
        { id: "edge:open", kind: "screen_transition", fromId: "actor:user", toId: "screen:sign-in", label: "Open", evidence, factors, confidence },
        { id: "edge:submit", kind: "user_action", fromId: "screen:sign-in", toId: "decision:valid", label: "Submit", evidence, factors, confidence },
        { id: "edge:success", kind: "validation_result", fromId: "decision:valid", toId: "outcome:dashboard", label: "Success", evidence, factors, confidence },
        { id: "edge:failure", kind: "validation_result", fromId: "decision:valid", toId: "outcome:error", label: "Failure", evidence, factors, confidence },
        { id: "edge:missing", kind: "dependency", fromId: "screen:sign-in", toId: "gap:reset", label: "Missing path", evidence, factors, confidence },
      ],
    };

    const byId = new Map(proposalToWorld(proposal, "app").cards.map((card) => [card.id, card]));
    const user = byId.get("actor:user")!;
    const signIn = byId.get("screen:sign-in")!;
    const validation = byId.get("decision:valid")!;
    const dashboard = byId.get("outcome:dashboard")!;
    const error = byId.get("outcome:error")!;
    const resetGap = byId.get("gap:reset")!;

    expect(user.y).toBeLessThan(signIn.y);
    expect(signIn.y).toBeLessThan(validation.y);
    expect(validation.y).toBeLessThan(dashboard.y);
    expect(error.y).toBe(dashboard.y);
    expect(Math.abs(error.x - dashboard.x)).toBeGreaterThanOrEqual(440);
    expect(validation.y - signIn.y).toBeGreaterThanOrEqual(320);
    expect(resetGap.y + resetGap.h / 2).toBe(signIn.y + signIn.h / 2);
    expect(resetGap.x).not.toBe(signIn.x);

    // Two connections leave the same row; their labels are fanned off centre
    // so they do not print on top of each other.
    const success = proposalToWorld(proposal, "app").links.find((link) => link.id === "link_edge:success")!;
    const failure = proposalToWorld(proposal, "app").links.find((link) => link.id === "link_edge:failure")!;
    expect(success.labelPosition).not.toBe(failure.labelPosition);
    expect(success.labelPosition).toBeGreaterThanOrEqual(0.18);
    expect(failure.labelPosition).toBeLessThanOrEqual(0.82);
  });

  it("draws connections only within a flow, not across flows", () => {
    const proposal: AnalysisProposal = {
      nodes: [
        { id: "screen:login", kind: "screen", title: "Log in", applicationArea: "web", flowId: "auth", flowTitle: "Auth", evidence, factors, confidence },
        { id: "screen:home", kind: "screen", title: "Home", applicationArea: "web", flowId: "main", flowTitle: "Main", evidence, factors, confidence },
      ],
      edges: [
        { id: "edge:cross", kind: "screen_transition", fromId: "screen:login", toId: "screen:home", label: "Success", evidence, factors, confidence },
      ],
    };
    expect(proposalToWorld(proposal, "app").links).toEqual([]);
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
    // Evidence 1-4 read across two adjacent windows (no single window contains it).
    expect(findUnreadEvidence(proposal, [
      { path: "src/App.tsx", startLine: 1, endLine: 2 },
      { path: "src/App.tsx", startLine: 3, endLine: 6 },
    ])).toEqual([]);
  });
});
