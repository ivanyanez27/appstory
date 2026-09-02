**Live:** [appstory.ivanideas.com](https://appstory.ivanideas.com) · **Code:** [github.com/ivanyanez27/appstory](https://github.com/ivanyanez27/appstory)

## Inspiration

Every team I have worked on hits the same wall. A product manager asks a simple question — *"What are the main things a user can do in this app, and where could it break?"* — and the only honest answer is *"read the code."* Route files, view components, validation, service calls, and tests each hold one piece of the story. No single document holds all of it, and the diagrams that try are stale within a sprint.

Existing tools do not close this gap. Call graphs and code maps show every function; they bury the product journey in detail. Hand-drawn flow charts read well but carry no proof, so nobody trusts them after the code moves on.

The WebMCP Challenge gave me a reason to try a different shape: let an AI agent read the repository through a small, safe set of browser tools, propose a visual flow, and make a person approve that proposal before it becomes the shared picture. The agent does the reading. The human keeps the authority.

## What it does

**AppStory turns a public GitHub repository into an evidence-backed visual story of an application.**

1. You connect a public GitHub repository or a local folder.
2. AppStory builds a file index and shows what is approved and what is excluded.
3. You grant a separate consent before any source text can leave the page.
4. A WebMCP agent searches the index, reads bounded source ranges, and submits an analysis proposal.
5. You review the proposal — every node, every confidence score, every cited line — and accept or discard it.
6. The accepted flow appears on a shared canvas and in a keyboard-accessible outline. You expand a screen to see its technical steps, open the evidence, and review possible gaps.

Every node and connection carries indexed evidence, evidence factors, an AI confidence estimate, and a link to the exact analyzed commit. The app has no backend and never executes repository code.

## How I built it

**Stack.** Vite, React 19, and TypeScript for the single-page app. [tldraw](https://tldraw.dev) for the canvas. [`use-webmcp-tool`](https://www.npmjs.com/package/use-webmcp-tool) to register tools on `document.modelContext`. `oxlint` and `vitest` for the quality gate. Cloudflare Workers for hosting, with a small worker that stamps security headers on every response.

**The canvas is a pure projection.** This was the key architecture decision. The canvas holds nothing a reader can change. The source of truth is a plain data structure — the accepted analysis — and a single function, `proposalToWorld`, projects it into tldraw shapes. On every load the app throws away the old canvas and rebuilds it from the domain data:

```ts
// App.tsx — onReady
if (saved.acceptedAnalysis.nodes.length > 0) {
  applyWorld(
    ed,
    proposalToWorld(saved.acceptedAnalysis, saved.projectName, undefined, new Set()),
  );
  window.setTimeout(() => ed.zoomToFit(), 0);
}
```

Persisting a tldraw snapshot instead would let a stale layout survive a code change. Rebuilding from data every time removed a whole class of bug.

**Six WebMCP tools, split by trust.**

| Tool | Purpose |
|---|---|
| `get_project_state` | Read repository, consent, and analysis state |
| `search_repository_index` | Search approved paths, no source text |
| `read_repository_source` | Read one approved range, create a Read Record |
| `get_analysis_state` | Read a compact index of graph items |
| `submit_analysis_batch` | Add one validated transactional batch to the draft |
| `finalize_analysis_proposal` | Mark the draft ready for human review |

Read tools use `readOnlyHint`. Every tool that returns repository or graph text uses `untrustedContentHint`, because the text was written by a repository author or by the agent, not by me.

**Confidence as a formula, not a vibe.** Each fact carries evidence references and evidence factors. AppStory reduces them to one raw score:

$$
\text{score} = \operatorname{clip}_{[0,100]}\!\left( \sum_{j \in \text{evidence}} e(\text{src}_j) \;+\; \sum_{i \in \text{factors}} w(k_i)\,m(s_i) \right)
$$

where $e(\cdot)$ weights an evidence reference by its source (source code $30$, test $10$, docs $5$), $w(k_i)$ weights the factor kind, and $m(s_i)$ scales by factor strength. Two rules then override the number:

$$
\text{score} \leftarrow 79 \quad \text{if } \text{score} \ge 80 \ \wedge \ \big(\lnot\,\text{direct source evidence} \ \vee \ \text{strong conflict}\big)
$$

$$
\text{label} =
\begin{cases}
\textbf{Confirmed} & \text{score} \ge 80\\
\textbf{Inferred} & 40 \le \text{score} < 80\\
\textbf{Unknown} & \text{score} < 40 \ \text{or the fact is not traceable}
\end{cases}
$$

A non-traceable fact is forced to $\text{score} = 0$. Strong conflicting evidence, or a *Confirmed*-range score with no direct source line behind it, is capped at $79$ so it can never read as *Confirmed*. Confidence describes **evidence quality**, never business impact — the app keeps those two ideas on separate controls.

**Defense in depth for secrets.** In local-folder mode a weak filter leaks a developer's real credentials, so the exclusion runs in layers:

- Secret and dependency patterns are checked on *every path segment*, not just the filename. Segments are NFC-normalized and stripped of zero-width characters first.
- A content scan backs up the name filter. A file whose text matches a private-key block, a known token prefix, or a quoted credential assignment is blocked even when the name looked safe.
- Imported Project Files are re-validated for path traversal. The Markdown export degrades a bad evidence link to plain text instead of throwing.
- Every response carries `Origin-Agent-Cluster`, `Permissions-Policy: tools=(self)`, `X-Content-Type-Options`, `Referrer-Policy`, and `X-Frame-Options`, across all four host configs.

## Challenges I ran into

**Treating the agent's output as hostile.** The natural instinct is to trust a tool result. Here I could not. A repository path, a source excerpt, and the agent's own proposed titles are all free text from outside my trust boundary. Every batch is validated as one transaction: an invalid evidence reference, node kind, endpoint, identity, URL, or duplicate rejects the *whole* batch and changes nothing. Getting that all-or-nothing behavior right, with clear messages, took more test cases than the feature code.

**Keeping the proposal separate from the accepted graph.** `submit_analysis_batch` and `finalize_analysis_proposal` never touch what is on the canvas. Finalization only marks a draft *ready*. Only a human click accepts it. Modeling two parallel analysis states — draft and accepted — and diffing them for the review screen (*added, changed, possibly removed*) was the hardest state-management work in the project.

**The progressive graph.** A fully expanded graph hides the product journey in technical noise. Separate per-flow graphs hide the screens that flows share. The answer was one graph that starts as a flow overview and expands a screen into its technical steps *in place*, on request. Layout had to stay stable as nodes appeared and disappeared.

**WebMCP is still arriving.** No shipping browser exposes `document.modelContext` without a flag or an origin-trial token. I built a spec-compliant stub of the platform to drive the app's real tool-registration and tool-execution code in tests, and made the status chip poll — a browser extension can inject the API after the page mounts, and a one-shot check would leave the chip wrongly stuck on *unavailable*.

**Accessibility parity.** The canvas cannot be the only way in. The keyboard outline renders from the *same* accepted analysis data and exposes everything the canvas does: evidence factors, AI reasons, connections, commit-pinned evidence links, read records, and the gap-review controls.

## What I learned

- **Make the visual layer disposable.** When the canvas is a pure projection of plain data, a redesign is a new projection function, and reload bugs disappear.
- **Trust boundaries belong in the type system.** Naming a value *untrusted* — in a hint, a type, a validator — changes how you write every function that touches it.
- **A human-in-the-loop step is a feature, not a delay.** The review screen is where a mixed team actually builds a shared understanding. Removing it would remove the point of the product.
- **Confidence needs a definition.** Once the score was a written formula with a conflict penalty, disagreements moved from *"does this feel right"* to *"is this factor weighted correctly"* — a much better argument to have.

## What's next

- Register the origin trial so every visitor gets native WebMCP with no flag.
- Measure tldraw's inline styles so a real Content-Security-Policy can ship.
- More node kinds for background jobs and scheduled work.
- A compare view across two commits of the same repository.

---

### Built with

`vite` · `react` · `typescript` · `tldraw` · `webmcp` · `use-webmcp-tool` · `document.modelContext` · `cloudflare-workers` · `wrangler` · `vitest` · `oxlint` · `github-api` · `file-system-access-api` · `html5-canvas` · `svg` · `localstorage` · `netlify` · `vercel` · `json` · `markdown`
