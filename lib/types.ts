export type SpaceType =
  | "start"
  | "question"
  | "deep"
  | "praise"
  | "question_to_other"
  | "event"
  | "card_draw"
  | "goal";

export interface BoardSpace {
  id: number;
  type: SpaceType;
  label: string;
  eventId?: string;
}

export interface CareerCard {
  id: number;
  title: string;
  category: string;
  description: string;
  skills: string[];
  personality: string[];
}

export interface StrengthCard {
  id: number;
  text: string;
  category: string;
}

export interface StrengthGift {
  id: string;
  strengthCard: StrengthCard;
  fromPlayerId: string;
  toPlayerId: string;
  createdAt: string;
}

export interface QuestionCard {
  id: string;
  text: string;
  category: string;
}

export interface EventCard {
  id: string;
  title: string;
  description: string;
  effectType: string;
  advanceBy?: number;
}

export interface Player {
  id: string;
  name: string;
  position: number;
  color: string;
  avatarUrl?: string | null;
  careerCards: CareerCard[];
  strengthCards: StrengthCard[];
  socketId?: string;
  isBot: boolean;
}

export interface TurnResolution {
  kind: "question" | "event" | "deep" | "praise" | "question_to_other" | "card_draw" | "goal";
  title: string;
  description: string;
  cardId?: string | number;
  spaceId: number;
  actionRequired?: "draw_event";
}

export interface GameLog {
  id: string;
  message: string;
  createdAt: string;
}

export interface TurnOrderRoll {
  playerId: string;
  playerName: string;
  dice: number;
}

export interface RoomState {
  roomId: string;
  boardVersion: string;
  players: Player[];
  turnOrderRolls: TurnOrderRoll[];
  currentTurnIndex: number;
  started: boolean;
  endedAt: string | null;
  endedByName: string | null;
  isDemoMode: boolean;
  board: BoardSpace[];
  logs: GameLog[];
  facilitatorId: string | null;
  facilitatorName: string | null;
  facilitatorSocketId: string | null;
  activeResolution: TurnResolution | null;
  usedQuestionIds: string[];
  usedEventIds: string[];
  usedStrengthCardIds: number[];
  strengthGiftHistory: StrengthGift[];
  winnerId: string | null;
}

export interface DataBundle {
  board: BoardSpace[];
  careerCards: CareerCard[];
  strengthCards: StrengthCard[];
  questionCards: QuestionCard[];
  eventCards: EventCard[];
}
