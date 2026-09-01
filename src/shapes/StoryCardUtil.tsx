import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLShape,
} from "tldraw";
import { CardFace } from "./cardFace";
import { StoryShapeSvg } from "./shapeSvg";
import type { StoryCardProps, StoryShapeType } from "./types";

const props: RecordProps<TLShape<StoryShapeType>> = {
  w: T.number,
  h: T.number,
  name: T.string,
  summary: T.string,
  imageUrl: T.string,
};

function isPulsing(shape: TLShape): boolean {
  const at = shape.meta.pulseAt;
  return typeof at === "number" && Date.now() - at < 700;
}

function createUtil(
  type: "lsw-character" | "lsw-place" | "lsw-plot",
  kind: "character" | "place" | "plot",
) {
  return class StoryCardUtil extends BaseBoxShapeUtil<TLShape<typeof type>> {
    static override type = type;
    static override props = props;

    override canEdit() {
      return true;
    }
    override canBind(_opts: { bindingType: string }) {
      return true;
    }

    getDefaultProps(): StoryCardProps {
      return { w: 320, h: 200, name: "", summary: "", imageUrl: "" };
    }

    getIndicatorPath(shape: TLShape<typeof type>) {
      const path = new Path2D();
      path.rect(0, 0, shape.props.w, shape.props.h);
      return path;
    }

    component(shape: TLShape<typeof type>) {
      const editing = this.editor.getEditingShapeId() === shape.id;
      return (
        <HTMLContainer style={{ width: "100%", height: "100%" }}>
          <CardFace
            kind={kind}
            name={shape.props.name}
            summary={shape.props.summary}
            imageUrl={shape.props.imageUrl}
            editing={editing}
            pulsing={isPulsing(shape)}
            onName={(name) =>
              this.editor.updateShape({
                id: shape.id,
                type,
                props: { name },
              })
            }
            onSummary={(summary) =>
              this.editor.updateShape({
                id: shape.id,
                type,
                props: { summary },
              })
            }
          />
        </HTMLContainer>
      );
    }

    override toSvg(shape: TLShape<typeof type>) {
      return <StoryShapeSvg kind={kind} props={shape.props} />;
    }
  };
}

export const CharacterShapeUtil = createUtil("lsw-character", "character");
export const PlaceShapeUtil = createUtil("lsw-place", "place");
export const PlotShapeUtil = createUtil("lsw-plot", "plot");
