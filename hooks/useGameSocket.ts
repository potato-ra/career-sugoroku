import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { RoomState } from "../lib/types";

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
  isDemoMode?: boolean;
  botCount?: number;
}

interface ActionResult {
  ok: boolean;
  message?: string;
  playerId?: string;
  dice?: number;
  room?: RoomState;
}

export const useGameSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [lastDice, setLastDice] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const socket = io(getServerUrl(), { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("room:state", (nextRoom: RoomState) => {
      setRoom(nextRoom);
    });

    socket.on("game:rolled", ({ dice }: { dice: number }) => {
      setLastDice(dice);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emitWithAck = <T extends ActionResult, P extends object = Record<string, unknown>>(eventName: string, payload: P) =>
    new Promise<T>((resolve) => {
      socketRef.current?.emit(eventName, payload, (response: T) => {
        resolve(response);
      });
    });

  const createRoom = async (payload: JoinPayload) => {
    const response = await emitWithAck<ActionResult, JoinPayload>("room:create", payload);
    if (response.ok && response.playerId) {
      setPlayerId(response.playerId);
      setErrorMessage("");
    } else {
      setErrorMessage(response.message ?? "ルーム作成に失敗しました。");
    }
    return response;
  };

  const joinRoom = async (payload: JoinPayload) => {
    const response = await emitWithAck<ActionResult, JoinPayload>("room:join", payload);
    if (response.ok && response.playerId) {
      setPlayerId(response.playerId);
      setErrorMessage("");
    } else {
      setErrorMessage(response.message ?? "ルーム参加に失敗しました。");
    }
    return response;
  };

  const startGame = async () => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("game:start", { roomId: room.roomId, playerId });
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

    const response = await emitWithAck<ActionResult>("game:endTurn", { roomId: room.roomId, playerId });
    if (!response.ok) {
      setErrorMessage(response.message ?? "ターン終了に失敗しました。");
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
      giftId,
    });
    if (!response.ok) {
      setErrorMessage(response.message ?? "強みカードの取り消しに失敗しました。");
    }
  };

  const runDeveloperAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!room || !playerId) {
      return;
    }

    const response = await emitWithAck<ActionResult>("dev:action", { roomId: room.roomId, playerId, action, payload });
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
    startGame,
    rollDice,
    endTurn,
    drawEvent,
    giveStrengthCard,
    giveRandomStrengthCard,
    undoStrengthGift,
    runDeveloperAction,
  };
};
