import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeBoard } from "../lib/gameEngine";
import type { BoardSpace, CareerCard, DataBundle, EventCard, QuestionCard, StrengthCard } from "../lib/types";

const resolveDataPath = (filePath: string) => resolve(process.cwd(), filePath);

const readJson = <T>(filePath: string): T => JSON.parse(readFileSync(resolveDataPath(filePath), "utf-8")) as T;

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface BoardSnapshot {
  board: BoardSpace[];
  boardVersion: string;
}

export const loadLatestBoardSnapshot = (): BoardSnapshot => {
  const filePath = resolveDataPath("data/board_layout_40.json");
  const rawText = readFileSync(filePath, "utf-8");
  const rawBoard = JSON.parse(rawText) as Array<{ index: number; type: string; label: string; eventId?: string }>;
  const board = normalizeBoard(rawBoard);
  const stats = statSync(filePath);
  const hash = createHash("sha1").update(rawText).digest("hex").slice(0, 8);

  return {
    board,
    boardVersion: `${stats.mtimeMs.toFixed(0)}-${hash}`,
  };
};

export const loadStaticGameData = (): DataBundle => {
  const { board } = loadLatestBoardSnapshot();
  const careerCards = readJson<CareerCard[]>("data/career_cards.json");
  const strengthCards = readJson<StrengthCard[]>("data/strength_cards.json");
  const questionCards = readJson<QuestionCard[]>("data/question_cards_40.json");
  const eventCards = readJson<EventCard[]>("data/event_spaces_20.json");

  return {
    board,
    careerCards,
    strengthCards,
    questionCards,
    eventCards,
  };
};

export const cloneBoard = (board: BoardSpace[]) => cloneJson(board);
