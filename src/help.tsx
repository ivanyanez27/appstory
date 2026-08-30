import { useState } from "react";
import { APP_STORY_TOOLS } from "./AppStoryTools";

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lsw-help">
      <button type="button" className="lsw-help-btn" onClick={() => setOpen((v) => !v)}>
        How it works
      </button>
      {open && (
        <div className="lsw-help-pop">
          <p>1. Connect a public GitHub repository or choose a local folder.</p>
          <p>2. Review the file scope, then allow source access.</p>
          <p>3. Ask your WebMCP agent to map the main UI flows.</p>
          <p>4. Review and accept the analysis proposal.</p>
          <p>5. Open a screen to see its evidence, technical flow, and possible gaps.</p>
          <p className="lsw-help-label">WebMCP tools</p>
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
