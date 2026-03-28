import express from "express";
import { createServer } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { Server } from "socket.io";
import { BOT_NAMES, runBotEndTurn, runBotRoll } from "../lib/botEngine";
import {
  addPlayerToRoom,
  advanceTurn,
  assignFacilitator,
  canStartGame,
  createRoomState,
  createLog,
  drawEventForCurrentPlayer,
  endGame,
  giveRandomStrengthCard,
  giveStrengthCard,
  movePlayerToPosition,
  resolveTurn,
  setActiveResolution,
  setCurrentTurnPlayer,
  startGame,
  undoStrengthGift,
} from "../lib/gameEngine";
import type { RoomState, TurnResolution } from "../lib/types";
import { cloneBoard, loadLatestBoardSnapshot, loadStaticGameData } from "./data";

const PORT = Number(process.env.PORT ?? 3001);
const app = express();
const httpServer = createServer(app);
const distPath = path.join(process.cwd(), "dist");
const indexPath = path.join(distPath, "index.html");
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? undefined : "*",
  },
});

const gameData = loadStaticGameData();
const rooms = new Map<string, RoomState>();
const socketRoomMap = new Map<string, { roomId: string; actorId: string; role: "facilitator" | "player" }>();
const botTimers = new Map<string, NodeJS.Timeout[]>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const RECONNECT_GRACE_MS = 30_000;

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("cwd:", process.cwd());
console.log("distPath:", distPath);
console.log("indexPath:", indexPath);
console.log("indexExists:", fs.existsSync(indexPath));

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  console.log("route hit: /");

  if (!fs.existsSync(indexPath)) {
    console.error("index.html not found:", indexPath);
    res.status(500).send(`INDEX_MISSING: ${indexPath}`);
    return;
  }

  res.sendFile(indexPath);
});

app.use(express.static(distPath));

app.get("*", (_req, res) => {
  console.log("route hit: fallback *");

  if (!fs.existsSync(indexPath)) {
    console.error("index.html not found:", indexPath);
    res.status(500).send(`INDEX_MISSING: ${indexPath}`);
    return;
  }

  res.sendFile(indexPath);
});

const emitRoomState = (roomId: string, room: RoomState) => {
  rooms.set(roomId, room);
  io.to(roomId).emit("room:state", room);
  scheduleBotAutomation(roomId);
};

const registerBotTimer = (roomId: string, timer: NodeJS.Timeout) => {
  const existing = botTimers.get(roomId) ?? [];
  botTimers.set(roomId, [...existing, timer]);
};

const clearBotTimers = (roomId: string) => {
  const timers = botTimers.get(roomId) ?? [];
  timers.forEach((timer) => clearTimeout(timer));
  botTimers.delete(roomId);
};

const clearReconnectTimer = (actorId: string) => {
  const timer = reconnectTimers.get(actorId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  reconnectTimers.delete(actorId);
};

const scheduleReconnectExpiry = (actorId: string, callback: () => void) => {
  clearReconnectTimer(actorId);
  const timer = setTimeout(() => {
    reconnectTimers.delete(actorId);
    callback();
  }, RECONNECT_GRACE_MS);
  reconnectTimers.set(actorId, timer);
};

const findAvailableRoomId = (requestedRoomId: string) => {
  if (!rooms.has(requestedRoomId)) {
    return requestedRoomId;
  }

  for (let suffix = 2; suffix <= 99; suffix += 1) {
    const candidate = `${requestedRoomId}-${suffix}`;
    if (!rooms.has(candidate)) {
      return candidate;
    }
  }

  return `${requestedRoomId}-${Date.now().toString().slice(-4)}`;
};

const addBotsToRoom = (room: RoomState, count: number) => {
  const existingNames = new Set(room.players.filter((player) => player.isBot).map((player) => player.name));
  const remainingSlots = Math.max(0, 5 - room.players.length);
  const availableBotNames = BOT_NAMES.filter((name) => !existingNames.has(name)).slice(0, Math.min(count, remainingSlots));
  availableBotNames.forEach((botName) => {
    addPlayerToRoom(room, botName, `bot:${botName}`, true);
  });
  return {
    ...room,
    logs: availableBotNames.length > 0 ? [createLog(`Bot を ${availableBotNames.length} 人追加しました`), ...room.logs] : room.logs,
  };
};

const ensureDemoLocalPlayer = (room: RoomState, socketId: string) => {
  const existingHumanPlayer = room.players.find((player) => !player.isBot);
  if (existingHumanPlayer) {
    return room;
  }

  addPlayerToRoom(room, "Demo_Player", socketId);
  return {
    ...room,
    logs: [createLog("デモ用プレイヤー Demo_Player を追加しました"), ...room.logs],
  };
};

const removeBotFromRoom = (room: RoomState, botPlayerId?: string) => {
  const botPlayers = room.players.filter((player) => player.isBot);
  const targetBot = botPlayerId
    ? room.players.find((player) => player.id === botPlayerId && player.isBot)
    : botPlayers[botPlayers.length - 1];

  if (!targetBot) {
    return room;
  }

  const nextPlayers = room.players.filter((player) => player.id !== targetBot.id);
  const nextTurnIndex = Math.min(room.currentTurnIndex, Math.max(nextPlayers.length - 1, 0));
  return {
    ...room,
    players: nextPlayers,
    currentTurnIndex: nextTurnIndex,
    logs: [createLog(`${targetBot.name} を削除しました`), ...room.logs],
  };
};

const redealCards = (room: RoomState) => {
  return startGame(
    {
      ...room,
      started: room.started,
    },
    gameData,
  );
};

function scheduleBotAutomation(roomId: string) {
  clearBotTimers(roomId);
  const room = rooms.get(roomId);
  if (!room || !room.started) {
    return;
  }

  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer?.isBot) {
    return;
  }

  if (!room.activeResolution) {
    const timer = setTimeout(() => {
      const latestRoom = rooms.get(roomId);
      if (!latestRoom || !latestRoom.started || !latestRoom.players[latestRoom.currentTurnIndex]?.isBot) {
        return;
      }

      const result = runBotRoll(latestRoom, gameData);
      const nextRoom = {
        ...result.room,
        logs: [createLog(`${currentPlayer.name} が自動で ${result.dice} を出しました`), ...result.room.logs],
      };
      emitRoomState(roomId, nextRoom);
      io.to(roomId).emit("game:rolled", { dice: result.dice, playerId: currentPlayer.id });
    }, 900);

    registerBotTimer(roomId, timer);
    return;
  }

  if (room.activeResolution.actionRequired === "draw_event") {
    const timer = setTimeout(() => {
      const latestRoom = rooms.get(roomId);
      if (!latestRoom || !latestRoom.started || !latestRoom.players[latestRoom.currentTurnIndex]?.isBot) {
        return;
      }

      const nextRoom = drawEventForCurrentPlayer(latestRoom, gameData);
      emitRoomState(roomId, nextRoom);
    }, 900);

    registerBotTimer(roomId, timer);
    return;
  }

  const timer = setTimeout(() => {
    const latestRoom = rooms.get(roomId);
    if (!latestRoom || !latestRoom.started || !latestRoom.players[latestRoom.currentTurnIndex]?.isBot) {
      return;
    }

    const nextRoom = runBotEndTurn(latestRoom);
    emitRoomState(roomId, nextRoom);
  }, 1500);

  registerBotTimer(roomId, timer);
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ roomId, name, isFacilitator, isDemoMode, botCount }, callback) => {
    const trimmedRoomId = (roomId || "").trim().toUpperCase();
    const trimmedName = (name || "").trim();

    if (!trimmedRoomId || !trimmedName) {
      callback?.({ ok: false, message: "ルームIDと名前を入力してください。" });
      return;
    }

    const nextRoomId = findAvailableRoomId(trimmedRoomId);
    const latestBoard = loadLatestBoardSnapshot();

    let room = createRoomState(nextRoomId, cloneBoard(latestBoard.board), latestBoard.boardVersion, Boolean(isDemoMode));
    const facilitatorId = assignFacilitator(room, trimmedName, socket.id);
    if (room.isDemoMode) {
      room = ensureDemoLocalPlayer(room, socket.id);
      room = addBotsToRoom(room, Math.max(2, Math.min(Number(botCount ?? 2), 4)));
      room.logs.unshift(createLog(`デモモードで開始準備中です。Bot を ${room.players.filter((entry) => entry.isBot).length} 人追加しました`));
    }
    console.log("[board-debug][server] room:create", {
      roomId: nextRoomId,
      boardVersion: room.boardVersion,
      spaces31to39: room.board.slice(30, 39).map((space) => ({ id: space.id, type: space.type })),
    });
    if (nextRoomId !== trimmedRoomId) {
      room.logs.unshift(createLog(`ルームIDが使用中だったため ${nextRoomId} で作成しました`));
    }
    rooms.set(nextRoomId, room);
    socketRoomMap.set(socket.id, { roomId: nextRoomId, actorId: facilitatorId, role: "facilitator" });
    socket.join(nextRoomId);
    emitRoomState(nextRoomId, room);
    callback?.({ ok: true, room, playerId: facilitatorId });
  });

  socket.on("room:restore", ({ roomId, actorId, role }, callback) => {
    const trimmedRoomId = (roomId || "").trim().toUpperCase();
    const room = rooms.get(trimmedRoomId);

    if (!room || !actorId || !role) {
      callback?.({ ok: false, message: "復元対象のルームが見つかりません。" });
      return;
    }

    if (role === "facilitator") {
      if (room.facilitatorId !== actorId) {
        callback?.({ ok: false, message: "ファシリテーター情報を復元できませんでした。" });
        return;
      }

      clearReconnectTimer(actorId);
      const nextRoom = {
        ...room,
        facilitatorSocketId: socket.id,
        logs: [createLog("ファシリテーターが再接続しました。"), ...room.logs],
      };
      rooms.set(trimmedRoomId, nextRoom);
      socketRoomMap.set(socket.id, { roomId: trimmedRoomId, actorId, role });
      socket.join(trimmedRoomId);
      emitRoomState(trimmedRoomId, nextRoom);
      callback?.({ ok: true, room: nextRoom, playerId: actorId });
      return;
    }

    const targetPlayer = room.players.find((player) => player.id === actorId);
    if (!targetPlayer) {
      callback?.({ ok: false, message: "プレイヤー情報を復元できませんでした。" });
      return;
    }

    clearReconnectTimer(actorId);
    const nextRoom = {
      ...room,
      players: room.players.map((player) => (player.id === actorId ? { ...player, socketId: socket.id } : player)),
      logs: [createLog(`${targetPlayer.name} が再接続しました。`), ...room.logs],
    };
    rooms.set(trimmedRoomId, nextRoom);
    socketRoomMap.set(socket.id, { roomId: trimmedRoomId, actorId, role: "player" });
    socket.join(trimmedRoomId);
    emitRoomState(trimmedRoomId, nextRoom);
    callback?.({ ok: true, room: nextRoom, playerId: actorId });
  });

  socket.on("room:join", ({ roomId, name }, callback) => {
    const trimmedRoomId = (roomId || "").trim().toUpperCase();
    const trimmedName = (name || "").trim();
    const room = rooms.get(trimmedRoomId);

    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.players.length >= 5) {
      callback?.({ ok: false, message: "このルームは満員です。" });
      return;
    }

    if (!trimmedName) {
      callback?.({ ok: false, message: "名前を入力してください。" });
      return;
    }

    const player = addPlayerToRoom(room, trimmedName, socket.id);
    socketRoomMap.set(socket.id, { roomId: trimmedRoomId, actorId: player.id, role: "player" });
    socket.join(trimmedRoomId);
    emitRoomState(trimmedRoomId, room);
    callback?.({ ok: true, room, playerId: player.id });
  });

  socket.on("game:start", ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "ゲーム開始はファシリテーターのみ可能です。" });
      return;
    }

    if (!canStartGame(room)) {
      callback?.({ ok: false, message: "3〜5人で開始してください。" });
      return;
    }

    const nextRoom = startGame(room, gameData);
    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("game:roll", ({ roomId, playerId, dice }, callback) => {
    const room = rooms.get(roomId);
    if (!room || !room.started) {
      callback?.({ ok: false, message: "ゲームが開始されていません。" });
      return;
    }

    const currentPlayer = room.players[room.currentTurnIndex];
    const canRollAsDemoFacilitator = room.isDemoMode && room.facilitatorId === playerId && currentPlayer && !currentPlayer.isBot;
    if (!currentPlayer || (currentPlayer.id !== playerId && !canRollAsDemoFacilitator)) {
      callback?.({ ok: false, message: "現在の手番プレイヤーのみ操作できます。" });
      return;
    }

    if (room.activeResolution) {
      callback?.({ ok: false, message: "現在のイベントを完了してから次の手番に進んでください。" });
      return;
    }

    const resolvedDice =
      typeof dice === "number" && dice >= 1 && dice <= 6 ? Math.floor(dice) : Math.floor(Math.random() * 6) + 1;
    const result = resolveTurn(room, gameData, resolvedDice);
    emitRoomState(roomId, result.room);
    io.to(roomId).emit("game:rolled", { dice: resolvedDice, playerId: currentPlayer.id });
    callback?.({ ok: true, dice: resolvedDice });
  });

  socket.on("game:endTurn", ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room || !room.started) {
      callback?.({ ok: false, message: "ゲームが開始されていません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "ターン終了はファシリテーターのみ操作できます。" });
      return;
    }

    const finalRoom = room.players[room.currentTurnIndex]?.isBot ? runBotEndTurn(room) : advanceTurn(room);
    emitRoomState(roomId, finalRoom);
    callback?.({ ok: true });
  });

  socket.on("game:close", ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "ゲーム終了はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = endGame(room, playerId);
    clearBotTimers(roomId);
    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("game:drawEvent", ({ roomId, playerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room || !room.started) {
      callback?.({ ok: false, message: "ゲームが開始されていません。" });
      return;
    }

    const currentPlayer = room.players[room.currentTurnIndex];
    const canDraw = currentPlayer?.id === playerId || room.facilitatorId === playerId;

    if (!canDraw) {
      callback?.({ ok: false, message: "現在の手番プレイヤーのみイベントを引けます。" });
      return;
    }

    const nextRoom = drawEventForCurrentPlayer(room, gameData);
    if (nextRoom === room) {
      callback?.({ ok: false, message: "いまはイベントを引けません。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("strength:give", ({ roomId, playerId, targetPlayerId, strengthCardId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "強みカードの配布はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = giveStrengthCard(room, gameData.strengthCards, Number(strengthCardId), playerId, String(targetPlayerId));
    if (nextRoom === room) {
      callback?.({ ok: false, message: "その強みカードは配布できませんでした。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("strength:drawRandom", ({ roomId, playerId, targetPlayerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "強みカードのランダム配布はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = giveRandomStrengthCard(room, gameData.strengthCards, playerId, String(targetPlayerId));
    if (nextRoom === room) {
      callback?.({ ok: false, message: "ランダムで配れる強みカードがありませんでした。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("strength:undo", ({ roomId, playerId, giftId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "強みカード配布の取り消しはファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = undoStrengthGift(room, String(giftId), String(playerId));
    if (nextRoom === room) {
      callback?.({ ok: false, message: "その強みカード配布は取り消せません。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("dev:action", ({ roomId, playerId, action, payload }, callback) => {
    if (process.env.NODE_ENV === "production") {
      callback?.({ ok: false, message: "DeveloperPanel は development 環境でのみ利用できます。" });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (room.facilitatorId !== playerId) {
      callback?.({ ok: false, message: "DeveloperPanel はファシリテーターのみ操作できます。" });
      return;
    }

    let nextRoom = room;

    switch (action) {
      case "add_bot":
        nextRoom = addBotsToRoom({ ...room, players: [...room.players] }, 1);
        break;
      case "remove_bot":
        nextRoom = removeBotFromRoom(room, payload?.targetPlayerId);
        break;
      case "set_turn":
        if (payload?.targetPlayerId) {
          nextRoom = setCurrentTurnPlayer(room, payload.targetPlayerId);
        }
        break;
      case "roll_fixed":
        if (typeof payload?.dice === "number") {
          const result = resolveTurn(room, gameData, Math.max(1, Math.min(6, Math.floor(payload.dice))));
          nextRoom = result.room;
          io.to(roomId).emit("game:rolled", { dice: payload.dice, playerId: room.players[room.currentTurnIndex]?.id });
        }
        break;
      case "move_player":
        if (payload?.targetPlayerId && typeof payload?.position === "number") {
          nextRoom = movePlayerToPosition(room, payload.targetPlayerId, payload.position);
        }
        break;
      case "show_resolution":
        if (payload?.resolution) {
          nextRoom = setActiveResolution(room, payload.resolution as TurnResolution);
          nextRoom = {
            ...nextRoom,
            logs: [createLog(`DeveloperPanel から ${payload.resolution.title} を表示しました`), ...nextRoom.logs],
          };
        }
        break;
      case "redeal_cards":
        nextRoom = redealCards(room);
        break;
      default:
        callback?.({ ok: false, message: "不明な developer action です。" });
        return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const participation = socketRoomMap.get(socket.id);
    if (!participation) {
      return;
    }

    const room = rooms.get(participation.roomId);
    if (!room) {
      socketRoomMap.delete(socket.id);
      return;
    }

    if (participation.role === "facilitator") {
      const nextRoom: RoomState = {
        ...room,
        facilitatorSocketId: null,
        logs: [createLog("ファシリテーターの接続が切れました。30秒以内なら再接続できます。"), ...room.logs],
      };
      emitRoomState(participation.roomId, nextRoom);
      scheduleReconnectExpiry(participation.actorId, () => {
        const latestRoom = rooms.get(participation.roomId);
        if (!latestRoom || latestRoom.facilitatorId !== participation.actorId || latestRoom.facilitatorSocketId) {
          return;
        }

        const expiredRoom: RoomState = {
          ...latestRoom,
          facilitatorId: null,
          facilitatorName: null,
          facilitatorSocketId: null,
          logs: [createLog("ファシリテーターが退出しました。"), ...latestRoom.logs],
        };

        if (expiredRoom.players.length === 0) {
          clearBotTimers(participation.roomId);
          rooms.delete(participation.roomId);
          return;
        }

        emitRoomState(participation.roomId, expiredRoom);
      });
      socketRoomMap.delete(socket.id);
      return;
    }

    const nextRoom: RoomState = {
      ...room,
      players: room.players.map((player) => (player.id === participation.actorId ? { ...player, socketId: undefined } : player)),
      logs: [createLog("プレイヤーの接続が切れました。30秒以内なら再接続できます。"), ...room.logs],
    };
    emitRoomState(participation.roomId, nextRoom);
    scheduleReconnectExpiry(participation.actorId, () => {
      const latestRoom = rooms.get(participation.roomId);
      if (!latestRoom) {
        return;
      }

      const targetPlayer = latestRoom.players.find((player) => player.id === participation.actorId);
      if (!targetPlayer || targetPlayer.socketId) {
        return;
      }

      const remainingPlayers = latestRoom.players.filter((player) => player.id !== participation.actorId);
      const nextTurnIndex = Math.min(latestRoom.currentTurnIndex, Math.max(remainingPlayers.length - 1, 0));
      const expiredRoom: RoomState = {
        ...latestRoom,
        players: remainingPlayers,
        currentTurnIndex: nextTurnIndex,
        logs: [createLog(`${targetPlayer.name} が退出しました。`), ...latestRoom.logs],
      };

      if (remainingPlayers.length === 0 && !expiredRoom.facilitatorId) {
        clearBotTimers(participation.roomId);
        rooms.delete(participation.roomId);
        return;
      }

      emitRoomState(participation.roomId, expiredRoom);
    });

    socketRoomMap.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Career Sugoroku server listening on http://localhost:${PORT}`);
});
