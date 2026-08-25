import { useState } from "react";
import { TOOLS } from "./tools";

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lsw-help">
      <button type="button" className="lsw-help-btn" onClick={() => setOpen((v) => !v)}>
        How to play
      </button>
      {open && (
        <div className="lsw-help-pop">
          <p>1. Open this page in ChatGPT’s in-app browser (or Chrome 149+ with WebMCP enabled).</p>
          <p>2. Ask it to start a world — “Let’s make a fantasy story in a small kingdom…”</p>
          <p>3. Drag cards, edit text, attach image URLs, draw if you want.</p>
          <p className="lsw-help-label">Agent tools</p>
          <ul>
            {TOOLS.map((t) => (
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
