# App Story

App Story turns a public GitHub repository into an evidence-backed visual story of an application. A mixed product team can review the main UI flow, open technical details, and find possible missing paths on one shared canvas.

Built for the [WebMCP Challenge](https://openai.com/webmcp-challenge/).

## What App Story does

The core workflow is:

1. Connect a public GitHub repository or choose a local repository folder.
2. Review the indexed file scope and exclusions.
3. Give separate consent before an agent can read source text.
4. Ask a WebMCP agent to create an analysis proposal.
5. Review and accept an evidence-backed UI flow.
6. Expand a screen to see material technical steps.
7. Review confidence factors, source evidence, and possible gaps.

The accepted proposal changes the graph only after human review. Repository text is untrusted input. App Story does not execute repository code or render source text as active HTML.

App Story supports public GitHub repositories and local folders. Project Files can export and import accepted analysis. Markdown, SVG, and PNG exports can share the accepted review without repository source content or permissions.

App Story does not include private repository authentication, accounts, a backend, live collaboration, repository execution, or screen capture.

## Main features

- Public GitHub connection pinned to one commit
- Local folder indexing with a stable file fingerprint
- File exclusions for dependencies, build output, binaries, environment files, and likely secrets
- Separate consent before WebMCP can return source text
- Bounded source reads with visible Read Records
- Transactional Analysis Proposals that need human acceptance
- Expandable UI Flows and Technical Flows on a tldraw canvas
- Keyboard-accessible outline with Evidence, confidence, and gap review
- Project File import and export
- Markdown, SVG, and PNG export
- Local browser persistence and confirmed project deletion

## WebMCP tools

The page registers six tools on `document.modelContext`:

- `get_project_state`
- `search_repository_index`
- `read_repository_source`
- `get_analysis_state`
- `submit_analysis_batch`
- `finalize_analysis_proposal`

Read operations report their file access. Proposal output must cite valid indexed source locations before it can enter review. Repository and analysis text is untrusted data, not agent instructions.

Use ChatGPT's in-app browser, or a Chrome version that supports WebMCP testing.

### Chrome for local development

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Enable the flag and relaunch Chrome.
3. Run `npm run dev`.
4. Open the local URL. Localhost is a trustworthy origin.

The [Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd) is optional.

## Security model

- Repository selection does not grant source access.
- The app reads only approved, indexed text files.
- Each source request is limited to 500 lines.
- The app does not execute repository code.
- Source text is rendered as inert text.
- Analysis batches are transactional and cannot change the accepted graph directly.
- GitHub Evidence links point to the analyzed commit.

## Technology

App Story uses Vite, React, TypeScript, [tldraw](https://tldraw.dev), and `use-webmcp-tool`. It has no backend. Project state stays in the browser.

The app sends these headers for WebMCP:

- `Origin-Agent-Cluster: ?1`
- `Permissions-Policy: tools=(self)`

## Local development

```bash
npm install
npm test
npm run lint
npm run dev
npm run build
```

Deploy the `dist/` folder to a static HTTPS host such as Netlify, Cloudflare Pages, or Vercel.

## Product documents

- [Essential milestone specification](docs/specs/2026-08-27-app-story-essential-milestone.md)
- [Implementation plan](docs/plans/2026-08-27-app-story-essential-milestone.md)
- [Product requirements](PRD.md)
- [Glossary and accepted domain decisions](CONTEXT.md)
- [Architecture decisions](docs/adr/0001-progressive-flow-graph.md)

## License

MIT
