import { advanceTurn, getCurrentPlayer, resolveTurn, appendLog } from "./gameEngine";
import type { DataBundle, RoomState, TurnResolution } from "./types";

export const BOT_NAMES = ["Bot_A", "Bot_B", "Bot_C", "Bot_D"] as const;
export const BOT_DUMMY_RESPONSE = "ダミー回答: いまの自分は、人の強みを見つけながら一歩ずつ進みたいです。";

export const isBotTurn = (room: RoomState): boolean => {
  return Boolean(getCurrentPlayer(room)?.isBot);
};

export const buildBotResponse = (resolution: TurnResolution | null): string => {
  if (!resolution) {
    return BOT_DUMMY_RESPONSE;
  }

  const prefixMap: Record<TurnResolution["kind"], string> = {
    question: "質問へのBot回答",
    deep: "深掘りへのBot回答",
    praise: "ほめ活へのBotコメント",
    question_to_other: "他者質問へのBot回答",
    event: "イベントへのBotリアクション",
    card_draw: "カード追加時のBotコメント",
    goal: "ゴール到達時のBotコメント",
  };

  return `${prefixMap[resolution.kind]}: ${BOT_DUMMY_RESPONSE}`;
};

export const runBotRoll = (room: RoomState, data: DataBundle, dice?: number) => {
  const botPlayer = getCurrentPlayer(room);
  if (!botPlayer?.isBot) {
    return { room, dice: 0 };
  }

  const rolledDice = dice ?? Math.floor(Math.random() * 6) + 1;
  return resolveTurn(room, data, rolledDice);
};

export const runBotEndTurn = (room: RoomState): RoomState => {
  const botPlayer = getCurrentPlayer(room);
  if (!botPlayer?.isBot) {
    return room;
  }

  const withResponse = room.activeResolution
    ? appendLog(room, `${botPlayer.name}: ${buildBotResponse(room.activeResolution)}`)
    : room;

  return advanceTurn(withResponse);
};
