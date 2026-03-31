import type {
  BoardSpace,
  CareerCard,
  DataBundle,
  EventCard,
  GameLog,
  Player,
  QuestionCard,
  RoomState,
  SpaceType,
  StrengthCard,
  StrengthGift,
  TurnOrderRoll,
  TurnResolution,
} from "./types";

const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

const spaceTypeMap: Record<string, SpaceType> = {
  start: "start",
  question: "question",
  deep_dive: "deep",
  praise: "praise",
  ask_other: "question_to_other",
  career_event: "event",
  draw_career: "card_draw",
  goal: "goal",
  deep: "deep",
  question_to_other: "question_to_other",
  event: "event",
  card_draw: "card_draw",
};

export const normalizeBoard = (
  rawBoard: Array<{ index?: number; id?: number; type: string; label: string; eventId?: string }>,
): BoardSpace[] =>
  rawBoard.map((space, index) => ({
    id: space.index ?? space.id ?? index + 1,
    type: spaceTypeMap[space.type] ?? "question",
    label: space.label,
    eventId: space.eventId,
  }));

export const createLog = (message: string): GameLog => ({
  id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  message,
  createdAt: new Date().toISOString(),
});

export const appendLog = (room: RoomState, message: string): RoomState => ({
  ...room,
  logs: [createLog(message), ...room.logs],
});

const drawUnusedQuestion = (questionCards: QuestionCard[], usedQuestionIds: string[]): QuestionCard => {
  const pool = questionCards.filter((card) => !usedQuestionIds.includes(card.id));
  return (pool[0] ?? questionCards[0])!;
};

const drawUnusedEvent = (eventCards: EventCard[], usedEventIds: string[]): EventCard => {
  const pool = eventCards.filter((card) => !usedEventIds.includes(card.id));
  return (pool[0] ?? eventCards[0])!;
};

const drawNextCareerCard = (careerCards: CareerCard[], ownedIds: number[]): CareerCard | null => {
  return careerCards.find((card) => !ownedIds.includes(card.id)) ?? null;
};

const addCareerCardToPlayer = (players: Player[], playerId: string, careerCards: CareerCard[]) => {
  const targetPlayer = players.find((player) => player.id === playerId);
  if (!targetPlayer || targetPlayer.careerCards.length >= 5) {
    return { players, card: null as CareerCard | null };
  }

  const ownedIds = players.flatMap((player) => player.careerCards.map((card) => card.id));
  const nextCard = drawNextCareerCard(careerCards, ownedIds);
  if (!nextCard) {
    return { players, card: null as CareerCard | null };
  }

  return {
    players: players.map((player) =>
      player.id === playerId ? { ...player, careerCards: [...player.careerCards, nextCard] } : player,
    ),
    card: nextCard,
  };
};

const addRandomStrengthCardToPlayer = (
  players: Player[],
  playerId: string,
  strengthCards: StrengthCard[],
  usedStrengthCardIds: number[],
) => {
  const availableCards = strengthCards.filter((card) => !usedStrengthCardIds.includes(card.id));
  if (availableCards.length === 0) {
    return { players, card: null as StrengthCard | null, usedStrengthCardIds };
  }

  const randomIndex = Math.floor(Math.random() * availableCards.length);
  const nextCard = availableCards[randomIndex] ?? null;
  if (!nextCard) {
    return { players, card: null as StrengthCard | null, usedStrengthCardIds };
  }

  return {
    players: players.map((player) =>
      player.id === playerId ? { ...player, strengthCards: [...player.strengthCards, nextCard] } : player,
    ),
    card: nextCard,
    usedStrengthCardIds: [...usedStrengthCardIds, nextCard.id],
  };
};

const shuffle = <T>(items: T[]): T[] => {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex]!, nextItems[index]!];
  }
  return nextItems;
};

const groupCareerCardsByCategory = (careerCards: CareerCard[]): Map<string, CareerCard[]> => {
  const grouped = new Map<string, CareerCard[]>();

  careerCards.forEach((card) => {
    const existing = grouped.get(card.category) ?? [];
    grouped.set(card.category, [...existing, card]);
  });

  return new Map([...grouped.entries()].map(([category, cards]) => [category, shuffle(cards)]));
};

const dealInitialCareerCards = (players: Player[], careerCards: CareerCard[]): CareerCard[][] => {
  const cardsByCategory = groupCareerCardsByCategory(careerCards);
  const categoryUsage = new Map([...cardsByCategory.keys()].map((category) => [category, 0]));

  return players.map(() => {
    const selectedCategories = [...cardsByCategory.keys()]
      .filter((category) => (cardsByCategory.get(category)?.length ?? 0) > 0)
      .sort((left, right) => {
        const usageDiff = (categoryUsage.get(left) ?? 0) - (categoryUsage.get(right) ?? 0);
        return usageDiff !== 0 ? usageDiff : Math.random() - 0.5;
      })
      .slice(0, 5);

    const dealtCards = selectedCategories
      .map((category) => {
        const categoryCards = cardsByCategory.get(category) ?? [];
        const nextCard = categoryCards.shift() ?? null;
        cardsByCategory.set(category, categoryCards);
        categoryUsage.set(category, (categoryUsage.get(category) ?? 0) + (nextCard ? 1 : 0));
        return nextCard;
      })
      .filter((card): card is CareerCard => card !== null);

    return dealtCards;
  });
};

const dealInitialStrengthCards = (players: Player[], strengthCards: StrengthCard[]) => {
  const shuffledCards = shuffle(strengthCards);
  const usedIds: number[] = [];

  const dealtCards = players.map((_player, playerIndex) => {
    const cards = shuffledCards.slice(playerIndex * 3, playerIndex * 3 + 3);
    usedIds.push(...cards.map((card) => card.id));
    return cards;
  });

  return { dealtCards, usedIds };
};

const buildPromptResolution = (
  type: TurnResolution["kind"],
  title: string,
  description: string,
  spaceId: number,
  cardId?: string | number,
  actionRequired?: TurnResolution["actionRequired"],
): TurnResolution => ({
  kind: type,
  title,
  description,
  spaceId,
  cardId,
  actionRequired,
});

export const createRoomState = (roomId: string, board: BoardSpace[], boardVersion: string, isDemoMode = false): RoomState => ({
  roomId,
  boardVersion,
  players: [],
  turnOrderRolls: [],
  currentTurnIndex: 0,
  started: false,
  endedAt: null,
  endedByName: null,
  isDemoMode,
  board,
  logs: [createLog(`ルーム ${roomId} を作成しました`)],
  facilitatorId: null,
  facilitatorName: null,
  facilitatorSocketId: null,
  activeResolution: null,
  usedQuestionIds: [],
  usedEventIds: [],
  usedStrengthCardIds: [],
  strengthGiftHistory: [],
  winnerId: null,
});

export const assignFacilitator = (room: RoomState, name: string, socketId: string) => {
  const facilitatorId = `facilitator_${Math.random().toString(36).slice(2, 8)}`;
  room.facilitatorId = facilitatorId;
  room.facilitatorName = name;
  room.facilitatorSocketId = socketId;
  room.logs.unshift(createLog(`${name} がファシリテーターとして入室しました`));
  return facilitatorId;
};

export const addPlayerToRoom = (
  room: RoomState,
  name: string,
  socketId: string,
  isBot = false,
  avatarUrl?: string | null,
): Player => {
  const player: Player = {
    id: `player_${Math.random().toString(36).slice(2, 8)}`,
    name,
    position: 0,
    color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
    avatarUrl: avatarUrl ?? null,
    careerCards: [],
    strengthCards: [],
    socketId,
    isBot,
  };

  room.players.push(player);
  if (!room.started) {
    room.turnOrderRolls = [];
  }
  room.logs.unshift(createLog(`${name} が参加しました`));
  return player;
};

export const startGame = (room: RoomState, data: DataBundle): RoomState => {
  const initialCareerCards = dealInitialCareerCards(room.players, data.careerCards);
  const initialStrengthCards = dealInitialStrengthCards(room.players, data.strengthCards);

  const nextPlayers = room.players.map((player, playerIndex) => {
    return {
      ...player,
      position: 0,
      careerCards: initialCareerCards[playerIndex] ?? [],
      strengthCards: initialStrengthCards.dealtCards[playerIndex] ?? [],
    };
  });

  return {
    ...room,
    players: nextPlayers,
    turnOrderRolls: [],
    started: true,
    endedAt: null,
    endedByName: null,
    currentTurnIndex: 0,
    activeResolution: null,
    usedQuestionIds: [],
    usedEventIds: [],
    usedStrengthCardIds: initialStrengthCards.usedIds,
    strengthGiftHistory: [],
    winnerId: null,
    logs: [createLog("ゲームを開始しました"), ...room.logs],
  };
};

export const setPlayOrder = (room: RoomState, orderedPlayerIds: string[]): RoomState => {
  if (orderedPlayerIds.length !== room.players.length) {
    return room;
  }

  const seen = new Set(orderedPlayerIds);
  if (seen.size !== room.players.length) {
    return room;
  }

  const playerMap = new Map(room.players.map((player) => [player.id, player]));
  const orderedPlayers = orderedPlayerIds
    .map((playerId) => playerMap.get(playerId))
    .filter((player): player is Player => Boolean(player));

  if (orderedPlayers.length !== room.players.length) {
    return room;
  }

  const currentPlayerId = room.players[room.currentTurnIndex]?.id;
  const nextTurnIndex = currentPlayerId ? Math.max(0, orderedPlayers.findIndex((player) => player.id === currentPlayerId)) : 0;

  return appendLog(
    {
      ...room,
      players: orderedPlayers,
      turnOrderRolls: [],
      currentTurnIndex: nextTurnIndex,
    },
    `手番順を ${orderedPlayers.map((player) => player.name).join(" → ")} に変更しました`,
  );
};

export const rollTurnOrderDice = (room: RoomState): RoomState => {
  const indexedPlayers = room.players.map((player, index) => ({
    player,
    index,
    dice: Math.floor(Math.random() * 6) + 1,
  }));

  const turnOrderRolls: TurnOrderRoll[] = indexedPlayers.map(({ player, dice }) => ({
    playerId: player.id,
    playerName: player.name,
    dice,
  }));

  const sortedPlayers = [...indexedPlayers]
    .sort((left, right) => (right.dice - left.dice) || (left.index - right.index))
    .map((entry) => entry.player);

  const currentPlayerId = room.players[room.currentTurnIndex]?.id;
  const nextTurnIndex = currentPlayerId ? Math.max(0, sortedPlayers.findIndex((player) => player.id === currentPlayerId)) : 0;

  return appendLog(
    {
      ...room,
      players: sortedPlayers,
      turnOrderRolls,
      currentTurnIndex: nextTurnIndex,
    },
    `順番決めサイコロの結果: ${turnOrderRolls.map((roll) => `${roll.playerName}=${roll.dice}`).join(" / ")}`,
  );
};

export const drawTurnOrderLottery = (room: RoomState, actorId: string, targetPlayerId?: string): RoomState => {
  const targetId = targetPlayerId ?? actorId;
  const targetPlayer = room.players.find((player) => player.id === targetId);
  if (!targetPlayer) {
    return room;
  }

  if (room.turnOrderRolls.some((roll) => roll.playerId === targetId)) {
    return room;
  }

  const usedValues = new Set(room.turnOrderRolls.map((roll) => roll.dice));
  const availableValues = Array.from({ length: room.players.length }, (_value, index) => index + 1).filter(
    (value) => !usedValues.has(value),
  );

  if (availableValues.length === 0) {
    return room;
  }

  const nextRolls = [...room.turnOrderRolls];
  const takeRandomValue = () => {
    const randomIndex = Math.floor(Math.random() * availableValues.length);
    const [value] = availableValues.splice(randomIndex, 1);
    return value;
  };

  const targetValue = takeRandomValue();
  if (!targetValue) {
    return room;
  }

  nextRolls.push({
    playerId: targetPlayer.id,
    playerName: targetPlayer.name,
    dice: targetValue,
  });

  const pendingBots = room.players.filter(
    (player) => player.isBot && !nextRolls.some((roll) => roll.playerId === player.id),
  );

  pendingBots.forEach((botPlayer) => {
    const botValue = takeRandomValue();
    if (!botValue) {
      return;
    }

    nextRolls.push({
      playerId: botPlayer.id,
      playerName: botPlayer.name,
      dice: botValue,
    });
  });

  const roomWithRolls: RoomState = {
    ...room,
    turnOrderRolls: nextRolls,
    logs: [createLog(`${targetPlayer.name} が順番くじを引きました`), ...room.logs],
  };

  if (nextRolls.length !== room.players.length) {
    return roomWithRolls;
  }

  const sortedPlayerIds = [...nextRolls]
    .sort((left, right) => left.dice - right.dice)
    .map((roll) => roll.playerId);

  return appendLog(
    {
      ...setPlayOrder(roomWithRolls, sortedPlayerIds),
      turnOrderRolls: nextRolls,
      currentTurnIndex: 0,
    },
    `順番くじで手番順が確定しました: ${[...nextRolls]
      .sort((left, right) => left.dice - right.dice)
      .map((roll) => `${roll.dice}番 ${roll.playerName}`)
      .join(" / ")}`,
  );
};

export const endGame = (room: RoomState, actorId: string): RoomState => {
  const actorName =
    room.facilitatorId === actorId
      ? room.facilitatorName
      : room.players.find((player) => player.id === actorId)?.name ?? null;

  if (!actorName) {
    return room;
  }

  return {
    ...room,
    started: false,
    activeResolution: null,
    endedAt: new Date().toISOString(),
    endedByName: actorName,
    logs: [createLog(`${actorName} がゲームを終了しました`), ...room.logs],
  };
};

export const getCurrentPlayer = (room: RoomState): Player | undefined => room.players[room.currentTurnIndex];

export const canStartGame = (room: RoomState): boolean => {
  if (room.isDemoMode) {
    return room.players.length >= 1 && room.players.length <= 5;
  }

  return room.players.length >= 3 && room.players.length <= 5;
};

export interface RollResult {
  room: RoomState;
  dice: number;
}

export const drawEventForCurrentPlayer = (room: RoomState, data: DataBundle): RoomState => {
  const currentPlayer = getCurrentPlayer(room);
  if (!currentPlayer || !room.activeResolution || room.activeResolution.actionRequired !== "draw_event") {
    return room;
  }

  const eventCard = drawUnusedEvent(data.eventCards, room.usedEventIds);
  let playersAfterEffect = room.players;
  let usedStrengthCardIds = room.usedStrengthCardIds;
  let description = eventCard.description;

  if (eventCard.effectType === "draw_card") {
    const result = addCareerCardToPlayer(room.players, currentPlayer.id, data.careerCards);
    playersAfterEffect = result.players;
    description = result.card
      ? `${eventCard.description}\n追加された職業カード: 「${result.card.title}」`
      : `${eventCard.description}\n職業カードは追加できませんでした。`;
  }

  if (eventCard.effectType === "advance" && eventCard.advanceBy) {
    playersAfterEffect = playersAfterEffect.map((player) =>
      player.id === currentPlayer.id
        ? { ...player, position: Math.min(player.position + eventCard.advanceBy!, room.board.length - 1) }
        : player,
    );
  }

  if (eventCard.effectType === "strength_random") {
    const result = addRandomStrengthCardToPlayer(room.players, currentPlayer.id, data.strengthCards, room.usedStrengthCardIds);
    playersAfterEffect = result.players;
    usedStrengthCardIds = result.usedStrengthCardIds;
    description = result.card
      ? `${eventCard.description}\n追加された強みカード: 「${result.card.text}」`
      : `${eventCard.description}\n追加できる強みカードがありませんでした。`;
  }

  if (eventCard.effectType === "random_chance") {
    const dice = Math.floor(Math.random() * 6) + 1;
    if (dice % 2 === 0) {
      const result = addCareerCardToPlayer(room.players, currentPlayer.id, data.careerCards);
      playersAfterEffect = result.players;
      description = result.card
        ? `${eventCard.description}\n${dice} が出たので職業カード「${result.card.title}」を追加しました。`
        : `${eventCard.description}\n${dice} が出ましたが、職業カードは追加できませんでした。`;
    } else {
      const result = addRandomStrengthCardToPlayer(room.players, currentPlayer.id, data.strengthCards, room.usedStrengthCardIds);
      playersAfterEffect = result.players;
      usedStrengthCardIds = result.usedStrengthCardIds;
      description = result.card
        ? `${eventCard.description}\n${dice} が出たので強みカード「${result.card.text}」を追加しました。`
        : `${eventCard.description}\n${dice} が出ましたが、強みカードは追加できませんでした。`;
    }
  }

  return {
    ...room,
    players: playersAfterEffect,
    usedStrengthCardIds,
    activeResolution: buildPromptResolution("event", eventCard.title, description, room.activeResolution.spaceId, eventCard.id),
    usedEventIds: [...room.usedEventIds, eventCard.id],
    logs: [createLog(`${currentPlayer.name} がイベントカード「${eventCard.title}」を引きました`), ...room.logs],
  };
};

export const resolveTurn = (room: RoomState, data: DataBundle, dice: number): RollResult => {
  const currentPlayer = getCurrentPlayer(room);

  if (!currentPlayer) {
    return { room, dice };
  }

  const nextPosition = Math.min(currentPlayer.position + dice, room.board.length - 1);
  const nextPlayers = room.players.map((player) =>
    player.id === currentPlayer.id ? { ...player, position: nextPosition } : player,
  );
  const currentSpace = room.board[nextPosition];
  const updatedRoom: RoomState = {
    ...room,
    players: nextPlayers,
    activeResolution: null,
    logs: [createLog(`${currentPlayer.name} が ${dice} を出して ${nextPosition} マス目へ移動`), ...room.logs],
  };

  if (!currentSpace) {
    return { room: updatedRoom, dice };
  }

  let resolution: TurnResolution | null = null;
  let usedQuestionIds = updatedRoom.usedQuestionIds;
  let usedEventIds = updatedRoom.usedEventIds;
  let playersAfterEffect = updatedRoom.players;
  let winnerId = updatedRoom.winnerId;

  switch (currentSpace.type) {
    case "question":
      {
        const question = drawUnusedQuestion(data.questionCards, updatedRoom.usedQuestionIds);
        resolution = buildPromptResolution("question", "質問カード", question.text, currentSpace.id, question.id);
        usedQuestionIds = [...updatedRoom.usedQuestionIds, question.id];
      }
      break;
    case "deep":
      {
        const question = drawUnusedQuestion(data.questionCards, updatedRoom.usedQuestionIds);
        resolution = buildPromptResolution("deep", "深掘りタイム", `このテーマを深掘りしてください: ${question.text}`, currentSpace.id, question.id);
        usedQuestionIds = [...updatedRoom.usedQuestionIds, question.id];
      }
      break;
    case "praise":
      resolution = buildPromptResolution("praise", "ほめ活", "その人の強みや良さを全員で1つずつ伝えましょう。", currentSpace.id);
      break;
    case "question_to_other":
      {
        const question = drawUnusedQuestion(data.questionCards, updatedRoom.usedQuestionIds);
        resolution = buildPromptResolution(
          "question_to_other",
          "他者質問",
          `他の誰か1人を選んで質問してください: ${question.text}`,
          currentSpace.id,
          question.id,
        );
        usedQuestionIds = [...updatedRoom.usedQuestionIds, question.id];
      }
      break;
    case "event":
      resolution = buildPromptResolution(
        "event",
        "イベントマス",
        "イベントを引いて内容を確認してください。",
        currentSpace.id,
        undefined,
        "draw_event",
      );
      break;
    case "card_draw":
      {
        const ownedIds = updatedRoom.players.flatMap((player) => player.careerCards.map((card) => card.id));
        const nextCard = drawNextCareerCard(data.careerCards, ownedIds);
        if (nextCard) {
          playersAfterEffect = updatedRoom.players.map((player) =>
            player.id === currentPlayer.id && player.careerCards.length < 5
              ? { ...player, careerCards: [...player.careerCards, nextCard] }
              : player,
          );
        }
        resolution = buildPromptResolution(
          "card_draw",
          "キャリアカード追加",
          currentPlayer.careerCards.length < 5 && nextCard
            ? `「${nextCard.title}」を追加しました。`
            : "手札は最大5枚です。ファシリテーター判断で交換または紹介のみ行ってください。",
          currentSpace.id,
          nextCard?.id,
        );
      }
      break;
    case "goal":
      resolution = buildPromptResolution("goal", "GOAL", "ゴール到達です。ファシリテーター判断で終了または継続できます。", currentSpace.id);
      winnerId = currentPlayer.id;
      break;
    case "start":
    default:
      resolution = null;
      break;
  }

  return {
    dice,
    room: {
      ...updatedRoom,
      players: playersAfterEffect,
      activeResolution: resolution,
      usedQuestionIds,
      usedEventIds,
      winnerId,
    },
  };
};

export const advanceTurn = (room: RoomState): RoomState => {
  if (room.players.length === 0) {
    return room;
  }

  const nextIndex = (room.currentTurnIndex + 1) % room.players.length;
  return {
    ...room,
    currentTurnIndex: nextIndex,
    activeResolution: null,
    logs: [createLog(`次の手番は ${room.players[nextIndex]?.name ?? "不明"} です`), ...room.logs],
  };
};

export const setCurrentTurnPlayer = (room: RoomState, playerId: string): RoomState => {
  const targetIndex = room.players.findIndex((player) => player.id === playerId);
  if (targetIndex < 0) {
    return room;
  }

  return appendLog(
    {
      ...room,
      currentTurnIndex: targetIndex,
      activeResolution: null,
    },
    `${room.players[targetIndex]?.name ?? "不明"} を現在ターンに設定しました`,
  );
};

export const movePlayerToPosition = (room: RoomState, playerId: string, position: number): RoomState => {
  const nextPosition = Math.max(0, Math.min(position, room.board.length - 1));
  const nextPlayers = room.players.map((player) =>
    player.id === playerId ? { ...player, position: nextPosition } : player,
  );

  const targetPlayer = room.players.find((player) => player.id === playerId);
  return appendLog(
    {
      ...room,
      players: nextPlayers,
    },
    `${targetPlayer?.name ?? "不明"} を ${nextPosition} マス目へ移動しました`,
  );
};

export const setActiveResolution = (room: RoomState, resolution: TurnResolution | null): RoomState => {
  return {
    ...room,
    activeResolution: resolution,
  };
};

export const giveStrengthCard = (
  room: RoomState,
  strengthCards: StrengthCard[],
  strengthCardId: number,
  fromPlayerId: string,
  toPlayerId: string,
): RoomState => {
  const fromPlayer = room.players.find((player) => player.id === fromPlayerId);
  const toPlayer = room.players.find((player) => player.id === toPlayerId);
  const strengthCard = strengthCards.find((card) => card.id === strengthCardId);
  const actorName = fromPlayer?.name ?? (room.facilitatorId === fromPlayerId ? room.facilitatorName : null);

  if (!actorName || !toPlayer || !strengthCard || room.usedStrengthCardIds.includes(strengthCardId)) {
    return room;
  }

  const nextPlayers = room.players.map((player) =>
    player.id === toPlayerId ? { ...player, strengthCards: [...player.strengthCards, strengthCard] } : player,
  );
  const gift: StrengthGift = {
    id: `strength_gift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    strengthCard,
    fromPlayerId,
    toPlayerId,
    createdAt: new Date().toISOString(),
  };

  return {
    ...room,
    players: nextPlayers,
    usedStrengthCardIds: [...room.usedStrengthCardIds, strengthCardId],
    strengthGiftHistory: [gift, ...room.strengthGiftHistory],
    logs: [createLog(`${actorName} が ${toPlayer.name} に「${strengthCard.text}」カードを渡しました`), ...room.logs],
  };
};

export const giveRandomStrengthCard = (
  room: RoomState,
  strengthCards: StrengthCard[],
  fromPlayerId: string,
  toPlayerId: string,
): RoomState => {
  const availableCards = strengthCards.filter((card) => !room.usedStrengthCardIds.includes(card.id));
  if (availableCards.length === 0) {
    return room;
  }

  const randomIndex = Math.floor(Math.random() * availableCards.length);
  const selectedCard = availableCards[randomIndex];
  if (!selectedCard) {
    return room;
  }

  return giveStrengthCard(room, strengthCards, selectedCard.id, fromPlayerId, toPlayerId);
};

export const moveStrengthCard = (
  room: RoomState,
  strengthCards: StrengthCard[],
  strengthCardId: number,
  actorPlayerId: string,
  fromPlayerId: string | null,
  toPlayerId: string | null,
): RoomState => {
  const actorName =
    room.players.find((player) => player.id === actorPlayerId)?.name ??
    (room.facilitatorId === actorPlayerId ? room.facilitatorName : null);
  const strengthCard = strengthCards.find((card) => card.id === strengthCardId);
  const fromPlayer = fromPlayerId ? room.players.find((player) => player.id === fromPlayerId) : null;
  const toPlayer = toPlayerId ? room.players.find((player) => player.id === toPlayerId) : null;
  const isInPool = !room.usedStrengthCardIds.includes(strengthCardId);
  const fromHasCard = fromPlayerId ? fromPlayer?.strengthCards.some((card) => card.id === strengthCardId) : isInPool;

  if (!actorName || !strengthCard || !fromHasCard || (fromPlayerId && !fromPlayer) || (toPlayerId && !toPlayer)) {
    return room;
  }

  if (fromPlayerId === toPlayerId) {
    return room;
  }

  const removedPlayers = room.players.map((player) =>
    player.id === fromPlayerId
      ? { ...player, strengthCards: player.strengthCards.filter((card) => card.id !== strengthCardId) }
      : player,
  );

  const nextPlayers = removedPlayers.map((player) =>
    player.id === toPlayerId ? { ...player, strengthCards: [...player.strengthCards, strengthCard] } : player,
  );

  const nextUsedStrengthCardIds = toPlayerId
    ? Array.from(new Set([...room.usedStrengthCardIds, strengthCardId]))
    : room.usedStrengthCardIds.filter((id) => id !== strengthCardId);

  const nextHistory = room.strengthGiftHistory.filter((entry) => entry.strengthCard.id !== strengthCardId);
  const fromLabel = fromPlayer?.name ?? "未配布";
  const toLabel = toPlayer?.name ?? "未配布";

  return {
    ...room,
    players: nextPlayers,
    usedStrengthCardIds: nextUsedStrengthCardIds,
    strengthGiftHistory: nextHistory,
    logs: [createLog(`${actorName} が「${strengthCard.text}」を ${fromLabel} から ${toLabel} へ移動しました`), ...room.logs],
  };
};

export const undoStrengthGift = (room: RoomState, giftId: string, actorPlayerId: string): RoomState => {
  const gift = room.strengthGiftHistory.find((entry) => entry.id === giftId);
  if (!gift) {
    return room;
  }

  const actor = room.players.find((player) => player.id === actorPlayerId);
  const fromPlayer = room.players.find((player) => player.id === gift.fromPlayerId);
  const toPlayer = room.players.find((player) => player.id === gift.toPlayerId);
  const canUndo = actorPlayerId === room.facilitatorId || actorPlayerId === gift.fromPlayerId;
  const actorName = actor?.name ?? (room.facilitatorId === actorPlayerId ? room.facilitatorName : null);
  const fromName = fromPlayer?.name ?? (room.facilitatorId === gift.fromPlayerId ? room.facilitatorName : null);

  if (!actorName || !fromName || !toPlayer || !canUndo) {
    return room;
  }

  const nextPlayers = room.players.map((player) =>
    player.id === gift.toPlayerId
      ? { ...player, strengthCards: player.strengthCards.filter((card) => card.id !== gift.strengthCard.id) }
      : player,
  );

  return {
    ...room,
    players: nextPlayers,
    usedStrengthCardIds: room.usedStrengthCardIds.filter((id) => id !== gift.strengthCard.id),
    strengthGiftHistory: room.strengthGiftHistory.filter((entry) => entry.id !== giftId),
    logs: [createLog(`${actorName} が ${toPlayer.name} への「${gift.strengthCard.text}」カード配布を取り消しました`), ...room.logs],
  };
};
