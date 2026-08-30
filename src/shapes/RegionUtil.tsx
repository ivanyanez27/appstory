import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type RecordProps,
  type TLShape,
} from "tldraw";
import type { StoryCardProps } from "./types";
import { StoryShapeSvg } from "./shapeSvg";

type RegionShape = TLShape<"lsw-region">;

export class RegionShapeUtil extends BaseBoxShapeUtil<RegionShape> {
  static override type = "lsw-region" as const;
  static override props: RecordProps<RegionShape> = {
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
  override canResize() {
    return true;
  }

  getDefaultProps(): StoryCardProps {
    return { w: 480, h: 320, name: "", summary: "", imageUrl: "" };
  }

  getIndicatorPath(shape: RegionShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  component(shape: RegionShape) {
    const editing = this.editor.getEditingShapeId() === shape.id;
    const at = shape.meta.pulseAt;
    const pulsing = typeof at === "number" && Date.now() - at < 700;
    return (
      <HTMLContainer style={{ width: "100%", height: "100%" }}>
        <div className={`lsw-region${pulsing ? " pulse" : ""}`}>
          {editing ? (
            <input
              className="lsw-card-input"
              value={shape.props.name}
              onChange={(e) =>
                this.editor.updateShape({
                  id: shape.id,
                  type: "lsw-region",
                  props: { name: e.target.value },
                })
              }
            />
          ) : (
            <div className="lsw-region-title">{shape.props.name}</div>
          )}
        </div>
      </HTMLContainer>
    );
  }

  override toSvg(shape: RegionShape) {
    return <StoryShapeSvg kind="region" props={shape.props} />;
  }
}
