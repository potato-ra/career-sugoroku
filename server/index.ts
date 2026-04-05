import express from "express";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Server } from "socket.io";
import { BOT_NAMES, runBotEndTurn, runBotRoll } from "../lib/botEngine";
import {
  createFacilitatorAccountRecord,
  facilitatorAccountsPath,
  findFacilitatorAccountByAccessKey,
  findFacilitatorAccount,
  getFacilitatorRoomId,
  loadFacilitatorAccounts,
  markFacilitatorLastLogin,
  regenerateFacilitatorAccessKey,
  sanitizeFacilitatorAccount,
  saveFacilitatorAccounts,
  updateFacilitatorPassword,
  verifyPassword,
} from "./auth";
import {
  addPlayerToRoom,
  advanceTurn,
  assignFacilitator,
  canStartGame,
  createRoomState,
  createLog,
  drawTurnOrderLottery,
  drawEventForCurrentPlayer,
  endGame,
  giveRandomStrengthCard,
  giveStrengthCard,
  moveStrengthCard,
  movePlayerToPosition,
  resolveTurn,
  rollTurnOrderDice,
  setActiveResolution,
  setPlayOrder,
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
const facilitatorSessions = new Map<string, { loginId: string; displayName: string; role: "admin" | "facilitator"; mustChangePassword: boolean }>();
const socketRoomMap = new Map<string, { roomId: string; actorId: string; role: "facilitator" | "player" }>();
const botTimers = new Map<string, NodeJS.Timeout[]>();
const reconnectTimers = new Map<string, NodeJS.Timeout>();
const RECONNECT_GRACE_MS = 30_000;

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("cwd:", process.cwd());
console.log("distPath:", distPath);
console.log("indexPath:", indexPath);
console.log("indexExists:", fs.existsSync(indexPath));
console.log("facilitatorAccountsPath:", facilitatorAccountsPath());

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

const getBearerToken = (request: express.Request) => {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length);
};

const getSessionByToken = (token?: string | null) => {
  if (!token) {
    return null;
  }

  return facilitatorSessions.get(token) ?? null;
};

const createSessionPayload = (token: string) => {
  const session = facilitatorSessions.get(token);
  if (!session) {
    return null;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, session.loginId);
  return {
    user: {
      loginId: session.loginId,
      displayName: session.displayName,
      role: session.role,
      mustChangePassword: session.mustChangePassword,
      accessKeys: account?.accessKeys,
      fixedRooms: session.role === "facilitator" || session.role === "admin"
        ? {
            a: getFacilitatorRoomId(session.loginId, "a"),
            b: getFacilitatorRoomId(session.loginId, "b"),
          }
        : undefined,
    },
    accounts: session.role === "admin" ? accounts.map(sanitizeFacilitatorAccount) : undefined,
  };
};

const requireAdminSession = (token?: string | null) => {
  const session = getSessionByToken(token);
  if (!session || session.role !== "admin") {
    return null;
  }

  return session;
};

app.post("/api/auth/login", (request, response) => {
  const loginId = String(request.body?.loginId ?? "").trim().toLowerCase();
  const password = String(request.body?.password ?? "");
  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, loginId);

  if (!account) {
    response.status(401).json({ ok: false, message: "ログインIDまたはパスワードが正しくありません。" });
    return;
  }
  if (!account.isActive) {
    response.status(403).json({ ok: false, message: "このアカウントは停止中です。管理人が再開してください。" });
    return;
  }
  if (!verifyPassword(password, account.passwordHash)) {
    response.status(401).json({ ok: false, message: "ログインIDまたはパスワードが正しくありません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId ? markFacilitatorLastLogin(entry) : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);
  const signedInAccount = findFacilitatorAccount(updatedAccounts, loginId);
  if (!signedInAccount) {
    response.status(500).json({ ok: false, message: "ログイン情報の更新に失敗しました。" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  facilitatorSessions.set(token, {
    loginId: signedInAccount.loginId,
    displayName: signedInAccount.displayName,
    role: signedInAccount.role,
    mustChangePassword: signedInAccount.mustChangePassword,
  });

  response.json({ ok: true, token, ...createSessionPayload(token) });
});

app.post("/api/auth/key-login", (request, response) => {
  const accessKey = String(request.body?.accessKey ?? "").trim();
  const password = String(request.body?.password ?? "");
  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccountByAccessKey(accounts, accessKey);

  if (!account) {
    response.status(401).json({ ok: false, message: "URLキーまたはパスワードが正しくありません。" });
    return;
  }
  if (!account.isActive) {
    response.status(403).json({ ok: false, message: "このアカウントは停止中です。管理人が再開してください。" });
    return;
  }
  if (!verifyPassword(password, account.passwordHash)) {
    response.status(401).json({ ok: false, message: "URLキーまたはパスワードが正しくありません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId ? markFacilitatorLastLogin(entry) : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);
  const signedInAccount = findFacilitatorAccount(updatedAccounts, account.loginId);
  if (!signedInAccount) {
    response.status(500).json({ ok: false, message: "ログイン情報の更新に失敗しました。" });
    return;
  }

  const token = randomBytes(24).toString("hex");
  facilitatorSessions.set(token, {
    loginId: signedInAccount.loginId,
    displayName: signedInAccount.displayName,
    role: signedInAccount.role,
    mustChangePassword: signedInAccount.mustChangePassword,
  });

  response.json({ ok: true, token, ...createSessionPayload(token) });
});

app.get("/api/auth/me", (request, response) => {
  const token = getBearerToken(request);
  const payload = token ? createSessionPayload(token) : null;

  if (!payload) {
    response.status(401).json({ ok: false, message: "ログインが必要です。" });
    return;
  }

  response.json({ ok: true, ...payload });
});

app.post("/api/auth/logout", (request, response) => {
  const token = getBearerToken(request);
  if (token) {
    facilitatorSessions.delete(token);
  }
  response.json({ ok: true });
});

app.post("/api/auth/change-password", (request, response) => {
  const token = getBearerToken(request);
  const session = getSessionByToken(token);
  if (!session) {
    response.status(401).json({ ok: false, message: "ログインが必要です。" });
    return;
  }

  const currentPassword = String(request.body?.currentPassword ?? "");
  const nextPassword = String(request.body?.nextPassword ?? "");
  if (nextPassword.length < 8) {
    response.status(400).json({ ok: false, message: "新しいパスワードは8文字以上で入力してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, session.loginId);
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    response.status(400).json({ ok: false, message: "現在のパスワードが正しくありません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId ? updateFacilitatorPassword(entry, nextPassword, false) : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);
  facilitatorSessions.set(token!, {
    ...session,
    mustChangePassword: false,
  });

  response.json({ ok: true });
});

app.get("/api/facilitators", (request, response) => {
  const session = requireAdminSession(getBearerToken(request));
  if (!session) {
    response.status(403).json({ ok: false, message: "管理者のみ閲覧できます。" });
    return;
  }

  const accounts = loadFacilitatorAccounts().map(sanitizeFacilitatorAccount);
  response.json({ ok: true, accounts });
});

app.post("/api/facilitators", (request, response) => {
  const session = requireAdminSession(getBearerToken(request));
  if (!session) {
    response.status(403).json({ ok: false, message: "管理者のみ発行できます。" });
    return;
  }

  const loginId = String(request.body?.loginId ?? "").trim().toLowerCase();
  const displayName = String(request.body?.displayName ?? "").trim();
  const temporaryPassword = String(request.body?.temporaryPassword ?? "");

  if (!loginId || !displayName || temporaryPassword.length < 8) {
    response.status(400).json({ ok: false, message: "ログインID・表示名・8文字以上の仮パスワードを入力してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  if (findFacilitatorAccount(accounts, loginId)) {
    response.status(409).json({ ok: false, message: "そのログインIDはすでに使用中です。" });
    return;
  }

  accounts.push(createFacilitatorAccountRecord(loginId, displayName, temporaryPassword));
  saveFacilitatorAccounts(accounts);
  response.json({ ok: true });
});

app.post("/api/facilitators/:loginId/reset-password", (request, response) => {
  const session = requireAdminSession(getBearerToken(request));
  if (!session) {
    response.status(403).json({ ok: false, message: "管理者のみ再発行できます。" });
    return;
  }

  const loginId = String(request.params.loginId ?? "").trim().toLowerCase();
  const temporaryPassword = String(request.body?.temporaryPassword ?? "");
  if (!loginId || temporaryPassword.length < 8) {
    response.status(400).json({ ok: false, message: "8文字以上の仮パスワードを入力してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, loginId);
  if (!account) {
    response.status(404).json({ ok: false, message: "対象アカウントが見つかりません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId
      ? {
          ...updateFacilitatorPassword(entry, temporaryPassword, true),
          isActive: true,
        }
      : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);
  response.json({ ok: true });
});

app.post("/api/facilitators/:loginId/regenerate-link", (request, response) => {
  const session = requireAdminSession(getBearerToken(request));
  if (!session) {
    response.status(403).json({ ok: false, message: "管理者のみURLを再発行できます。" });
    return;
  }

  const loginId = String(request.params.loginId ?? "").trim().toLowerCase();
  const slot = request.body?.slot === "backup" ? "backup" : request.body?.slot === "primary" ? "primary" : null;
  if (!loginId || !slot) {
    response.status(400).json({ ok: false, message: "対象アカウントとURL種別を指定してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, loginId);
  if (!account) {
    response.status(404).json({ ok: false, message: "対象アカウントが見つかりません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId ? regenerateFacilitatorAccessKey(entry, slot) : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);
  response.json({ ok: true });
});

app.post("/api/facilitators/:loginId/set-active", (request, response) => {
  const session = requireAdminSession(getBearerToken(request));
  if (!session) {
    response.status(403).json({ ok: false, message: "管理者のみ状態変更できます。" });
    return;
  }

  const loginId = String(request.params.loginId ?? "").trim().toLowerCase();
  const isActive = request.body?.isActive;
  if (!loginId || typeof isActive !== "boolean") {
    response.status(400).json({ ok: false, message: "対象アカウントと有効状態を指定してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccount(accounts, loginId);
  if (!account) {
    response.status(404).json({ ok: false, message: "対象アカウントが見つかりません。" });
    return;
  }

  const updatedAccounts = accounts.map((entry) =>
    entry.loginId === account.loginId
      ? {
          ...entry,
          isActive,
          updatedAt: new Date().toISOString(),
        }
      : entry,
  );
  saveFacilitatorAccounts(updatedAccounts);

  response.json({ ok: true });
});

app.get("/api/facilitator-links/:accessKey", (request, response) => {
  const accessKey = String(request.params.accessKey ?? "").trim();
  if (!accessKey) {
    response.status(400).json({ ok: false, message: "URLキーを指定してください。" });
    return;
  }

  const accounts = loadFacilitatorAccounts();
  const account = findFacilitatorAccountByAccessKey(accounts, accessKey);
  if (!account || !account.isActive) {
    response.status(404).json({ ok: false, message: "URLキーが見つかりません。" });
    return;
  }

  response.json({
    ok: true,
    facilitator: {
      loginId: account.loginId,
      displayName: account.displayName,
      rooms: {
        a: getFacilitatorRoomId(account.loginId, "a"),
        b: getFacilitatorRoomId(account.loginId, "b"),
      },
    },
  });
});

app.use((error: unknown, request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (!request.path.startsWith("/api/")) {
    next(error);
    return;
  }

  console.error("[api-error]", request.method, request.path, error);
  response.status(500).json({ ok: false, message: "サーバーエラーが発生しました。" });
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

const isAuthorizedFacilitator = (room: RoomState, playerId: string, authToken?: string | null) => {
  const session = getSessionByToken(authToken);
  return Boolean(session && room.facilitatorId === playerId);
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

const ensureDemoLocalPlayer = (room: RoomState, socketId: string, avatarUrl?: string | null) => {
  const existingHumanPlayer = room.players.find((player) => !player.isBot);
  if (existingHumanPlayer) {
    return room;
  }

  addPlayerToRoom(room, "Demo_Player", socketId, false, avatarUrl);
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
  socket.on("room:create", ({ roomId, name, isFacilitator, isDemoMode, botCount, avatarUrl, authToken }, callback) => {
    const trimmedRoomId = (roomId || "").trim().toUpperCase();
    const session = getSessionByToken(authToken);
    const trimmedName = session?.displayName ?? (name || "").trim();

    if (!session || !isFacilitator) {
      callback?.({ ok: false, message: "ファシリログインが必要です。" });
      return;
    }

    if (!trimmedRoomId || !trimmedName) {
      callback?.({ ok: false, message: "ルームIDを入力してください。" });
      return;
    }

    if (rooms.has(trimmedRoomId)) {
      callback?.({ ok: false, message: "そのルームIDは使用中です。" });
      return;
    }

    const latestBoard = loadLatestBoardSnapshot();

    let room = createRoomState(trimmedRoomId, cloneBoard(latestBoard.board), latestBoard.boardVersion, Boolean(isDemoMode));
    room.facilitatorLoginId = session.loginId;
    const facilitatorId = assignFacilitator(room, trimmedName, socket.id);
    if (room.isDemoMode) {
      room = ensureDemoLocalPlayer(room, socket.id, avatarUrl);
      room = addBotsToRoom(room, Math.max(2, Math.min(Number(botCount ?? 2), 4)));
      room.logs.unshift(createLog(`デモモードで開始準備中です。Bot を ${room.players.filter((entry) => entry.isBot).length} 人追加しました`));
    }
    console.log("[board-debug][server] room:create", {
      roomId: trimmedRoomId,
      boardVersion: room.boardVersion,
      spaces31to39: room.board.filter((space) => space.id >= 31 && space.id <= 39).map((space) => ({ id: space.id, type: space.type })),
    });
    rooms.set(trimmedRoomId, room);
    socketRoomMap.set(socket.id, { roomId: trimmedRoomId, actorId: facilitatorId, role: "facilitator" });
    socket.join(trimmedRoomId);
    emitRoomState(trimmedRoomId, room);
    callback?.({ ok: true, room, playerId: facilitatorId });
  });

  socket.on("room:openFacilitatorRoom", ({ slot, authToken }, callback) => {
    const session = getSessionByToken(authToken);
    const normalizedSlot: "a" | "b" | null = slot === "b" ? "b" : slot === "a" ? "a" : null;
    if (!session || !normalizedSlot) {
      callback?.({ ok: false, message: "ファシリログインとルーム種別が必要です。" });
      return;
    }

    const roomId = getFacilitatorRoomId(session.loginId, normalizedSlot);
    const existingRoom = rooms.get(roomId);
    if (existingRoom) {
      if (existingRoom.facilitatorLoginId && existingRoom.facilitatorLoginId !== session.loginId) {
        callback?.({ ok: false, message: "この固定ルームは別のファシリが利用中です。" });
        return;
      }

      clearReconnectTimer(existingRoom.facilitatorId ?? "");
      const nextRoom = {
        ...existingRoom,
        roomSlot: normalizedSlot,
        started: false,
        endedAt: null,
        endedByName: null,
        activeResolution: null,
        winnerId: null,
        currentTurnIndex: 0,
        turnOrderRolls: [],
        players: existingRoom.players.map((player) => ({ ...player, position: 0 })),
        facilitatorLoginId: session.loginId,
        facilitatorSocketId: socket.id,
        logs: [createLog("ファシリテーターが固定ルームへ戻りました。"), ...existingRoom.logs],
      };
      rooms.set(roomId, nextRoom);
      socketRoomMap.set(socket.id, { roomId, actorId: nextRoom.facilitatorId ?? "", role: "facilitator" });
      socket.join(roomId);
      emitRoomState(roomId, nextRoom);
      callback?.({ ok: true, room: nextRoom, playerId: nextRoom.facilitatorId });
      return;
    }

    const latestBoard = loadLatestBoardSnapshot();
    let room = createRoomState(roomId, cloneBoard(latestBoard.board), latestBoard.boardVersion, false);
    room.roomSlot = normalizedSlot;
    room.facilitatorLoginId = session.loginId;
    const facilitatorId = assignFacilitator(room, session.displayName, socket.id);
    rooms.set(roomId, room);
    socketRoomMap.set(socket.id, { roomId, actorId: facilitatorId, role: "facilitator" });
    socket.join(roomId);
    emitRoomState(roomId, room);
    callback?.({ ok: true, room, playerId: facilitatorId });
  });

  socket.on("room:restore", ({ roomId, actorId, role, authToken }, callback) => {
    const trimmedRoomId = (roomId || "").trim().toUpperCase();
    const room = rooms.get(trimmedRoomId);

    if (!room || !actorId || !role) {
      callback?.({ ok: false, message: "復元対象のルームが見つかりません。" });
      return;
    }

    if (role === "facilitator") {
      if (!getSessionByToken(authToken)) {
        callback?.({ ok: false, message: "ファシリログインが必要です。" });
        return;
      }

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

  socket.on("room:join", ({ roomId, name, avatarUrl }, callback) => {
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

    const player = addPlayerToRoom(room, trimmedName, socket.id, false, avatarUrl);
    socketRoomMap.set(socket.id, { roomId: trimmedRoomId, actorId: player.id, role: "player" });
    socket.join(trimmedRoomId);
    emitRoomState(trimmedRoomId, room);
    callback?.({ ok: true, room, playerId: player.id });
  });

  socket.on("game:start", ({ roomId, playerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
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

  socket.on("game:endTurn", ({ roomId, playerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room || !room.started) {
      callback?.({ ok: false, message: "ゲームが開始されていません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "ターン終了はファシリテーターのみ操作できます。" });
      return;
    }

    const finalRoom = room.players[room.currentTurnIndex]?.isBot ? runBotEndTurn(room) : advanceTurn(room);
    emitRoomState(roomId, finalRoom);
    callback?.({ ok: true });
  });

  socket.on("game:close", ({ roomId, playerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "ゲーム終了はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = endGame(room, playerId);
    clearBotTimers(roomId);
    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("room:forceClose", ({ roomId, playerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "ルーム強制終了はファシリテーターのみ操作できます。" });
      return;
    }

    clearBotTimers(roomId);
    io.to(roomId).emit("room:forceClosed", { roomId });
    io.in(roomId).socketsLeave(roomId);
    rooms.delete(roomId);

    for (const [socketId, mapping] of socketRoomMap.entries()) {
      if (mapping.roomId === roomId) {
        socketRoomMap.delete(socketId);
        clearReconnectTimer(mapping.actorId);
      }
    }

    callback?.({ ok: true });
  });

  socket.on("game:setOrder", ({ roomId, playerId, orderedPlayerIds, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "順番変更はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = setPlayOrder(room, Array.isArray(orderedPlayerIds) ? orderedPlayerIds : []);
    if (nextRoom === room) {
      callback?.({ ok: false, message: "順番を更新できませんでした。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("game:rollOrderDice", ({ roomId, playerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "順番決めサイコロはファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = rollTurnOrderDice(room);
    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("game:drawOrderLottery", ({ roomId, playerId, targetPlayerId }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    const canDrawAsDemoFacilitator =
      room.isDemoMode &&
      room.facilitatorId === playerId &&
      targetPlayerId &&
      room.players.some((player) => player.id === targetPlayerId && !player.isBot);

    const actorIsTargetPlayer = room.players.some((player) => player.id === playerId && !player.isBot);
    if (!actorIsTargetPlayer && !canDrawAsDemoFacilitator) {
      callback?.({ ok: false, message: "順番くじはプレイヤーが引いてください。" });
      return;
    }

    const nextRoom = drawTurnOrderLottery(room, playerId, canDrawAsDemoFacilitator ? String(targetPlayerId) : undefined);
    if (nextRoom === room) {
      callback?.({ ok: false, message: "このプレイヤーはすでに順番くじを引いています。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("game:movePlayer", ({ roomId, playerId, targetPlayerId, position, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "プレイヤー移動はファシリテーターのみ操作できます。" });
      return;
    }

    if (!targetPlayerId || typeof position !== "number") {
      callback?.({ ok: false, message: "移動対象と移動先を指定してください。" });
      return;
    }

    const nextRoom = movePlayerToPosition(room, String(targetPlayerId), Number(position));
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

  socket.on("strength:give", ({ roomId, playerId, targetPlayerId, strengthCardId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
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

  socket.on("strength:drawRandom", ({ roomId, playerId, targetPlayerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
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

  socket.on("strength:move", ({ roomId, playerId, strengthCardId, fromPlayerId, toPlayerId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
      callback?.({ ok: false, message: "強みカードの移動はファシリテーターのみ操作できます。" });
      return;
    }

    const nextRoom = moveStrengthCard(
      room,
      gameData.strengthCards,
      Number(strengthCardId),
      String(playerId),
      fromPlayerId ? String(fromPlayerId) : null,
      toPlayerId ? String(toPlayerId) : null,
    );

    if (nextRoom === room) {
      callback?.({ ok: false, message: "強みカードを移動できませんでした。" });
      return;
    }

    emitRoomState(roomId, nextRoom);
    callback?.({ ok: true });
  });

  socket.on("strength:undo", ({ roomId, playerId, giftId, authToken }, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
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

  socket.on("dev:action", ({ roomId, playerId, authToken, action, payload }, callback) => {
    if (process.env.NODE_ENV === "production") {
      callback?.({ ok: false, message: "DeveloperPanel は development 環境でのみ利用できます。" });
      return;
    }

    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ ok: false, message: "ルームが見つかりません。" });
      return;
    }

    if (!isAuthorizedFacilitator(room, playerId, authToken)) {
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
      turnOrderRolls: room.started ? room.turnOrderRolls : [],
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
