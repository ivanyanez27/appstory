import { Logo } from "./Logo";
import "./landing.css";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Connect a repository",
    body: "Point App Story at a public GitHub repository or choose a local folder. The scope is pinned to one commit.",
  },
  {
    title: "Review the file scope",
    body: "Check the indexed files and the exclusions for dependencies, build output, binaries, and likely secrets.",
  },
  {
    title: "Give source consent",
    body: "A separate, explicit decision lets a WebMCP agent read approved source text. Selection alone grants nothing.",
  },
  {
    title: "Ask an agent to analyze",
    body: "The agent proposes an evidence-backed UI flow. Every proposed fact must cite an indexed source location.",
  },
  {
    title: "Accept the analysis",
    body: "The graph changes only after you accept the proposal. You keep human annotations separate from discovered facts.",
  },
  {
    title: "Expand and review",
    body: "Open a screen to see material technical steps. Review confidence factors, evidence, and possible gaps.",
  },
];

const FEATURES: string[] = [
  "Public GitHub connection pinned to one commit",
  "Local folder indexing with a stable fingerprint",
  "Exclusions for dependencies, build output, binaries, and likely secrets",
  "Bounded source reads with visible Read Records",
  "Transactional proposals that need human acceptance",
  "Expandable UI Flows and Technical Flows on a tldraw canvas",
  "Keyboard-accessible outline with evidence and gap review",
  "Project File import and export",
  "Markdown, SVG, and PNG export",
  "Local browser persistence and confirmed project deletion",
];

const SECURITY: string[] = [
  "Repository selection does not grant source access.",
  "The app reads only approved, indexed text files. Each request is limited to 500 lines.",
  "The app does not execute repository code. Source text is rendered as inert text.",
  "Analysis batches cannot change the accepted graph directly.",
];

export function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-nav-links">
          <a
            href="https://github.com/ivanyanez27/storytime"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a
            className="landing-nav-cta"
            href="/app"
            onClick={(event) => {
              event.preventDefault();
              onLaunch();
            }}
          >
            Open the app
          </a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <p className="landing-eyebrow">Built for the WebMCP Challenge</p>
          <h1>Turn a GitHub repository into an evidence-backed app story.</h1>
          <p className="landing-lede">
            App Story reads a public repository and draws how people move through
            the product. A mixed product team can review the main UI flow, open
            technical detail, and find missing paths on one shared canvas.
          </p>
          <div className="landing-cta-row">
            <a
              className="landing-btn landing-btn-primary"
              href="/app"
              onClick={(event) => {
                event.preventDefault();
                onLaunch();
              }}
            >
              Open App Story
            </a>
            <a
              className="landing-btn"
              href="https://openai.com/webmcp-challenge/"
              target="_blank"
              rel="noreferrer"
            >
              About the challenge
            </a>
          </div>
          <p className="landing-fineprint">
            Runs in your browser. No account. No upload. No backend.
          </p>
        </section>

        <section className="landing-block">
          <h2>How it works</h2>
          <ol className="landing-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="landing-step-num">{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-block landing-block-tint">
          <h2>What you get</h2>
          <ul className="landing-features">
            {FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="landing-block">
          <h2>Your code stays yours</h2>
          <ul className="landing-security">
            {SECURITY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section className="landing-final">
          <h2>Ready to look at a repository?</h2>
          <a
            className="landing-btn landing-btn-primary"
            href="/app"
            onClick={(event) => {
              event.preventDefault();
              onLaunch();
            }}
          >
            Open App Story
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <span>MIT licensed</span>
        <a
          href="https://github.com/ivanyanez27/storytime"
          target="_blank"
          rel="noreferrer"
        >
          Source on GitHub
        </a>
      </footer>
    </div>
  );
}
