# AppStory implementation and release plan

**Status:** Product implementation complete; release verification remains

**Updated:** 30 August 2026

**Deadline:** 3 September 2026

## Working rule

Keep the product static, local-first, and evidence-backed. Do not add deferred services or framework discovery before the release gate passes.

## Completed implementation

### 1. Analysis model

- Added AppStory node and connection kinds.
- Added Evidence, Evidence Factors, AI reasons, and calculated confidence.
- Kept graph facts separate from canvas presentation state.
- Added transactional proposal validation and canonical identities.

### 2. Repository connection

- Added public GitHub URL parsing, commit resolution, and indexing.
- Added local folder indexing with a stable file fingerprint.
- Added default exclusions and a 1 MB file limit.
- Added repository scope, exclusion, access-error, and reconnection states.

### 3. Consent and safe reads

- Added separate Repository Consent.
- Limited reads to approved indexed files and 500 lines.
- Added visible Read Records.
- Kept complete source text out of persistence and Project Files.

### 4. WebMCP interface

- Added the six AppStory tools.
- Added read-only and untrusted-content annotations.
- Kept one proposal-writing Analysis Session.
- Kept accepted analysis unchanged during proposal work.

### 5. Proposal review

- Added transactional batch validation.
- Added draft, finalize, accept, and discard states.
- Added validation for Evidence, identities, kinds, endpoints, URLs, and confidence.

### 6. Flow rendering

- Reused tldraw and the existing custom-shape surface.
- Added UI Flow grouping and in-place expansion.
- Added Screen Technical Flow expansion.
- Added confidence, Evidence, and gap information.

### 7. Accessible review

- Added a keyboard-accessible outline from the accepted analysis data.
- Added Evidence Factors, AI reasons, connections, and commit-pinned links.
- Added gap status, Impact, reason, and unverified reviewer fields.

### 8. Persistence and sharing

- Added AppStory browser persistence under `appstory.v1`.
- Added confirmed project deletion.
- Added versioned Project File import and export.
- Added Markdown, SVG, and PNG export.
- Kept local folder handles, local source access, source text, and Read Records out of Project Files.

### 9. Automated checks

- Added focused tests for repository rules, safe reads, proposals, persistence, tools, flows, gap review, Project Files, reports, exports, and revision comparison.
- Confirmed the unit tests, lint, and production build pass on 30 August 2026.

## Remaining release checks

### 1. Browser workflow

1. Start from a clean browser profile.
2. Connect the public AppStory repository.
3. Review exclusions and grant Repository Consent.
4. Run the WebMCP self-analysis flow.
5. Confirm that Read Records appear.
6. Finalize, review, and accept the proposal.
7. Compare the canvas and outline.
8. Expand one UI Flow and one Screen Technical Flow.
9. Review one Possible Gap.
10. Refresh and confirm persistence.

### 2. Local folder workflow

1. Select a local source folder.
2. Confirm that the index hides paths before consent.
3. Grant consent and read an approved file.
4. Refresh the page.
5. Confirm that source access and Read Records do not persist.
6. Reconnect the folder and confirm that reads work again.

### 3. Import and export

1. Export a Project File and import it in a clean state.
2. Confirm that accepted analysis and gap reviews return.
3. Confirm that source text, permissions, Read Records, and drafts are absent.
4. Reject malformed and oversized Project Files.
5. Export Markdown, SVG, and PNG and inspect each result.

### 4. Accessibility

1. Complete repository connection and proposal review with the keyboard.
2. Expand every outline section without the canvas.
3. Inspect nodes, connections, Evidence, confidence, and gaps.
4. Confirm visible focus, useful names, logical order, and non-color status cues.

### 5. Security regression

Test these cases:

- Malformed and unsupported GitHub URLs
- Missing repositories and GitHub access limits
- Dependencies, generated output, binaries, environment files, and likely secrets
- Oversized files and unsafe paths
- Prompt-injection text in source files
- Unsafe Evidence links
- Aborted and out-of-range reads
- Invalid proposal batches and duplicate identities
- Attempted graph change before proposal acceptance

### 6. Deployment and demonstration

1. Deploy the production build over HTTPS.
2. Verify `Origin-Agent-Cluster: ?1`.
3. Verify `Permissions-Policy: tools=(self)`.
4. Verify all six WebMCP tools in ChatGPT's in-app browser or supported Chrome.
5. Run the self-analysis demonstration in less than three minutes.

## Release gate

Release AppStory only when:

- Automated tests, lint, and the production build pass.
- Browser, keyboard, security, import, export, persistence, and deletion checks pass.
- The deployed response has the required WebMCP headers.
- The clean-profile demonstration takes less than three minutes.

## Work after release

Add these items only after the release gate passes:

1. Private GitHub repository authentication
2. Screen Capture collection and redaction
3. First-class SwiftUI and Jetpack Compose discovery
4. UIKit, Android Views, and Flutter discovery
5. Backend accounts and live collaboration
6. Concurrent proposal-writing agents
