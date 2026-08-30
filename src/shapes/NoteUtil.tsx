import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLShape,
} from "tldraw";
import { CardFace } from "./cardFace";
import { StoryShapeSvg } from "./shapeSvg";
import type { StoryCardProps } from "./types";

type NoteShape = TLShape<"lsw-note">;

export class NoteShapeUtil extends BaseBoxShapeUtil<NoteShape> {
  static override type = "lsw-note" as const;
  static override props: RecordProps<NoteShape> = {
    w: T.number,
    h: T.number,
    name: T.string,
    summary: T.string,
    imageUrl: T.string,
  };

  override canEdit() {
    return true;
  }
  override canBind(_opts: { bindingType: string }) {
    return true;
  }

  getDefaultProps(): StoryCardProps {
    return { w: 180, h: 100, name: "", summary: "", imageUrl: "" };
  }

  getIndicatorPath(shape: NoteShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  component(shape: NoteShape) {
    const editing = this.editor.getEditingShapeId() === shape.id;
    const at = shape.meta.pulseAt;
    const pulsing = typeof at === "number" && Date.now() - at < 700;
    return (
      <HTMLContainer style={{ width: "100%", height: "100%" }}>
        <CardFace
          kind="note"
          name={shape.props.name}
          summary=""
          imageUrl=""
          editing={editing}
          pulsing={pulsing}
          onName={(name) =>
            this.editor.updateShape({
              id: shape.id,
              type: "lsw-note",
              props: { name },
            })
          }
          onSummary={() => undefined}
        />
      </HTMLContainer>
    );
  }


  override toSvg(shape: NoteShape) {
    return <StoryShapeSvg kind="note" props={shape.props} />;
  }
}
