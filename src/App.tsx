import { useCallback, useEffect, useRef, useState } from "react";
import { exportAs, type Editor } from "tldraw";
import { emptyAnalysisProposal, type AnalysisProposal } from "./analysis";
import { proposalToWorld } from "./appStory";
import { AppStoryTools, APP_STORY_TOOLS, type ReadRecord } from "./AppStoryTools";
import { applyWorld, shapeIdFor } from "./adapter";
import { Canvas } from "./canvas";
import { HowToPlay } from "./help";
import { buildGitHubEvidenceUrl, type RepositoryIndex } from "./github";
import { applyGapReview, type GapImpact, type GapReview, type GapReviewMap, type GapReviewStatus } from "./gapReview";
import { Legend } from "./legend";
import { ReadRecordList, SourceReadsButton } from "./readRecords";
import { Logo } from "./Logo";
import { groupFlows } from "./flows";
import { connectLocalRepository, type LocalDirectoryHandle, type LocalRepositoryConnection } from "./localRepository";
import { buildMarkdownReport } from "./markdownReport";
import { deleteAppStory, loadAppStory, saveAppStory, type AppStoryPersistPayload } from "./persist";
import { MAX_PROJECT_FILE_BYTES, parseProjectFile, serializeProjectFile, type AppStoryProject } from "./projectFile";
import { connectPublicGitHub, readRepositoryLines, type SourceResult } from "./repository";
import { StatusChip, CardCount } from "./status";
import { AgentToast } from "./toast";
import { compareAnalysisRevisions } from "./revisionComparison";
import { webmcpSupported } from "./webmcpSupport";
import "./styles.css";

const EMPTY = emptyAnalysisProposal();

function GapReviewControls({
  nodeId,
  current,
  onSave,
}: {
  nodeId: string;
  current?: GapReview;
  onSave: (input: { nodeId: string; status: GapReviewStatus; impact: GapImpact; reason: string; reviewer?: string }) => void;
}) {
  const [status, setStatus] = useState<GapReviewStatus>(current?.status ?? "possible");
  const [impact, setImpact] = useState<GapImpact>(current?.impact ?? "medium");
  const [reason, setReason] = useState(current?.reason ?? "");
  const [reviewer, setReviewer] = useState(current?.reviewer ?? "");
  return (
    <form className="app-story-gap-review" onSubmit={(event) => {
      event.preventDefault();
      onSave({ nodeId, status, impact, reason, ...(reviewer.trim() ? { reviewer } : {}) });
    }}>
      <label>Status <select value={status} onChange={(event) => setStatus(event.target.value as GapReviewStatus)}>
        <option value="possible">Possible</option>
        <option value="confirmed">Confirmed</option>
        <option value="accepted_risk">Accepted risk</option>
        <option value="not_applicable">Not applicable</option>
      </select></label>
      <label>Impact <select value={impact} onChange={(event) => setImpact(event.target.value as GapImpact)}>
        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
      </select></label>
      <label>Reason <input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <label>Reviewer <input value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></label>
      <button type="submit">Save review</button>
    </form>
  );
}

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [projectName, setProjectName] = useState("Untitled app");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [repositoryIndex, setRepositoryIndex] = useState<RepositoryIndex | null>(null);
  const [repositorySource, setRepositorySource] = useState<"github" | "local" | null>(null);
  const [localConnection, setLocalConnection] = useState<LocalRepositoryConnection | null>(null);
  const [consent, setConsent] = useState(false);
  const [proposal, setProposal] = useState<AnalysisProposal>(EMPTY);
  const [acceptedAnalysis, setAcceptedAnalysis] = useState<AnalysisProposal>(EMPTY);
  const [finalized, setFinalized] = useState(false);
  const [analysisSessionId, setAnalysisSessionId] = useState<string | null>(null);
  const [technicalRootId, setTechnicalRootId] = useState<string | null>(null);
  const [gapReviews, setGapReviews] = useState<GapReviewMap>({});
  const [expandedFlowIds, setExpandedFlowIds] = useState<Set<string>>(new Set());
  const [readRecords, setReadRecords] = useState<ReadRecord[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [exportingImage, setExportingImage] = useState<"svg" | "png" | null>(null);
  const [readsOpen, setReadsOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const stateRef = useRef({ projectName, repositoryIndex, repositorySource, consent, acceptedAnalysis, proposal, finalized, readRecords, analysisSessionId, gapReviews, expandedFlowIds });
  stateRef.current = { projectName, repositoryIndex, repositorySource, consent, acceptedAnalysis, proposal, finalized, readRecords, analysisSessionId, gapReviews, expandedFlowIds };

  // The canvas holds nothing a reader can change — it is a pure projection of
  // the analysis below (see `world.ts`) — so there is nothing on it worth
  // saving. Persisting a tldraw snapshot would only let a stale layout survive
  // a code change, which is the bug `onReady` used to work around. Save the
  // domain data only; `onReady` rebuilds the canvas from it on every load.
  const persist = useCallback((state = stateRef.current) => {
    const payload: AppStoryPersistPayload = {
      v: 1,
      projectName: state.projectName,
      repositoryIndex: state.repositoryIndex,
      consent: state.consent,
      acceptedAnalysis: state.acceptedAnalysis,
      proposal: state.proposal,
      finalized: state.finalized,
      readRecords: state.readRecords,
      analysisSessionId: state.analysisSessionId,
      gapReviews: state.gapReviews,
      expandedFlowIds: [...state.expandedFlowIds],
      repositorySource: state.repositorySource,
    };
    if (!saveAppStory(window.localStorage, payload).ok) setToast("Could not save in this browser.");
  }, []);

  // Debounced so typing in the project-name field does not write on every
  // keystroke.
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => persist(), 300);
  }, [persist]);

  const onReady = useCallback((ed: Editor) => {
    const saved = loadAppStory(window.localStorage);
    if (saved) {
      // Nothing on the canvas is saved — see `persist` above — so it is built
      // fresh from the accepted analysis every time the app opens.
      if (saved.acceptedAnalysis.nodes.length > 0) {
        applyWorld(
          ed,
          proposalToWorld(
            saved.acceptedAnalysis,
            saved.projectName,
            undefined,
            new Set(saved.expandedFlowIds),
          ),
        );
        // Fit the whole accepted graph on load; there is no saved camera to
        // restore it to instead.
        window.setTimeout(() => ed.zoomToFit(), 0);
      }
      setProjectName(saved.projectName);
      setRepositoryIndex(saved.repositoryIndex);
      setRepositorySource(saved.repositorySource);
      setConsent(saved.repositorySource === "local" ? false : saved.consent);
      setAcceptedAnalysis(saved.acceptedAnalysis);
      setProposal(saved.proposal);
      setFinalized(saved.finalized);
      setReadRecords(saved.readRecords);
      setAnalysisSessionId(saved.analysisSessionId);
      setGapReviews(saved.gapReviews);
      setExpandedFlowIds(new Set(saved.expandedFlowIds));
      if (saved.repositorySource === "local") {
        setConnectionError("Reconnect the local folder to read source files.");
      }
      stateRef.current = {
        projectName: saved.projectName,
        repositoryIndex: saved.repositoryIndex,
        repositorySource: saved.repositorySource,
        consent: saved.repositorySource === "local" ? false : saved.consent,
        acceptedAnalysis: saved.acceptedAnalysis,
        proposal: saved.proposal,
        finalized: saved.finalized,
        readRecords: saved.readRecords,
        analysisSessionId: saved.analysisSessionId,
        gapReviews: saved.gapReviews,
        expandedFlowIds: new Set(saved.expandedFlowIds),
      };
    }
    setEditor(ed);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  // A browser extension can inject `document.modelContext` after this mounts,
  // so a one-shot check would leave the chip stuck on "unavailable" while the
  // tools are in fact live. Re-check on a short cadence until it appears.
  useEffect(() => {
    if (webmcpSupported()) {
      setSupported(true);
      return;
    }
    const poll = window.setInterval(() => {
      if (webmcpSupported()) {
        setSupported(true);
        window.clearInterval(poll);
      }
    }, 1000);
    const stop = window.setTimeout(() => window.clearInterval(poll), 15000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, []);
  useEffect(() => {
    if (editor) scheduleSave();
  }, [editor, projectName, repositoryIndex, repositorySource, consent, acceptedAnalysis, proposal, finalized, readRecords, analysisSessionId, gapReviews, expandedFlowIds, scheduleSave]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activateRepository = (
    index: RepositoryIndex,
    source: "github" | "local",
    local: LocalRepositoryConnection | null = null,
  ) => {
    const { owner, repo } = index.revision;
    setRepositoryIndex(index);
    setRepositorySource(source);
    setLocalConnection(local);
    setProjectName(source === "local" ? repo : `${owner}/${repo}`);
    setConsent(false);
    setProposal(EMPTY);
    setAcceptedAnalysis(EMPTY);
    setFinalized(false);
    setAnalysisSessionId(null);
    setTechnicalRootId(null);
    setGapReviews({});
    setExpandedFlowIds(new Set());
    setReadRecords([]);
    if (editor) applyWorld(editor, { name: repo, cards: [], links: [] });
    setToast("Repository index ready.");
  };

  const connect = async () => {
    setConnecting(true);
    setConnectionError(null);
    const result = await connectPublicGitHub(repositoryUrl);
    setConnecting(false);
    if (!result.ok) {
      setConnectionError(result.error);
      return;
    }
    activateRepository(result.index, "github");
  };

  const connectLocal = async () => {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<LocalDirectoryHandle>;
    }).showDirectoryPicker;
    if (!picker) {
      setConnectionError("Local folder access is not supported in this browser.");
      return;
    }
    setConnecting(true);
    setConnectionError(null);
    try {
      const handle = await picker.call(window);
      const result = await connectLocalRepository(handle);
      if (!result.ok) setConnectionError(result.error);
      else activateRepository(result.index, "local", result);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setConnectionError("Could not open the local folder.");
      }
    } finally {
      setConnecting(false);
    }
  };

  const acceptProposal = () => {
    if (!editor || !finalized) return;
    const comparison = compareAnalysisRevisions(acceptedAnalysis, proposal);
    const removedIds = new Set(
      comparison.filter((item) => item.status === "possibly_removed").map((item) => item.itemId),
    );
    const keptGapReviews = Object.fromEntries(
      Object.entries(gapReviews).filter(([nodeId]) => !removedIds.has(nodeId)),
    );
    applyWorld(editor, proposalToWorld(proposal, projectName, undefined, new Set()));
    setAcceptedAnalysis(proposal);
    setProposal(EMPTY);
    setFinalized(false);
    setAnalysisSessionId(null);
    setTechnicalRootId(null);
    setGapReviews(keptGapReviews);
    setExpandedFlowIds(new Set());
    window.setTimeout(() => editor.zoomToFit({ animation: { duration: 300 } }), 0);
    setToast("Analysis proposal accepted.");
  };

  const deleteProject = () => {
    if (!window.confirm("Delete this App Story project? This cannot be undone without an export.")) return;
    deleteAppStory(window.localStorage);
    if (editor) applyWorld(editor, { name: "Untitled app", cards: [], links: [] });
    setProjectName("Untitled app");
    setRepositoryUrl("");
    setRepositoryIndex(null);
    setRepositorySource(null);
    setLocalConnection(null);
    setConsent(false);
    setProposal(EMPTY);
    setAcceptedAnalysis(EMPTY);
    setFinalized(false);
    setAnalysisSessionId(null);
    setTechnicalRootId(null);
    setGapReviews({});
    setExpandedFlowIds(new Set());
    setReadRecords([]);
    setToast("Project deleted.");
  };

  const portableProject = (): AppStoryProject | null => {
    if (!repositoryIndex || !repositorySource) return null;
    const revision = repositoryIndex.revision;
    const repository = repositorySource === "local"
      ? { source: "local" as const, revision: { repo: revision.repo, commitSha: revision.commitSha } }
      : { source: "github" as const, revision };
    return { projectName, repository, acceptedAnalysis, gapReviews, expandedFlowIds: [...expandedFlowIds] };
  };

  const downloadFile = (content: string, type: string, suffix: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, "-") || "app-story"}${suffix}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportProject = () => {
    const project = portableProject();
    if (!project) return;
    downloadFile(serializeProjectFile(project), "application/json", ".app-story.json");
    setToast("Project File exported.");
  };

  const exportMarkdownReport = () => {
    const project = portableProject();
    if (!project) return;
    let markdown: string;
    try {
      markdown = buildMarkdownReport(project);
    } catch {
      setToast("Could not build the Markdown report.");
      return;
    }
    downloadFile(markdown, "text/markdown;charset=utf-8", ".app-story.md");
    setToast("Markdown report exported.");
  };

  const exportGraph = async (format: "svg" | "png") => {
    if (!editor || acceptedAnalysis.nodes.length === 0) return;
    setExportingImage(format);
    try {
      const world = proposalToWorld(acceptedAnalysis, projectName, technicalRootId ?? undefined, expandedFlowIds);
      const ids = [...world.cards, ...world.links]
        .map((item) => shapeIdFor(item.id))
        .filter((id) => editor.getShape(id));
      if (ids.length === 0) throw new Error("The accepted graph is not on the canvas.");
      await exportAs(editor, ids, {
        format,
        name: projectName.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, "-") || "app-story",
        background: true,
        darkMode: false,
        padding: "auto",
      });
      setToast(`${format.toUpperCase()} graph exported.`);
    } catch {
      setToast(`Could not export the ${format.toUpperCase()} graph.`);
    } finally {
      setExportingImage(null);
    }
  };

  const importProject = async (file: File) => {
    if (file.size > MAX_PROJECT_FILE_BYTES) {
      setToast("Project File is larger than 5 MB.");
      return;
    }
    const parsed = parseProjectFile(await file.text());
    if (!parsed.ok) {
      setToast(parsed.error);
      return;
    }
    if (!window.confirm("Replace the current project with this Project File?")) return;
    const project = parsed.project;
    const revision = project.repository.source === "github"
      ? project.repository.revision
      : { owner: "local", ...project.repository.revision };
    const index: RepositoryIndex = { revision, files: [], truncated: false };
    const expanded = new Set(project.expandedFlowIds);
    setProjectName(project.projectName);
    setRepositoryIndex(index);
    setRepositorySource(project.repository.source);
    setLocalConnection(null);
    setConsent(false);
    setAcceptedAnalysis(project.acceptedAnalysis);
    setProposal(EMPTY);
    setFinalized(false);
    setAnalysisSessionId(null);
    setTechnicalRootId(null);
    setGapReviews(project.gapReviews);
    setExpandedFlowIds(expanded);
    setReadRecords([]);
    if (editor) applyWorld(editor, proposalToWorld(project.acceptedAnalysis, project.projectName, undefined, expanded));
    setConnectionError("Reconnect the repository to read source files.");
    setToast("Project File imported.");
  };

  const eligibleCount = repositoryIndex?.files.filter((file) => file.eligibility.eligible).length ?? 0;
  const excludedCount = (repositoryIndex?.files.length ?? 0) - eligibleCount;
  const evidenceUrl = (path: string, startLine: number, endLine: number) => {
    if (!repositoryIndex || repositorySource !== "github") return undefined;
    try {
      return buildGitHubEvidenceUrl({ ...repositoryIndex.revision, path, startLine, endLine });
    } catch {
      return undefined;
    }
  };
  const readSource = (path: string, startLine: number, endLine: number): Promise<SourceResult> => {
    if (!repositoryIndex) return Promise.resolve({ ok: false, error: "Connect a repository first." });
    if (repositorySource === "local") {
      return localConnection
        ? localConnection.readLines(path, startLine, endLine)
        : Promise.resolve({ ok: false, error: "Reconnect the local folder." });
    }
    return readRepositoryLines(repositoryIndex, path, startLine, endLine);
  };
  const showTechnicalFlow = (screenId: string | null) => {
    if (!editor) return;
    const nextExpanded = new Set(expandedFlowIds);
    if (screenId) {
      const screen = acceptedAnalysis.nodes.find((node) => node.id === screenId);
      nextExpanded.add(screen?.flowId?.trim() || "main");
    }
    setExpandedFlowIds(nextExpanded);
    setTechnicalRootId(screenId);
    applyWorld(editor, proposalToWorld(acceptedAnalysis, projectName, screenId ?? undefined, nextExpanded));
    window.setTimeout(() => editor.zoomToFit({ animation: { duration: 300 } }), 0);
  };
  const toggleFlow = (flowId: string) => {
    if (!editor) return;
    const next = new Set(expandedFlowIds);
    if (next.has(flowId)) next.delete(flowId); else next.add(flowId);
    setExpandedFlowIds(next);
    const technicalFlowId = acceptedAnalysis.nodes.find((node) => node.id === technicalRootId)?.flowId?.trim() || "main";
    const nextTechnicalRoot = technicalRootId && technicalFlowId === flowId && !next.has(flowId) ? null : technicalRootId;
    setTechnicalRootId(nextTechnicalRoot);
    applyWorld(editor, proposalToWorld(acceptedAnalysis, projectName, nextTechnicalRoot ?? undefined, next));
    window.setTimeout(() => editor.zoomToFit({ animation: { duration: 300 } }), 0);
  };
  const saveGapReview = (input: Parameters<typeof applyGapReview>[2]) => {
    try {
      setGapReviews(applyGapReview(acceptedAnalysis.nodes, gapReviews, input));
      setToast("Gap review saved.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not save gap review.");
    }
  };
  const flows = groupFlows(acceptedAnalysis);
  const revisionComparison = finalized && acceptedAnalysis.nodes.length > 0
    ? compareAnalysisRevisions(acceptedAnalysis, proposal)
    : [];
  const revisionSummary = revisionComparison.reduce(
    (counts, item) => {
      if (item.status === "added") counts.added += 1;
      else if (item.status === "changed") counts.changed += 1;
      else if (item.status === "possibly_removed") counts.possiblyRemoved += 1;
      return counts;
    },
    { added: 0, changed: 0, possiblyRemoved: 0 },
  );
  const draftInProgress = Boolean(
    repositoryIndex && consent && !finalized && (proposal.nodes.length > 0 || proposal.edges.length > 0),
  );

  return (
    <div className="lsw-app">
      <header className="lsw-header">
        <div>
          <Logo className="lsw-title" markSize={24} />
          <input className="lsw-world-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Project name" />
          <div className="lsw-sub">evidence-backed application flow</div>
        </div>
        <div className="lsw-header-right">
          <StatusChip supported={supported} toolCount={APP_STORY_TOOLS.length} />
          <CardCount cardCount={acceptedAnalysis.nodes.length} />
          <button
            type="button"
            disabled={!editor || acceptedAnalysis.nodes.length === 0}
            onClick={() => editor?.zoomToFit({ animation: { duration: 300 } })}
          >
            Fit to view
          </button>
          <SourceReadsButton records={readRecords} open={readsOpen} onToggle={() => setReadsOpen((v) => !v)} />
          <HowToPlay />
          <button type="button" disabled={!repositoryIndex} onClick={exportProject}>Export</button>
          <button type="button" disabled={!repositoryIndex} onClick={exportMarkdownReport}>Report</button>
          <button type="button" disabled={!editor || acceptedAnalysis.nodes.length === 0 || Boolean(exportingImage)} onClick={() => void exportGraph("svg")}>{exportingImage === "svg" ? "Exporting…" : "SVG"}</button>
          <button type="button" disabled={!editor || acceptedAnalysis.nodes.length === 0 || Boolean(exportingImage)} onClick={() => void exportGraph("png")}>{exportingImage === "png" ? "Exporting…" : "PNG"}</button>
          <button type="button" onClick={() => importInputRef.current?.click()}>Import</button>
          <input ref={importInputRef} className="app-story-file-input" type="file" accept="application/json,.json" aria-label="Import Project File" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void importProject(file);
          }} />
          {repositoryIndex && <button className="lsw-danger-btn" type="button" onClick={deleteProject}>Delete</button>}
        </div>
      </header>

      <section className="app-story-source" aria-label="Repository connection">
        <form onSubmit={(event) => { event.preventDefault(); void connect(); }}>
          <label htmlFor="repository-url">Public GitHub repository</label>
          <input id="repository-url" type="url" required placeholder="https://github.com/owner/repository" value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} />
          <button type="submit" disabled={connecting}>{connecting ? "Connecting…" : "Connect"}</button>
          <button type="button" disabled={connecting} onClick={() => void connectLocal()}>Choose local folder</button>
        </form>
        {connectionError && <p className="app-story-error" role="alert">{connectionError}</p>}
        {repositoryIndex && (
          <div className="app-story-repository-state">
            <span><strong>{repositorySource === "local" ? repositoryIndex.revision.repo : `${repositoryIndex.revision.owner}/${repositoryIndex.revision.repo}`}</strong> · {repositorySource ?? "repository"} · revision {repositoryIndex.revision.commitSha.slice(0, 8)}</span>
            <span>{eligibleCount} approved files · {excludedCount} excluded{repositoryIndex.truncated ? " · GitHub index truncated" : ""}</span>
            {excludedCount > 0 && (
              <details>
                <summary>Review exclusions</summary>
                <ul>
                  {repositoryIndex.files.filter((file) => !file.eligibility.eligible).slice(0, 20).map((file) => (
                    <li key={file.path}>{file.path} — {file.eligibility.eligible ? "" : file.eligibility.reason}</li>
                  ))}
                </ul>
              </details>
            )}
            <label>
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              Allow WebMCP to return approved source text to the connected AI provider
            </label>
          </div>
        )}
      </section>

      {draftInProgress && (
        <section className="app-story-draft" aria-label="Analysis in progress" aria-live="polite">
          <strong>Analysis in progress:</strong> {proposal.nodes.length} node{proposal.nodes.length === 1 ? "" : "s"} and {proposal.edges.length} connection{proposal.edges.length === 1 ? "" : "s"} in draft
          <button type="button" onClick={() => { setProposal(EMPTY); setAnalysisSessionId(null); }}>Discard draft</button>
        </section>
      )}

      {finalized && (
        <section className="app-story-review" aria-label="Analysis proposal review">
          <details open>
            <summary><strong>Proposal ready:</strong> {proposal.nodes.length} nodes and {proposal.edges.length} connections</summary>
            {revisionComparison.length > 0 && (
              <p className="app-story-revision-summary">
                Compared to the accepted analysis: {revisionSummary.added} added, {revisionSummary.changed} changed, {revisionSummary.possiblyRemoved} possibly removed
              </p>
            )}
            <ul>
              {proposal.nodes.map((node) => {
                const change = revisionComparison.find((item) => item.itemType === "node" && item.itemId === node.id)?.status;
                return (
                <li key={node.id}>
                  <strong>{node.title}</strong>
                  {change && change !== "unchanged" && <span className={`app-story-revision-${change}`}> · {change.replaceAll("_", " ")}</span>}
                  {" · "}{node.kind.replaceAll("_", " ")} · {node.confidence.label} {node.confidence.score}%
                  <div>{node.factors.map((factor) => `${factor.strength} ${factor.kind}: ${factor.detail}`).join("; ")}</div>
                  <div>{node.evidence.map((item) => `${item.path}:${item.startLine}-${item.endLine}`).join(", ")}</div>
                </li>
              );})}
              {proposal.edges.map((edge) => {
                const change = revisionComparison.find((item) => item.itemType === "edge" && item.itemId === edge.id)?.status;
                return (
                <li key={edge.id}>
                  <strong>{edge.label}</strong>
                  {change && change !== "unchanged" && <span className={`app-story-revision-${change}`}> · {change.replaceAll("_", " ")}</span>}
                  {" · "}{edge.fromId} → {edge.toId} · {edge.confidence.label} {edge.confidence.score}%
                </li>
              );})}
              {revisionComparison.filter((item) => item.status === "possibly_removed").map((item) => (
                <li key={`${item.itemType}:${item.itemId}`} className="app-story-revision-possibly_removed">
                  <strong>{item.itemId}</strong> · possibly removed {item.itemType}
                </li>
              ))}
            </ul>
          </details>
          <div className="app-story-review-actions">
            <button type="button" onClick={acceptProposal}>Accept proposal</button>
            <button type="button" onClick={() => { setProposal(EMPTY); setFinalized(false); setAnalysisSessionId(null); }}>Discard</button>
          </div>
        </section>
      )}

      <main className="lsw-main">
        <Canvas onReady={onReady} />
        {acceptedAnalysis.nodes.length === 0 && (
          <div className="lsw-empty">
            {repositoryIndex ? (draftInProgress ? "Your WebMCP agent is building an analysis proposal. Select Source reads in the header to see what it has read." : consent ? "Repository ready. Ask your WebMCP agent to map the main UI flow." : "Review the repository scope and grant source access.") : "Connect a public GitHub repository to map its application story."}
          </div>
        )}
        <aside className={outlineOpen ? "app-story-outline" : "app-story-outline app-story-outline-closed"} aria-label="Flow outline">
          <div className="app-story-outline-head">
            <h2>Flow outline</h2>
            <button type="button" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((v) => !v)}>
              {outlineOpen ? "Hide" : "Show"}
            </button>
          </div>
          {!outlineOpen ? null : acceptedAnalysis.nodes.length === 0 ? <p>No accepted analysis.</p> : (
            <>
            <ul className="app-story-flow-list">
              {flows.map((flow) => (
                <li key={flow.id}>
                  <strong>{flow.title}</strong> · {flow.nodeIds.length} item{flow.nodeIds.length === 1 ? "" : "s"}
                  <button type="button" aria-expanded={expandedFlowIds.has(flow.id)} onClick={() => toggleFlow(flow.id)}>
                    {expandedFlowIds.has(flow.id) ? "Collapse flow" : "Expand flow"}
                  </button>
                </li>
              ))}
            </ul>
            <ul>
              {acceptedAnalysis.nodes.map((node) => (
                <li key={node.id}>
                  <details>
                    <summary>{node.title} · {node.confidence.label} {node.confidence.score}%</summary>
                    <p>{node.kind.replaceAll("_", " ")} · {node.applicationArea}</p>
                    <p>{node.confidence.reason}</p>
                    {node.kind === "screen" && <button type="button" onClick={() => showTechnicalFlow(node.id)}>Expand technical flow</button>}
                    {(node.kind === "possible_gap" || node.kind === "unknown_path") && (
                      <GapReviewControls nodeId={node.id} current={gapReviews[node.id]} onSave={saveGapReview} />
                    )}
                    <ul>{node.factors.map((factor, index) => <li key={`${factor.kind}:${index}`}>{factor.strength} {factor.kind}: {factor.detail}</li>)}</ul>
                    <ul>{node.evidence.map((item) => {
                      const url = evidenceUrl(item.path, item.startLine, item.endLine);
                      return <li key={`${item.path}:${item.startLine}-${item.endLine}`}>{url ? <a href={url} target="_blank" rel="noreferrer">{item.path}:{item.startLine}-{item.endLine}</a> : `${item.path}:${item.startLine}-${item.endLine}`}</li>;
                    })}</ul>
                  </details>
                </li>
              ))}
            </ul>
            </>
          )}
          {outlineOpen && technicalRootId && <button type="button" onClick={() => showTechnicalFlow(null)}>Collapse technical flow</button>}
          {outlineOpen && acceptedAnalysis.edges.length > 0 && (
            <details>
              <summary>{acceptedAnalysis.edges.length} connection{acceptedAnalysis.edges.length === 1 ? "" : "s"}</summary>
              <ul>{acceptedAnalysis.edges.map((edge) => (
                <li key={edge.id}>
                  <details>
                    <summary>{edge.fromId} — {edge.label} → {edge.toId} · {edge.confidence.label} {edge.confidence.score}%</summary>
                    <p>{edge.kind.replaceAll("_", " ")}</p>
                    <p>{edge.confidence.reason}</p>
                    <ul>{edge.factors.map((factor, index) => <li key={`${factor.kind}:${index}`}>{factor.strength} {factor.kind}: {factor.detail}</li>)}</ul>
                    <ul>{edge.evidence.map((item) => {
                      const url = evidenceUrl(item.path, item.startLine, item.endLine);
                      return <li key={`${item.path}:${item.startLine}-${item.endLine}`}>{url ? <a href={url} target="_blank" rel="noreferrer">{item.path}:{item.startLine}-{item.endLine}</a> : `${item.path}:${item.startLine}-${item.endLine}`}</li>;
                    })}</ul>
                  </details>
                </li>
              ))}</ul>
            </details>
          )}
          {outlineOpen && readRecords.length > 0 && (
            <details>
              <summary>{readRecords.length} source read{readRecords.length === 1 ? "" : "s"}</summary>
              <ReadRecordList records={readRecords} />
            </details>
          )}
        </aside>
        <AgentToast message={toast} />
      </main>
      <Legend />
      <AppStoryTools repositoryIndex={repositoryIndex} repositorySource={repositorySource} readSource={readSource} consent={consent} proposal={proposal} acceptedAnalysis={acceptedAnalysis} finalized={finalized} readRecords={readRecords} analysisSessionId={analysisSessionId} onAnalysisSession={setAnalysisSessionId} onReadRecord={(record) => setReadRecords((current) => [...current, record])} onProposal={setProposal} onFinalize={() => setFinalized(true)} />
    </div>
  );
}
