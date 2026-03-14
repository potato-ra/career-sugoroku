import rawBoard from "../data/board_layout_40.json";
import careerCards from "../data/career_cards.json";
import strengthCards from "../data/strength_cards.json";
import questionCards from "../data/question_cards_40.json";
import eventCards from "../data/event_spaces_20.json";
import { normalizeBoard } from "./gameEngine";
import type { DataBundle } from "./types";

export const gameData: DataBundle = {
  board: normalizeBoard(rawBoard),
  careerCards,
  strengthCards,
  questionCards,
  eventCards,
};
