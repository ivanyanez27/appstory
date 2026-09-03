# Defense-in-depth hardening

**Status:** Accepted

AppStory extends [ADR 0002](0002-treat-repositories-as-untrusted-data.md) with
layered checks, because a single filter that is "mostly right" still leaks a
developer's credentials in local-folder mode.

- **Secret exclusion runs on every path segment, not just the filename.** A
  `secrets/` or `credentials/` directory is excluded the same way
  `secrets.json` is. Segments are NFC-normalized and stripped of zero-width
  characters first.
- **A content scan backs up the name filter.** `sliceRepositorySource` blocks a
  file whose text matches a private-key block, a known token prefix, or a quoted
  credential assignment, even when the filename looked safe.
- **Imported Project Files are re-validated.** Evidence paths are checked for
  traversal on import; the Markdown export degrades a bad evidence link to plain
  text instead of throwing.
- **Every response carries `X-Content-Type-Options`, `Referrer-Policy`, and
  `X-Frame-Options`** in addition to the WebMCP origin-isolation headers from
  the Cloudflare Worker.

A Content-Security-Policy was considered and deferred: tldraw injects inline
styles, so a useful policy needs measurement before it can be committed without
breaking the canvas.
