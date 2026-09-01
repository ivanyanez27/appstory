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

export { isStoryShapeType } from "./types";
export type { StoryShapeType } from "./types";
