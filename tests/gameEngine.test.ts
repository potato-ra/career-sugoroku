import {
  addPlayerToRoom,
  advanceTurn,
  assignFacilitator,
  canStartGame,
  createRoomState,
  drawTurnOrderLottery,
  drawEventForCurrentPlayer,
  giveRandomStrengthCard,
  moveStrengthCard,
  rollTurnOrderDice,
  resolveTurn,
  setPlayOrder,
  startGame,
} from "../lib/gameEngine";
import { gameData } from "../lib/gameData";
import { describe, expect, it } from "vitest";

describe("gameEngine", () => {
  const boardVersion = "test-board-version";

  it("starts only when 3 to 5 players are present", () => {
    const room = createRoomState("room-a", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    expect(canStartGame(room)).toBe(false);

    addPlayerToRoom(room, "C", "socket-c");
    expect(canStartGame(room)).toBe(true);
  });

  it("allows demo rooms to start with one human player", () => {
    const room = createRoomState("room-demo", gameData.board, boardVersion, true);
    addPlayerToRoom(room, "Solo", "socket-a");
    expect(canStartGame(room)).toBe(true);
  });

  it("does not count the facilitator as a player in demo rooms", () => {
    const room = createRoomState("room-demo-facilitator", gameData.board, boardVersion, true);
    assignFacilitator(room, "Facilitator", "socket-f");
    expect(canStartGame(room)).toBe(false);

    addPlayerToRoom(room, "Demo_Player", "socket-f");
    expect(canStartGame(room)).toBe(true);
  });

  it("deals five public career cards to each player", () => {
    const room = createRoomState("room-b", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");

    const started = startGame(room, gameData);
    expect(started.players.every((player) => player.careerCards.length === 5)).toBe(true);
  });

  it("deals career cards from different categories within each initial hand", () => {
    const room = createRoomState("room-b2", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");

    const started = startGame(room, gameData);

    started.players.forEach((player) => {
      const categories = player.careerCards.map((card) => card.category);
      expect(new Set(categories).size).toBe(categories.length);
    });
  });

  it("deals three initial strength cards to each player", () => {
    const room = createRoomState("room-b3", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");

    const started = startGame(room, gameData);

    expect(started.players.every((player) => player.strengthCards.length === 3)).toBe(true);
    expect(started.usedStrengthCardIds.length).toBe(9);
  });

  it("moves current player and advances turn", () => {
    const room = createRoomState("room-c", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");
    const started = startGame(room, gameData);

    const rolled = resolveTurn(started, gameData, 3);
    expect(rolled.room.players[0]?.position).toBe(3);
    expect(rolled.room.activeResolution?.kind).toBe("question");

    const advanced = advanceTurn(rolled.room);
    expect(advanced.currentTurnIndex).toBe(1);
  });

  it("waits for the player to draw an event card after landing on an event space", () => {
    const room = createRoomState("room-event", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");
    const started = startGame(room, gameData);

    const rolled = resolveTurn(started, gameData, 2);
    expect(rolled.room.players[0]?.position).toBe(2);
    expect(rolled.room.activeResolution?.kind).toBe("event");
    expect(rolled.room.activeResolution?.actionRequired).toBe("draw_event");

    const afterDraw = drawEventForCurrentPlayer(rolled.room, gameData);
    expect(afterDraw.activeResolution?.actionRequired).toBeUndefined();
    expect(afterDraw.activeResolution?.cardId).toBeDefined();
    expect(afterDraw.usedEventIds.length).toBe(1);
  });

  it("gives one random strength card to the selected player", () => {
    const room = createRoomState("room-d", gameData.board, boardVersion);
    const facilitatorId = assignFacilitator(room, "Facilitator", "socket-f");
    const target = addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");
    const started = startGame(room, gameData);

    const beforeTarget = started.players.find((player) => player.id === target.id);
    expect(beforeTarget?.strengthCards.length).toBe(3);

    const updated = giveRandomStrengthCard(started, gameData.strengthCards, facilitatorId, target.id);
    const afterTarget = updated.players.find((player) => player.id === target.id);

    expect(afterTarget?.strengthCards.length).toBe(4);
    expect(updated.usedStrengthCardIds.length).toBe(started.usedStrengthCardIds.length + 1);
    expect(updated.strengthGiftHistory.length).toBe(1);
  });

  it("lets the facilitator move an initial strength card back to the pool", () => {
    const room = createRoomState("room-strength-move", gameData.board, boardVersion);
    const facilitatorId = assignFacilitator(room, "Facilitator", "socket-f");
    const playerA = addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");
    const started = startGame(room, gameData);

    const targetPlayer = started.players.find((player) => player.id === playerA.id)!;
    const initialCard = targetPlayer.strengthCards[0]!;

    const updated = moveStrengthCard(started, gameData.strengthCards, initialCard.id, facilitatorId, targetPlayer.id, null);
    const afterPlayer = updated.players.find((player) => player.id === targetPlayer.id)!;

    expect(afterPlayer.strengthCards.some((card) => card.id === initialCard.id)).toBe(false);
    expect(updated.usedStrengthCardIds.includes(initialCard.id)).toBe(false);
  });

  it("can reorder players manually without losing the current turn player", () => {
    const room = createRoomState("room-order", gameData.board, boardVersion);
    const playerA = addPlayerToRoom(room, "A", "socket-a");
    const playerB = addPlayerToRoom(room, "B", "socket-b");
    const playerC = addPlayerToRoom(room, "C", "socket-c");
    const started = startGame(room, gameData);

    const advanced = advanceTurn(started);
    expect(advanced.players[advanced.currentTurnIndex]?.id).toBe(playerB.id);

    const reordered = setPlayOrder(advanced, [playerC.id, playerB.id, playerA.id]);
    expect(reordered.players.map((player) => player.id)).toEqual([playerC.id, playerB.id, playerA.id]);
    expect(reordered.players[reordered.currentTurnIndex]?.id).toBe(playerB.id);
  });

  it("rolls order dice and stores one result per player", () => {
    const room = createRoomState("room-order-dice", gameData.board, boardVersion);
    addPlayerToRoom(room, "A", "socket-a");
    addPlayerToRoom(room, "B", "socket-b");
    addPlayerToRoom(room, "C", "socket-c");

    const updated = rollTurnOrderDice(room);
    expect(updated.turnOrderRolls).toHaveLength(3);
    expect(updated.turnOrderRolls.every((roll) => roll.dice >= 1 && roll.dice <= 6)).toBe(true);
  });

  it("lets players draw order lottery and finalizes order when everyone has drawn", () => {
    const room = createRoomState("room-lottery", gameData.board, boardVersion);
    const playerA = addPlayerToRoom(room, "A", "socket-a");
    const playerB = addPlayerToRoom(room, "B", "socket-b");
    const playerC = addPlayerToRoom(room, "C", "socket-c");

    const afterFirstDraw = drawTurnOrderLottery(room, playerA.id);
    expect(afterFirstDraw.turnOrderRolls).toHaveLength(1);

    const afterSecondDraw = drawTurnOrderLottery(afterFirstDraw, playerB.id);
    expect(afterSecondDraw.turnOrderRolls).toHaveLength(2);

    const finalized = drawTurnOrderLottery(afterSecondDraw, playerC.id);
    expect(finalized.turnOrderRolls).toHaveLength(3);
    expect(new Set(finalized.turnOrderRolls.map((roll) => roll.dice)).size).toBe(3);
    expect(finalized.players.map((player) => player.id).sort()).toEqual([playerA.id, playerB.id, playerC.id].sort());
  });
});
