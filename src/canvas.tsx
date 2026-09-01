import { Tldraw, type Editor, type TLComponents } from "tldraw";
import "tldraw/tldraw.css";
import { storyShapeUtils } from "./shapes";

type Props = {
  onReady: (editor: Editor) => (() => void) | void;
};

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;

// Every card on this canvas is an accepted, evidence-backed fact. Drawing tools
// would let a reader add marks that no export could tell apart from analysis,
// so the canvas keeps only the controls that move the camera: zoom, fit, and
// the navigation panel. `applyWorld` lifts the lock for its own writes.
const components: TLComponents = {
  Toolbar: null,
  StylePanel: null,
  ActionsMenu: null,
  QuickActions: null,
  PageMenu: null,
  MainMenu: null,
  HelpMenu: null,
  DebugPanel: null,
  DebugMenu: null,
  KeyboardShortcutsDialog: null,
  ContextMenu: null,
};

export function Canvas({ onReady }: Props) {
  return (
    <div className="lsw-canvas">
      <Tldraw
        shapeUtils={storyShapeUtils}
        components={components}
        {...(licenseKey ? { licenseKey } : {})}
        onMount={(editor) => {
          // The brand is dark-only, so pin tldraw's own chrome to dark too.
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          editor.updateInstanceState({ isReadonly: true });
          return onReady(editor);
        }}
      />
    </div>
  );
}
