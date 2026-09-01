import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { storyShapeUtils } from "./shapes";

type Props = {
  onReady: (editor: Editor) => void;
};

const licenseKey = import.meta.env.VITE_TLDRAW_LICENSE_KEY;

export function Canvas({ onReady }: Props) {
  return (
    <div className="lsw-canvas">
      <Tldraw
        shapeUtils={storyShapeUtils}
        {...(licenseKey ? { licenseKey } : {})}
        onMount={(editor) => {
          onReady(editor);
        }}
      />
    </div>
  );
}
