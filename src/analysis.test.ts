import { describe, expect, it } from "vitest";
import {
  applyProposalBatch,
  calculateConfidence,
  emptyAnalysisProposal,
  type AnalysisNode,
  type AnalysisProposal,
  type ProposalBatch,
  type RepositoryIndex,
} from "./analysis";

const repository: RepositoryIndex = {
  files: [
    { path: "src/App.tsx", lineCount: 80, hash: "app" },
    { path: "src/App.test.tsx", lineCount: 40 },
  ],
};

function screen(overrides: Partial<AnalysisNode> = {}): AnalysisNode {
  return {
    id: "screen:home",
    kind: "screen",
    title: "Home",
    applicationArea: "web",
    evidence: [
      {
        path: "src/App.tsx",
        startLine: 10,
        endLine: 20,
        source: "source_code",
      },
    ],
    factors: [
      {
        kind: "screen_implementation",
        strength: "strong",
        detail: "The component renders the Home screen.",
      },
    ],
    confidence: {
      score: 90,
      label: "confirmed",
      reason: "Direct screen implementation.",
      traceable: true,
    },
    ...overrides,
  };
}

describe("analysis proposals", () => {
  it("calculates confidence from classified Evidence Factors", () => {
    expect(calculateConfidence(
      screen().evidence,
      screen().factors,
      true,
      "Direct implementation.",
    )).toEqual({
      score: 80,
      label: "confirmed",
      reason: "Direct implementation.",
      traceable: true,
    });
    expect(calculateConfidence(
      screen().evidence,
      [...screen().factors, { kind: "conflict", strength: "strong", detail: "Sources disagree." }],
      true,
      "Conflicting sources.",
    )).toMatchObject({ score: 35, label: "unknown" });
  });
  it("accepts every essential graph node and edge kind as one batch", () => {
    const kinds = [
      "actor",
      "screen",
      "decision",
      "system",
      "data_store",
      "external_system",
      "outcome",
      "possible_gap",
      "unknown_path",
    ] as const;
    const nodes = kinds.map((kind, index) =>
      screen({ id: `${kind}:${index}`, kind, title: kind }),
    );
    const edgeKinds = [
      "user_action",
      "screen_transition",
      "data_transfer",
      "system_event",
      "validation_result",
      "dependency",
    ] as const;
    const edges = edgeKinds.map((kind, index) => ({
      id: `edge:${index}`,
      kind,
      fromId: nodes[index].id,
      toId: nodes[index + 1].id,
      label: kind,
      evidence: nodes[index].evidence,
      factors: nodes[index].factors,
      confidence: nodes[index].confidence,
    }));

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      { nodes, edges },
      repository,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposal.nodes).toHaveLength(kinds.length);
    expect(result.proposal.edges).toHaveLength(edgeKinds.length);
  });

  it("accepts inferred and untraceable unknown confidence estimates", () => {
    const inferred = screen({
      id: "screen:inferred",
      confidence: {
        score: 65,
        label: "inferred",
        reason: "A test names the route, but source is indirect.",
        traceable: true,
      },
    });
    const unknown = screen({
      id: "unknown:dynamic-route",
      kind: "unknown_path",
      confidence: {
        score: 75,
        label: "unknown",
        reason: "Runtime routing cannot be traced statically.",
        traceable: false,
      },
    });

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      { nodes: [inferred, unknown], edges: [] },
      repository,
    );

    expect(result.ok).toBe(true);
  });

  it("rejects confirmed estimates without direct source-code Evidence", () => {
    const node = screen({
      evidence: [
        {
          path: "src/App.test.tsx",
          startLine: 3,
          endLine: 8,
          source: "test",
        },
      ],
    });

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      { nodes: [node], edges: [] },
      repository,
    );

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          code: "CONFIRMED_WITHOUT_DIRECT_EVIDENCE",
          itemType: "node",
          itemId: "screen:home",
          path: "confidence.label",
          message: "confirmed requires direct source-code Evidence",
        },
      ],
    });
  });

  it("rejects confirmed estimates when strong Evidence conflicts", () => {
    const node = screen({
      factors: [
        ...screen().factors,
        {
          kind: "conflict",
          strength: "strong",
          detail: "The route test points to a different Screen.",
        },
      ],
    });

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      { nodes: [node], edges: [] },
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "CONFIRMED_WITH_CONFLICT",
          itemId: "screen:home",
          path: "confidence.label",
        },
      ],
    });
  });

  it.each([
    ["confirmed", 79, "CONFIRMED_SCORE_OUT_OF_RANGE"],
    ["inferred", 80, "INFERRED_SCORE_OUT_OF_RANGE"],
    ["unknown", 40, "UNKNOWN_SCORE_OUT_OF_RANGE"],
  ] as const)(
    "rejects %s at score %i when the path is traceable",
    (label, score, code) => {
      const node = screen({
        confidence: {
          score,
          label,
          reason: "Boundary check.",
          traceable: true,
        },
      });

      const result = applyProposalBatch(
        emptyAnalysisProposal(),
        { nodes: [node], edges: [] },
        repository,
      );

      expect(result).toMatchObject({
        ok: false,
        errors: [{ code, itemId: "screen:home" }],
      });
    },
  );

  it("rejects invented files and invalid line ranges precisely", () => {
    const node = screen({
      evidence: [
        {
          path: "src/Missing.tsx",
          startLine: 9,
          endLine: 2,
          source: "source_code",
        },
      ],
    });

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      { nodes: [node], edges: [] },
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "UNKNOWN_EVIDENCE_PATH",
          path: "evidence[0].path",
        },
        {
          code: "INVALID_EVIDENCE_RANGE",
          path: "evidence[0]",
        },
      ],
    });
  });

  it("rejects edges with unknown endpoints", () => {
    const node = screen();
    const batch: ProposalBatch = {
      nodes: [node],
      edges: [
        {
          id: "edge:missing",
          kind: "screen_transition",
          fromId: node.id,
          toId: "screen:missing",
          label: "Continue",
          evidence: node.evidence,
          factors: node.factors,
          confidence: node.confidence,
        },
      ],
    };

    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      batch,
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "UNKNOWN_EDGE_ENDPOINT",
          itemType: "edge",
          itemId: "edge:missing",
          path: "toId",
        },
      ],
    });
  });

  it("rejects the whole batch and leaves the supplied proposal unchanged", () => {
    const existing = screen({ id: "screen:existing", title: "Existing" });
    const proposal: AnalysisProposal = {
      nodes: [existing],
      edges: [],
    };
    const snapshot = structuredClone(proposal);
    const valid = screen({ id: "screen:new", title: "New" });
    const duplicate = screen({ id: "screen:existing", title: "Duplicate" });

    const result = applyProposalBatch(
      proposal,
      { nodes: [valid, duplicate], edges: [] },
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: [
        {
          code: "DUPLICATE_NODE_ID",
          itemId: "screen:existing",
          path: "id",
        },
      ],
    });
    expect(proposal).toEqual(snapshot);
    expect(proposal.nodes).toHaveLength(1);
  });

  it("rejects identities reserved by canvas links and application areas", () => {
    const areaCollision = screen({ id: "area:web" });
    const linkCollision = screen({ id: "link_edge:route" });
    const target = screen({ id: "screen:target" });
    const result = applyProposalBatch(
      emptyAnalysisProposal(),
      {
        nodes: [areaCollision, linkCollision, target],
        edges: [{
          id: "edge:route",
          kind: "screen_transition",
          fromId: linkCollision.id,
          toId: target.id,
          label: "Open",
          evidence: target.evidence,
          factors: target.factors,
          confidence: target.confidence,
        }],
      },
      repository,
    );

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: "RESERVED_CANVAS_ID", itemId: "area:web" }),
        expect.objectContaining({ code: "CANVAS_ID_CONFLICT", itemId: "edge:route" }),
      ]),
    });
  });
});
