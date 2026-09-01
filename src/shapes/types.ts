export const STORY_SHAPE_TYPES = [
  "lsw-character",
  "lsw-place",
  "lsw-plot",
  "lsw-note",
  "lsw-region",
] as const;

export type StoryShapeType = (typeof STORY_SHAPE_TYPES)[number];

export type StoryCardProps = {
  w: number;
  h: number;
  name: string;
  summary: string;
  imageUrl: string;
};

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    "lsw-character": StoryCardProps;
    "lsw-place": StoryCardProps;
    "lsw-plot": StoryCardProps;
    "lsw-note": StoryCardProps;
    "lsw-region": StoryCardProps;
  }
}

export function isStoryShapeType(type: string): type is StoryShapeType {
  return (STORY_SHAPE_TYPES as readonly string[]).includes(type);
}
