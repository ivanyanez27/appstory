# App Story domain language

This glossary defines the terms that App Story uses for evidence-backed visual analysis of how people and systems move through a software product.

## Language

**Flow**:
A goal-oriented product journey with a start, one or more paths, and an outcome.
_Avoid_: Function chain, call graph

**UI Flow**:
The user-visible level of a Flow, made from Screens, actions, decisions, states, and outcomes.
_Avoid_: User flow, page flow

**Technical Flow**:
An optional expansion of a UI Flow that shows technical steps which affect user-visible results, system state, security, or recovery.
_Avoid_: Full call graph, implementation trace

**Flow Overview**:
The top-level graph in which each Flow starts as a collapsed region and can expand in place.
_Avoid_: Master graph, complete graph

**Screen**:
A user-visible state with its own decisions or actions, such as a route, modal, tab, or form stage.
_Avoid_: Page, view

**Canonical Screen**:
The single graph identity for a Screen that can be referenced by several Flows without duplication.
_Avoid_: Shared node, master Screen

**Screen Capture**:
A real image of a Screen from repository assets, a deployed application, or a user-run local application.
_Avoid_: Generated screenshot, inferred screenshot

**Screen Transition**:
A user-visible connection between Screens, classified as navigation, presentation, deep link, notification, widget, or system handoff.
_Avoid_: Link, route change

**Application Area**:
One runnable application within a repository, such as a web application, mobile application, or backend.
_Avoid_: Project, package

**Repository Revision**:
The fixed repository state used for an analysis, identified by a commit or local file fingerprints.
_Avoid_: Version, latest code

**Analysis Revision**:
An evidence-backed Flow Overview produced from one Repository Revision and retained until a person accepts its replacement.
_Avoid_: Scan, latest analysis

**Analysis Proposal**:
A validated batch of proposed graph changes that remains separate from the current Analysis Revision until a person accepts it.
_Avoid_: Draft graph, agent changes

**Draft Analysis Proposal**:
An incomplete Analysis Proposal that contains validated work from a cancelled or partially failed analysis and can be resumed or discarded.
_Avoid_: Partial graph, failed analysis

**Repository Consent**:
A separate user decision that permits approved repository content to be returned through WebMCP after repository selection.
_Avoid_: Folder permission, repository access

**Analysis Session**:
One agent's bounded period of repository reading and proposal creation for a project; only one can be active at a time.
_Avoid_: Agent run, scan

**Read Record**:
A visible record of a repository file read during an Analysis Session, including its path, reason, size, and time.
_Avoid_: Access log, audit log

**Evidence**:
A source location that supports a discovered Screen, path, state, or outcome.
_Avoid_: Proof

**Evidence Factor**:
A classified signal that increases or reduces confidence in a Discovered Fact, such as source code, a test, documentation, a Screen Capture, or conflicting Evidence.
_Avoid_: Weight, confidence point

**AI Confidence Estimate**:
A percentage calculated by a stable rule from AI-classified Evidence Factors; it describes evidence strength and agreement, not statistical probability.
_Avoid_: Probability, accuracy score

**Discovered Fact**:
A graph fact derived from repository Evidence and owned by an Analysis Revision.
_Avoid_: Generated content

**Possibly Removed**:
The review state of a Discovered Fact whose Evidence is absent from a newer Repository Revision but whose removal is not yet accepted.
_Avoid_: Deleted, obsolete

**Human Annotation**:
A person-owned correction or note that remains separate from Discovered Facts during refresh.
_Avoid_: Override, manual fact

**Intended Path**:
A person-owned description of expected product behavior that has no required repository Evidence.
_Avoid_: Assumed path, generated requirement

**Project Export**:
A portable analysis file that contains the graph, Evidence references, annotations, confidence factors, and repository identity, but no repository source text and no repository permissions. Its free-text fields hold only agent-authored analysis text that a person reviewed before acceptance.
_Avoid_: Backup, repository export

**Review Record**:
An append-only record of a Gap status change, with its time, old and new status, optional reason, and an unverified reviewer name.
_Avoid_: Audit log, edit history

**Unknown Path**:
A visible break in a Flow that the analysis cannot trace, with a recorded reason.
_Avoid_: Missing link, guessed path

**Possible Gap**:
An expected path or state that has insufficient Evidence and needs human review.
_Avoid_: Bug, confirmed defect

**Confirmed Gap**:
A Possible Gap that a person has verified as missing and required.
_Avoid_: Possible issue

**Accepted Risk**:
A Confirmed Gap that the product team has chosen not to address.
_Avoid_: Dismissed issue

**Not Applicable**:
A Possible Gap that the product team has confirmed does not apply to its Flow.
_Avoid_: False positive

**Impact**:
A person-confirmed estimate of the harm caused by a Gap, classified as low, medium, high, or critical and kept separate from confidence.
_Avoid_: Confidence, severity score

**Reviewed Flow**:
A Flow with an identified start and outcomes, Evidence for known paths, and an explicit review decision for each Possible Gap and Unknown Path.
_Avoid_: Complete Flow, finished Flow
