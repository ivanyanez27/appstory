import { useState } from "react";
import { APP_STORY_TOOLS } from "./AppStoryTools";

const EXAMPLE_PROMPT =
  "Map the main UI flows in this repository. Read the routes and screen " +
  "components, then submit an analysis batch with evidence for each screen " +
  "and transition. Finalize the proposal when you are done.";

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lsw-help">
      <button type="button" className="lsw-help-btn" onClick={() => setOpen((v) => !v)}>
        How it works
      </button>
      {open && (
        <div className="lsw-help-pop">
          <p className="lsw-help-label">Before you start</p>
          <p>
            App Story needs a browser where a WebMCP agent can run. The status
            chip in the header shows <strong>WebMCP ready</strong> when one is
            connected. If it shows <strong>unavailable</strong>, open this page
            in a WebMCP-enabled browser first.
          </p>

          <p className="lsw-help-label">Steps</p>
          <ol className="lsw-help-steps">
            <li>
              <strong>Connect a repository.</strong> Paste a public GitHub URL
              and select <em>Connect</em>, or select <em>Choose local folder</em>
              {" "}to pick a folder on this computer.
            </li>
            <li>
              <strong>Check the file scope.</strong> The bar shows how many files
              are approved and how many are excluded. Open <em>Review
              exclusions</em> to see what was left out.
            </li>
            <li>
              <strong>Allow source access.</strong> Select the checkbox{" "}
              <em>Allow WebMCP to return approved source text…</em>. The agent
              cannot read any file text until you do.
            </li>
            <li>
              <strong>Ask the agent to map the flows.</strong> In your agent,
              give a prompt like the one below. The agent reads source, then
              submits one or more analysis batches and finalizes a proposal.
            </li>
            <li>
              <strong>Review and accept.</strong> When the proposal is ready, a
              green bar appears. Check the items, then select <em>Accept
              proposal</em>. Only an accepted proposal changes the canvas.
            </li>
            <li>
              <strong>Open a screen for detail.</strong> Use the outline (top
              left) to expand a flow. Select a screen to see its evidence,
              confidence factors, and possible gaps. Select <em>Expand technical
              flow</em> for system steps.
            </li>
            <li>
              <strong>Check what was read.</strong> <em>Source reads</em> in the
              header lists every source range the agent read, with its path,
              line range, size, reason, and time.
            </li>
            <li>
              <strong>Export or save.</strong> <em>Export</em> writes a Project
              File you can re-import. <em>Report</em>, <em>SVG</em>, and{" "}
              <em>PNG</em> share the review without repository source.
            </li>
          </ol>

          <p className="lsw-help-label">About the canvas</p>
          <p>
            The canvas is read-only. It holds accepted, evidence-backed facts
            only, so there are no drawing tools to add marks an export could not
            tell apart from analysis. Pan and zoom freely, and select{" "}
            <em>Fit to view</em> to bring the whole graph back on screen.
          </p>

          <p className="lsw-help-label">Example agent prompt</p>
          <p className="lsw-help-example">{EXAMPLE_PROMPT}</p>

          <p className="lsw-help-label">WebMCP tools the agent can call</p>
          <ul>
            {APP_STORY_TOOLS.map((t) => (
              <li key={t.name}>
                <strong>{t.title}</strong> — {t.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
