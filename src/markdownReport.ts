import type { AnalysisEdge, AnalysisNode, EvidenceReference } from "./analysis";
import { groupFlows } from "./flows";
import { buildGitHubEvidenceUrl } from "./github";
import type { AppStoryProject } from "./projectFile";

function text(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(/[\\`*_{}[\]()#+\-.!|]/g, "\\$&")
    .replaceAll(/\r?\n/g, " ");
}

function evidenceLine(project: AppStoryProject, evidence: EvidenceReference): string {
  const label = text(`${evidence.path}:${evidence.startLine}-${evidence.endLine}`);
  if (project.repository.source !== "github") return `- ${label} (${text(evidence.source)})`;
  const url = buildGitHubEvidenceUrl({ ...project.repository.revision, ...evidence });
  return `- [${label}](${url}) (${text(evidence.source)})`;
}

function itemDetails(project: AppStoryProject, item: AnalysisNode | AnalysisEdge): string[] {
  return [
    `- ID: ${text(item.id)}`,
    `- Kind: ${text(item.kind.replaceAll("_", " "))}`,
    `- Confidence: ${text(item.confidence.label)} ${item.confidence.score}% — ${text(item.confidence.reason)}`,
    "- Evidence Factors:",
    ...item.factors.map((factor) => `  - ${text(factor.strength)} ${text(factor.kind)}: ${text(factor.detail)}`),
    "- Evidence:",
    ...item.evidence.map((evidence) => `  ${evidenceLine(project, evidence)}`),
  ];
}

export function buildMarkdownReport(project: AppStoryProject): string {
  const analysis = project.acceptedAnalysis;
  const flows = groupFlows(analysis);
  const gaps = analysis.nodes.filter((node) => node.kind === "possible_gap" || node.kind === "unknown_path");
  const repository = project.repository.source === "github"
    ? `GitHub ${text(`${project.repository.revision.owner}/${project.repository.revision.repo}`)} at ${project.repository.revision.commitSha}`
    : `Local ${text(project.repository.revision.repo)} at fingerprint ${project.repository.revision.commitSha}`;
  const lines = [
    `# ${text(project.projectName)}`,
    "",
    `Repository Revision: ${repository}`,
    "",
    `Summary: ${flows.length} flow${flows.length === 1 ? "" : "s"}, ${analysis.nodes.length} item${analysis.nodes.length === 1 ? "" : "s"}, ${analysis.edges.length} connection${analysis.edges.length === 1 ? "" : "s"}, ${gaps.length} possible gap${gaps.length === 1 ? "" : "s"}.`,
    "",
    "## Flows",
  ];
  const renderedEdges = new Set<string>();
  for (const flow of flows) {
    lines.push("", `### ${text(flow.title)}`);
    for (const nodeId of flow.nodeIds) {
      const node = analysis.nodes.find((candidate) => candidate.id === nodeId)!;
      lines.push("", `#### ${text(node.title)}`, "", `Application Area: ${text(node.applicationArea)}`, "", ...itemDetails(project, node));
    }
    for (const edgeId of flow.edgeIds) {
      const edge = analysis.edges.find((candidate) => candidate.id === edgeId)!;
      const from = analysis.nodes.find((node) => node.id === edge.fromId)?.title ?? edge.fromId;
      const to = analysis.nodes.find((node) => node.id === edge.toId)?.title ?? edge.toId;
      lines.push("", `#### ${text(from)} — ${text(edge.label)} → ${text(to)}`, "", ...itemDetails(project, edge));
      renderedEdges.add(edge.id);
    }
  }
  const crossFlowEdges = analysis.edges.filter((edge) => !renderedEdges.has(edge.id));
  if (crossFlowEdges.length) {
    lines.push("", "## Cross-flow connections");
    for (const edge of crossFlowEdges) lines.push("", `### ${text(edge.fromId)} — ${text(edge.label)} → ${text(edge.toId)}`, "", ...itemDetails(project, edge));
  }
  if (gaps.length) {
    lines.push("", "## Gap review");
    for (const gap of gaps) {
      const review = project.gapReviews[gap.id];
      lines.push("", `### ${text(gap.title)}`, "", `- Status: ${text(review?.status ?? "possible")}`);
      if (review) {
        lines.push(`- Impact: ${text(review.impact)}`, `- Reason: ${text(review.reason)}`);
        if (review.reviewer) lines.push(`- Reviewer: ${text(review.reviewer)} (unverified)`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}
