import { Tldraw, type Editor } from "tldraw";
import "tldraw/tldraw.css";
import { storyShapeUtils } from "./shapes";

type Props = {
  onReady: (editor: Editor) => void;
};

export function Canvas({ onReady }: Props) {
  return (
    <div className="lsw-canvas">
      <Tldraw
        shapeUtils={storyShapeUtils}
        onMount={(editor) => {
          onReady(editor);
        }}
      />
    </div>
  );
}
