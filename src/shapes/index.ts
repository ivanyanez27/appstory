import { CharacterShapeUtil, PlaceShapeUtil, PlotShapeUtil } from "./StoryCardUtil";
import { NoteShapeUtil } from "./NoteUtil";
import { RegionShapeUtil } from "./RegionUtil";

export const storyShapeUtils = [
  CharacterShapeUtil,
  PlaceShapeUtil,
  PlotShapeUtil,
  NoteShapeUtil,
  RegionShapeUtil,
];

export { isStoryShapeType, STORY_SHAPE_TYPES } from "./types";
export type { StoryShape, StoryShapeType } from "./types";
