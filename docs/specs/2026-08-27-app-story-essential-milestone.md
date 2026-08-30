# App Story product specification

**Status:** Implemented locally; release verification remains

**Updated:** 30 August 2026

**Target:** WebMCP Challenge submission by 3 September 2026

## Outcome

App Story turns a public GitHub repository or local folder into an evidence-backed visual story of an application. A mixed product team can review UI Flows, expand a Screen into material technical steps, and assess Possible Gaps without reading the full repository.

The primary demonstration uses App Story's own public repository. The complete journey must take less than three minutes.

## Product scope

1. Connect a public GitHub repository and pin the analysis to one commit.
2. Connect a local folder and identify its approved files with a stable fingerprint.
3. Build a repository index without storing complete source files.
4. Exclude dependencies, generated output, binaries, environment files, likely secrets, unsafe paths, and oversized files.
5. Obtain separate Repository Consent before WebMCP can return source text.
6. Show a Read Record for each successful source request.
7. Let one WebMCP Analysis Session inspect approved files and submit validated proposal batches.
8. Preview and explicitly accept or discard a finalized Analysis Proposal.
9. Render expandable UI Flows and Technical Flows with source Evidence.
10. Show Evidence Factors, an AI Confidence Estimate, and Possible Gaps.
11. Provide a keyboard-accessible outline with the same review data as the canvas.
12. Review gaps with a human status, Impact, reason, and optional unverified reviewer name.
13. Export and import accepted analysis in a versioned Project File.
14. Export accepted analysis as Markdown, SVG, and PNG.
15. Delete App Story project data through a confirmed user action.

## Deferred scope

- Private GitHub repositories and GitHub authentication
- Backend services, accounts, and live collaboration
- Repository execution
- Screen Capture collection and redaction
- Automated discovery for native application frameworks
- Concurrent proposal-writing agents

Do not scaffold deferred work before release checks pass.

## Product model

### Graph nodes

- **Actor**
- **Screen**
- **Decision**
- **System**
- **Data Store**
- **External System**
- **Outcome**
- **Possible Gap**
- **Unknown Path**

Actions and visual states remain fields inside a Screen. Shared Screens have one canonical identity.

### Graph connections

- **User Action**
- **Screen Transition**
- **Data Transfer**
- **System Event**
- **Validation Result**
- **Dependency**

Each connection has a short label, stable identity, Evidence, Evidence Factors, and confidence data.

### Visual hierarchy

- The default canvas shows a Flow Overview.
- Each UI Flow can expand or collapse in place.
- A Screen can reveal its material Technical Flow.
- Application Areas remain visible regions.
- Position and expansion are presentation data. They do not change discovered facts.

## Evidence and confidence

Every discovered node and connection must cite an indexed repository file and valid line range. A proposal batch with missing files, invalid ranges, unsupported kinds, unsafe URLs, invalid endpoints, or duplicate identities fails as one transaction.

Confidence has two outputs:

- **Label:** Confirmed, Inferred, or Unknown
- **AI Confidence Estimate:** a percentage calculated from classified Evidence Factors

Thresholds are:

- **Confirmed:** 80–100%, traceable, with direct source Evidence
- **Inferred:** 40–79% and traceable
- **Unknown:** 0–39% or not traceable

Strong conflicting Evidence prevents a Confirmed label. Confidence measures Evidence quality. A person sets Impact separately.

## Repository trust model

- Repository selection does not grant Repository Consent.
- Public GitHub analysis is pinned to a full commit SHA.
- Local folder analysis uses a stable fingerprint and must reconnect before later source reads.
- Repository paths and text are untrusted data, not instructions.
- The app reads only indexed, approved text files.
- Each read needs a reason and can return no more than 500 lines.
- The app never executes repository code or renders repository markup as active HTML.
- Complete source files do not enter browser persistence or Project Files.
- GitHub Evidence links use the analyzed commit and validated line range.

## WebMCP interface

The page registers six tools:

1. `get_project_state`
2. `search_repository_index`
3. `read_repository_source`
4. `get_analysis_state`
5. `submit_analysis_batch`
6. `finalize_analysis_proposal`

Read tools use `readOnlyHint`. Tools that return repository or graph text use `untrustedContentHint`. Proposal submission never changes the accepted graph.

## Primary user journey

1. A person connects a public GitHub repository or local folder.
2. App Story shows the fixed Repository Revision and indexed scope.
3. The person grants Repository Consent.
4. A WebMCP agent searches approved paths and reads bounded source ranges.
5. Read Records appear while the agent submits proposal batches.
6. The agent finalizes the Analysis Proposal.
7. The person reviews Evidence, confidence, nodes, and connections.
8. The person accepts or discards the proposal.
9. The accepted UI Flow Overview appears on the canvas and in the outline.
10. The person expands a Flow or Screen, opens Evidence, and reviews gaps.

## Required states

- No repository
- Repository resolving
- Repository ready, consent required
- Repository ready, consent granted
- Agent analyzing
- Analysis stopped with resumable draft
- Proposal ready for review
- Analysis current
- Repository access error
- Proposal validation error
- Local folder reconnection required
- Project empty after confirmed deletion

## Persistence and sharing

- Save current browser state under `app-story.v1`.
- Do not persist local folder handles, local source access, or local Read Records.
- Project Files contain repository identity, accepted analysis, gap reviews, and expanded UI Flow state.
- Project Files do not contain source text, permissions, Read Records, or draft proposals.
- Reject Project Files larger than 5 MB or with invalid structure.
- Markdown, SVG, and PNG exports contain accepted analysis only.

## Acceptance checks

1. **GitHub connection:** A valid public repository creates a commit-pinned Repository Revision and visible file scope.
2. **Local connection:** A selected folder creates a fingerprinted revision and requires reconnection after reload.
3. **Consent:** WebMCP cannot return source content before Repository Consent.
4. **Safe reads:** An approved read is bounded, marked untrusted, rendered inertly, and recorded.
5. **Exclusions:** Secret-like, binary, generated, dependency, oversized, and unsafe files cannot be read.
6. **Proposal isolation:** A draft or finalized proposal does not change the accepted graph.
7. **Proposal validation:** An invalid batch makes no partial change.
8. **Human review:** Only explicit acceptance creates the next Analysis Revision.
9. **Graph parity:** The canvas and outline show the same accepted items and review data.
10. **Technical expansion:** A Screen can reveal its material Technical Flow.
11. **Evidence navigation:** A GitHub link points to the analyzed commit and valid lines.
12. **Accessibility:** A keyboard-only user can inspect all accepted graph information and review gaps.
13. **Sharing:** Project File and report exports omit source content and permissions.
14. **Deletion:** Confirmed deletion removes App Story project data.
15. **Demo:** A new user can complete the primary journey in less than three minutes.

## Release direction

Complete browser, security, deployment-header, and clean-profile demonstration checks. Add private-repository access, native framework discovery, or Screen Capture only after the release gate passes.
