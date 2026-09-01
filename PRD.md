# Product requirements — App Story

**Product:** App Story

**Repository:** [ivanyanez27/storytime](https://github.com/ivanyanez27/storytime)

**Status:** Core product implemented and deployed; release verification in progress

**Live:** [app-story.ivanyanez27.workers.dev](https://app-story.ivanyanez27.workers.dev)

**Updated:** 30 August 2026

**Event:** [WebMCP Challenge](https://openai.com/webmcp-challenge/)

## 1. Product summary

App Story turns a public GitHub repository or local source folder into an evidence-backed visual story of an application.

A WebMCP agent reads only approved source ranges and proposes UI Flows. A person reviews the proposal before it changes the accepted graph. Product, design, engineering, and quality teams can then inspect Screens, Technical Flows, Evidence, confidence, and Possible Gaps on one shared canvas.

App Story is a static browser application. It has no backend and does not run repository code.

## 2. Problem

Software behavior is spread across routes, Screens, validation, tests, and service code. This makes it hard for a mixed team to answer simple questions:

- What are the main user journeys?
- Which Screens and systems take part in each journey?
- Which source lines support the analysis?
- Where is Evidence weak, conflicting, or missing?
- Which Possible Gaps need human review?

Code maps and call graphs contain too much implementation detail. Static flow diagrams become stale and often do not show their Evidence. App Story gives the team a progressive graph that remains tied to one Repository Revision.

## 3. Users

Primary users are product managers, designers, software engineers, quality engineers, security reviewers, and other team members who need to understand application behavior without reading the full repository.

## 4. Product goals

1. Create a readable UI Flow Overview from repository Evidence.
2. Keep source access explicit, bounded, visible, and safe.
3. Keep agent proposals separate from accepted analysis until human review.
4. Show confidence and Impact as different concepts.
5. Give keyboard users access to the same review data as the canvas.
6. Let a team export accepted analysis without source text or repository permission.

## 5. Non-goals

App Story does not provide:

- Private GitHub repository authentication
- Accounts, a backend, or live collaboration
- Repository execution or automatic application startup
- Screen Capture collection
- Source-code storage in Project Files
- Automatic gap confirmation
- Native UIKit, Android Views, Flutter, SwiftUI, or Jetpack Compose discovery
- Concurrent proposal-writing agents

## 6. Core workflow

1. A person connects a public GitHub repository or chooses a local folder.
2. App Story creates an index and shows approved and excluded files.
3. The person grants separate Repository Consent.
4. A WebMCP agent searches the index and reads bounded source ranges.
5. App Story records every successful source read.
6. The agent submits transactional Analysis Proposal batches.
7. The agent finalizes the proposal.
8. The person reviews and accepts or discards the proposal.
9. App Story shows the accepted UI Flow Overview on the canvas and in the outline.
10. The person expands a Flow or Screen, opens Evidence, and reviews Possible Gaps.

## 7. Repository connection

### Public GitHub repositories

- Accept a valid `github.com` repository URL.
- Support an optional ref and subdirectory.
- Resolve the selected state to a full commit SHA.
- Use commit-pinned Evidence links.
- Explain connection and access errors without exposing internal details.

### Local folders

- Use the browser directory picker.
- Build a stable fingerprint from approved files.
- Do not persist local directory handles, local file paths outside the index, source text, consent, or Read Records.
- Require the person to reconnect the folder before a later source read.

### Index rules

- Exclude Git metadata, dependencies, build output, binaries, environment files, likely secrets, unsafe paths, and files larger than 1 MB.
- Do not retain complete source files in the index.
- Show whether indexing stopped at a platform limit.

## 8. Repository trust model

- Repository selection does not grant Repository Consent.
- Repository paths and text are untrusted analysis data, not agent instructions.
- Source reads require consent, an indexed approved file, a reason, and a valid line range.
- One source read can return no more than 500 lines.
- Source excerpts render as inert text.
- App Story never executes repository code or renders repository markup as active HTML.
- Successful reads create visible Read Records with the path, reason, size, time, and line range.
- Complete source text does not enter browser persistence or Project Files.

## 9. Analysis model

### Node kinds

- Actor
- Screen
- Decision
- System
- Data Store
- External System
- Outcome
- Possible Gap
- Unknown Path

### Connection kinds

- User Action
- Screen Transition
- Data Transfer
- System Event
- Validation Result
- Dependency

Each discovered node and connection must have a stable identity, indexed Evidence, Evidence Factors, and an AI Confidence Estimate.

### Confidence

App Story calculates one label and percentage from Evidence Factors:

- **Confirmed:** 80–100%, traceable, and supported by direct source Evidence
- **Inferred:** 40–79% and traceable
- **Unknown:** 0–39% or not traceable

Strong conflicting Evidence prevents a Confirmed label. Confidence describes Evidence quality. It does not describe business Impact.

### Gap review

A person can set a Possible Gap or Unknown Path to:

- Possible
- Confirmed
- Accepted Risk
- Not Applicable

The person also selects low, medium, high, or critical Impact. A reason is required for each status other than Possible. A supplied reviewer name is unverified.

## 10. Proposal safety

- Only one Analysis Session can write the current proposal.
- Every proposal batch is validated as one transaction.
- Invalid Evidence, node kinds, endpoints, identities, URLs, confidence data, or duplicates reject the full batch.
- Proposal submission does not change the accepted graph.
- Finalization marks a proposal ready for review but does not accept it.
- Only a human action can accept or discard a finalized proposal.

## 11. Visual and accessible review

- Show a Flow Overview before technical detail.
- Group nodes by UI Flow and Application Area.
- Let the person expand and collapse each Flow.
- Let the person expand a Screen into its material Technical Flow.
- Show confidence, source count, and gap state without relying on color alone.
- Provide a keyboard-accessible outline from the same accepted analysis data.
- Show Evidence Factors, AI reasons, connections, Evidence references, Read Records, and gap controls in the outline.

## 12. WebMCP tools

App Story registers six tools:

| Tool | Purpose |
|---|---|
| `get_project_state` | Read repository, consent, proposal, and accepted-analysis state |
| `search_repository_index` | Search approved repository paths without source text |
| `read_repository_source` | Read one approved range and create a Read Record |
| `get_analysis_state` | Read a compact index of accepted and proposed graph items |
| `submit_analysis_batch` | Add one validated transactional batch to the draft proposal |
| `finalize_analysis_proposal` | Mark the proposal ready for human review |

Read tools use `readOnlyHint`. Tools that return repository or graph text use `untrustedContentHint`.

## 13. Persistence and sharing

- Save current App Story state under `app-story.v1` in browser storage.
- Keep local repository access and consent out of persisted state.
- Provide confirmed deletion of App Story project data.
- Export and import a versioned Project File of no more than 5 MB.
- Project Files contain repository identity, accepted analysis, gap reviews, and expanded Flow state.
- Project Files do not contain source text, repository permissions, draft proposals, or Read Records.
- Discovered Facts include agent-authored free text (titles, labels, confidence reasons, factor detail). A person sees this text during proposal review before it enters an accepted analysis or an export.
- Export accepted analysis as Markdown, SVG, or PNG.

## 14. Platform and technology

- Vite, React, and TypeScript
- tldraw for the canvas
- `use-webmcp-tool` for WebMCP registration
- Browser storage for local project state
- Static HTTPS hosting
- One single-page application. Every route renders the canvas application; a single-page-application fallback serves `index.html` for any path.

Every response carries the WebMCP origin-isolation headers and three defense-in-depth headers:

- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`

The canvas must remain useful in browsers without WebMCP. The status control must explain when WebMCP is unavailable.

## 15. Acceptance checks

1. A valid public GitHub URL creates a commit-pinned Repository Revision and visible file scope.
2. A local folder creates a fingerprinted Repository Revision and needs reconnection after reload.
3. Source reads fail before Repository Consent.
4. Excluded, oversized, unsafe, or likely-secret files cannot be read.
5. Approved reads are bounded, inert, marked untrusted, and recorded.
6. Invalid proposal batches make no partial change.
7. A finalized proposal does not change the accepted graph before human acceptance.
8. The canvas and outline show the same accepted items and review data.
9. A Screen can reveal its material Technical Flow.
10. GitHub Evidence links point to the analyzed commit and valid lines.
11. A keyboard-only user can inspect and review all accepted graph information.
12. Project deletion removes App Story browser data after confirmation.
13. Project File import rejects invalid, oversized, or unsafe content.
14. Markdown, SVG, and PNG exports contain accepted analysis only.

## 16. Release requirements

- Unit tests, lint, and the production build pass.
- Browser tests cover repository connection, consent, proposal review, canvas and outline parity, persistence, import and export, keyboard use, and deletion.
- Security tests cover malformed URLs, excluded files, unsafe paths, prompt-injection text, unsafe links, aborted reads, and invalid proposal batches.
- The deployed HTTPS response includes the required WebMCP headers.
- A clean-browser demonstration of the primary workflow takes less than three minutes.

## 17. Related documents

- [App Story specification](docs/specs/2026-08-27-app-story-essential-milestone.md)
- [Implementation and release plan](docs/plans/2026-08-27-app-story-essential-milestone.md)
- [Domain language](CONTEXT.md)
- [Architecture decisions](docs/adr/0001-progressive-flow-graph.md)
