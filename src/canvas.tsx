import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { storyShapeUtils } from "./shapes";

type Props = {
  onReady: (editor: Editor) => (() => void) | void;
};

export function Canvas({ onReady }: Props) {
  return (
    <div className="lsw-canvas">
      <Tldraw
        shapeUtils={storyShapeUtils}
        onMount={(editor) => {
          // The brand is dark-only, so pin tldraw's own chrome to dark too.
          editor.user.updateUserPreferences({ colorScheme: "dark" });
          return onReady(editor);
        }}
      />
    </div>
  );
}
