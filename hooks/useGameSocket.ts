import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RoomState } from "../lib/types";

const SESSION_STORAGE_KEY = "career-sugoroku-session";

const getServerUrl = () => {
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  return window.location.origin;
};

export interface JoinPayload {
  roomId: string;
  name: string;
  isFacilitator: boolean;
  authToken?: string;
  avatarUrl?: string;
  isDemoMode?: boolean;
  botCount?: number;
}

interface StoredSession {
  roomId: string;
  actorId: string;
  role: "facilitator" | "player";
  name: string;
}

interface ActionResult {
  ok: boolean;
  message?: string;
  playerId?: string;
  dice?: number;
  room?: RoomState;
}

export const useGameSocket = (authToken?: string | null) => {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [lastDice, setLastDice] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const persistSession = (session: StoredSession) => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  };

  const clearSession = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  useEffect(() => {
    const socket = io(getServerUrl(), { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("room:state", (nextRoom: RoomState) => {
      setRoom(nextRoom);
    });

    socket.on("room:forceClosed", () => {
      clearSession();
      setRoom(null);
      setPlayerId("");
      setLastDice(null);
      setErrorMessage("ルームが強制終了されました。");
    });

    socket.on("game:rolled", ({ dice }: { dice: number }) => {
      setLastDice(dice);
    });

    socket.on("connect", () => {
      const rawSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (!rawSession) {
        return;
      }

      try {
        const session = JSON.parse(rawSession) as StoredSession;
        socket.emit(
          "room:restore",
          {
            roomId: session.roomId,
            actorId: session.actorId,
            role: session.role,
            authToken: session.role === "facilitator" ? authToken ?? undefined : undefined,
          },
          (response: ActionResult) => {
            if (response.ok && response.playerId) {
              setPlayerId(response.playerId);
              setRoom(response.room ?? null);
              setErrorMessage("");
              return;
            }

            clearSession();
            setRoom(null);
            setPlayerId("");
          },
        );
      } catch {
        clearSession();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [authToken]);

  const emitWithAck = <T extends ActionResult, P extends object = Record<string, unknown>>(eventName: string, payload: P) =>
    new Promise<T>((resolve) => {
      socketRef.current?.emit(eventName, payload, (response: T) => {
        resolve(response);
      });
    });

  const createRoom = async (payload: JoinPayload) => {
    const response = await emitWithAck<ActionResult, JoinPayload>("room:create", payload);
    if (response.ok && response.playerId && response.room) {
      setPlayerId(response.playerId);
      setErrorMessage("");
      setRoom(response.room);
      persistSession({
        roomId: response.room.roomId,
        actorId: response.playerId,
        role: payload.isFacilitator ? "facilitator" : "player",
        name: payload.name,
      });
    } else {
      setErrorMessage(response.message ?? "ルーム作成に失敗しました。");
    }
    return response;
  };

  const joinRoom = async (payload: JoinPayload) => {
    const response = await emitWithAck<ActionResult, JoinPayload>("room:join", payload);
    if (response.ok && response.playerId && response.room) {
      setPlayerId(response.playerId);
      setErrorMessage("");
      setRoom(response.room);
      persistSession({
        roomId: response.room.roomId,
        actorId: response.playerId,
        role: payload.isFacilitator ? "facilitator" : "player",
        name: payload.name,
      });
    } else {
      setErrorMessage(response.message ?? "ルーム参加に失敗しました。");
    }
    return response;
  };

  const openFacilitatorRoom = async (slot: "a" | "b") => {
    const response = await emitWithAck<ActionResult>("room:openFacilitatorRoom", { slot, authToken });
    if (response.ok && response.playerId && response.room) {
      setPlayerId(response.playerId);
      setErrorMessage("");
      setRoom(response.room);
      persistSession({
        roomId: response.room.roomId,
        actorId: response.playerId,
        role: "facilitator",
        name: response.room.facilitatorName ?? "",
      });
    } else {
      setErrorMessage(response.message ?? "固定ルームへの入室に失敗しました。");
    }
    return response;
  };

  const startGame = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:start", { roomId: room.roomId, playerId, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ゲーム開始に失敗しました。");
    }
  };

  const rollDice = async (dice?: number) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:roll", { roomId: room.roomId, playerId, dice });
    if (!response.ok) {
      setErrorMessage(response.message ?? "サイコロに失敗しました。");
    } else if (response.dice) {
      setLastDice(response.dice);
    }
  };

  const endTurn = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:endTurn", { roomId: room.roomId, playerId, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ターン終了に失敗しました。");
    }
  };

  const closeGame = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:close", { roomId: room.roomId, playerId, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ゲーム終了に失敗しました。");
    }
  };

  const forceCloseRoom = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("room:forceClose", { roomId: room.roomId, playerId, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ルーム強制終了に失敗しました。");
    }
  };

  const setPlayerOrder = async (orderedPlayerIds: string[]) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:setOrder", { roomId: room.roomId, playerId, orderedPlayerIds, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "順番変更に失敗しました。");
    }
  };

  const rollTurnOrderDice = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:rollOrderDice", { roomId: room.roomId, playerId, authToken });
    if (!response.ok) {
      setErrorMessage(response.message ?? "順番決めサイコロに失敗しました。");
    }
  };

  const movePlayer = async (targetPlayerId: string, position: number) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:movePlayer", {
      roomId: room.roomId,
      playerId,
      authToken,
      targetPlayerId,
      position,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "プレイヤー移動に失敗しました。");
    }
  };

  const drawOrderLottery = async (targetPlayerId?: string) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:drawOrderLottery", {
      roomId: room.roomId,
      playerId,
      authToken,
      targetPlayerId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "順番くじに失敗しました。");
    }
  };

  const drawEvent = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:drawEvent", { roomId: room.roomId, playerId });
    if (!response.ok) {
      setErrorMessage(response.message ?? "イベントカードの表示に失敗しました。");
    }
  };

  const giveStrengthCard = async (targetPlayerId: string, strengthCardId: number) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("strength:give", {
      roomId: room.roomId,
      playerId,
      authToken,
      targetPlayerId,
      strengthCardId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "強みカードの配布に失敗しました。");
    }
  };

  const giveRandomStrengthCard = async (targetPlayerId: string) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("strength:drawRandom", {
      roomId: room.roomId,
      playerId,
      authToken,
      targetPlayerId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ランダム強みカードの配布に失敗しました。");
    }
  };

  const undoStrengthGift = async (giftId: string) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("strength:undo", {
      roomId: room.roomId,
      playerId,
      authToken,
      giftId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "強みカードの取り消しに失敗しました。");
    }
  };

  const moveStrengthCard = async (strengthCardId: number, fromPlayerId?: string | null, toPlayerId?: string | null) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("strength:move", {
      roomId: room.roomId,
      playerId,
      authToken,
      strengthCardId,
      fromPlayerId,
      toPlayerId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "強みカードの移動に失敗しました。");
    }
  };

  const runDeveloperAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("dev:action", { roomId: room.roomId, playerId, authToken, action, payload });
    if (!response.ok) {
      setErrorMessage(response.message ?? "DeveloperPanel の操作に失敗しました。");
    }
  };

  return {
    room,
    playerId,
    lastDice,
    errorMessage,
    createRoom,
    joinRoom,
    openFacilitatorRoom,
    startGame,
    rollDice,
    endTurn,
    closeGame,
    forceCloseRoom,
    setPlayerOrder,
    rollTurnOrderDice,
    movePlayer,
    drawOrderLottery,
    drawEvent,
    giveStrengthCard,
    giveRandomStrengthCard,
    undoStrengthGift,
    moveStrengthCard,
    runDeveloperAction,
  };
};
