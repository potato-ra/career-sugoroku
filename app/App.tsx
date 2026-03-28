import { useEffect, useState } from "react";
import { BoardDebugPanel } from "../components/BoardDebugPanel";
import { DeveloperPanel } from "../components/DeveloperPanel";
import { EventModal } from "../components/EventModal";
import { FacilitatorControlPanel } from "../components/FacilitatorControlPanel";
import { GameBoard } from "../components/GameBoard";
import { HelpPanel } from "../components/HelpPanel";
import { Lobby } from "../components/Lobby";
import { PlayerPanel } from "../components/PlayerPanel";
import { RoleSwitcher } from "../components/RoleSwitcher";
import { StrengthCardPanel } from "../components/StrengthCardPanel";
import { useGameSocket } from "../hooks/useGameSocket";

export const App = () => {
  const {
    room,
    playerId,
    lastDice,
    errorMessage,
    createRoom,
    joinRoom,
    startGame,
    rollDice,
    endTurn,
    closeGame,
    setPlayerOrder,
    rollTurnOrderDice,
    movePlayer,
    drawEvent,
    giveStrengthCard,
    giveRandomStrengthCard,
    undoStrengthGift,
    runDeveloperAction,
  } = useGameSocket();
  const [viewMode, setViewMode] = useState<"facilitator" | "player">("facilitator");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [helpMode, setHelpMode] = useState<"rules" | "strengths" | null>(null);

  useEffect(() => {
    if (!room) {
      return;
    }

    if (!selectedPlayerId || !room.players.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(playerId || room.players[0]?.id || "");
    }
  }, [playerId, room, selectedPlayerId]);

  useEffect(() => {
    if (!room) {
      return;
    }

    console.log("[board-debug][client]", {
      roomId: room.roomId,
      boardVersion: room.boardVersion,
      spaces31to39: room.board.slice(30, 39).map((space) => ({ id: space.id, type: space.type })),
    });
  }, [room]);

  const isFacilitator = room?.facilitatorId === playerId;

  useEffect(() => {
    if (!room || room.isDemoMode) {
      return;
    }

    setViewMode(isFacilitator ? "facilitator" : "player");
  }, [isFacilitator, room]);

  if (!room || !playerId) {
    return <Lobby onCreateRoom={createRoom} onJoinRoom={joinRoom} errorMessage={errorMessage} />;
  }

  const currentPlayer = room.players.find((player) => player.id === playerId);
  const currentTurnPlayer = room.players[room.currentTurnIndex];

  const canStart = room.isDemoMode
    ? room.players.length >= 1 && room.players.length <= 5 && !room.started
    : room.players.length >= 3 && room.players.length <= 5 && !room.started;
  const winnerName = room.players.find((player) => player.id === room.winnerId)?.name;
  const viewedPlayer = room.players.find((player) => player.id === selectedPlayerId) ?? currentPlayer ?? room.players[0];
  const visibleLogs = viewMode === "facilitator" ? room.logs.slice(0, 12) : room.logs.slice(0, 4);
  const canRoll = Boolean(
    currentTurnPlayer &&
      !currentTurnPlayer.isBot &&
      (currentTurnPlayer.id === playerId || (room.isDemoMode && isFacilitator)),
  );
  const canDrawEvent = Boolean(
    room.activeResolution?.actionRequired === "draw_event" && (currentTurnPlayer?.id === playerId || isFacilitator),
  );

  const boardCurrentUserId = viewMode === "player" ? viewedPlayer?.id ?? playerId : playerId;
  const showFacilitatorControls = viewMode === "facilitator" && isFacilitator;

  if (room.endedAt) {
    return (
      <main className="app-shell">
        <section className="panel waiting-panel">
          <p className="eyebrow">ルームID: {room.roomId}</p>
          <h1>お疲れさまでした</h1>
          <p>ルームを閉じました。ご参加ありがとうございました。</p>
          <p>{room.endedByName ? `${room.endedByName} がゲームを終了しました。` : "ゲームを終了しました。"}</p>
          <div className="inline-actions">
            <button type="button" className="secondary" onClick={() => setHelpMode("rules")}>
              ルール
            </button>
            <button type="button" className="secondary" onClick={() => setHelpMode("strengths")}>
              強みカード一覧
            </button>
          </div>
        </section>
        <HelpPanel mode={helpMode} onClose={() => setHelpMode(null)} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ルームID: {room.roomId}</p>
          <h1>キャリアすごろく</h1>
          <p>
            プレイヤー {room.players.length}人 / あなた: {isFacilitator ? `${room.facilitatorName ?? "ファシリテーター"}（ファシリ）` : currentPlayer?.name ?? "未参加"}
          </p>
          <p className="mode-caption">
            {viewMode === "facilitator"
              ? "進行とカード配布はファシリテーターが管理します。"
              : "プレイヤーはサイコロを振り、対話と自己理解に集中します。"}
          </p>
          <div className="status-row">
            <span className={`mode-badge ${room.isDemoMode ? "demo" : "normal"}`}>{room.isDemoMode ? "デモモード" : "通常モード"}</span>
            <span className="mode-badge perspective">{viewMode === "facilitator" ? "ファシリ視点" : `${viewedPlayer?.name ?? "プレイヤー"}視点`}</span>
          </div>
        </div>
        <div className="topbar-actions">
          {room.isDemoMode ? (
            <RoleSwitcher
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              selectedPlayerId={viewedPlayer?.id ?? ""}
              onChangePlayerId={setSelectedPlayerId}
              players={room.players}
            />
          ) : null}
          <div className="inline-actions">
            <button type="button" className="secondary" onClick={() => setHelpMode("rules")}>
              ルール
            </button>
            <button type="button" className="secondary" onClick={() => setHelpMode("strengths")}>
              強みカード一覧
            </button>
          </div>
          <div className="facilitator-badge">{isFacilitator ? "ファシリ操作権あり" : "プレイヤーはサイコロのみ操作"}</div>
          <button onClick={() => void startGame()} disabled={!canStart || !isFacilitator}>
            ゲーム開始
          </button>
          {isFacilitator ? (
            <button className="secondary" onClick={() => void closeGame()}>
              ゲーム終了
            </button>
          ) : null}
        </div>
      </header>

      <div className="utility-grid">
        {import.meta.env.DEV && isFacilitator ? (
          <DeveloperPanel
            room={room}
            onAddBot={() => void runDeveloperAction("add_bot")}
            onRemoveBot={(targetPlayerId) => void runDeveloperAction("remove_bot", { targetPlayerId })}
            onSetTurn={(targetPlayerId) => void runDeveloperAction("set_turn", { targetPlayerId })}
            onRollFixedDice={(dice) => void runDeveloperAction("roll_fixed", { dice })}
            onMovePlayer={(targetPlayerId, position) => void runDeveloperAction("move_player", { targetPlayerId, position })}
            onShowResolution={(resolution) => void runDeveloperAction("show_resolution", { resolution })}
            onRedealCards={() => void runDeveloperAction("redeal_cards")}
          />
        ) : null}
        {import.meta.env.DEV ? <BoardDebugPanel roomId={room.roomId} boardVersion={room.boardVersion} board={room.board} /> : null}
      </div>

      {!room.started ? (
        <section className="panel waiting-panel">
          <h2>Lobby</h2>
          <p>
            {room.isDemoMode
              ? "デモモードでは1人でもゲーム開始可能です。Bot が自動でターン進行を補助します。"
              : "3〜5人そろったら、ファシリテーターがゲーム開始を押してください。"}
          </p>
          <p>{room.facilitatorName ? `ファシリテーター: ${room.facilitatorName}` : "ファシリテーター未接続"}</p>
          <ul className="waiting-list">
            {room.players.map((player) => (
              <li key={player.id}>
                {player.name}
                {player.isBot ? "（Bot）" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={`content-grid ${viewMode === "player" ? "player-content-grid" : ""}`}>
        <GameBoard
          board={room.board}
          players={room.players}
          currentTurnPlayerId={currentTurnPlayer?.id}
          currentUserId={boardCurrentUserId}
          lastDice={lastDice}
          started={room.started}
          winnerName={winnerName}
          hasActiveResolution={Boolean(room.activeResolution)}
          canRoll={canRoll}
          onRollDice={() => void rollDice()}
          onEndTurn={() => void endTurn()}
          isFacilitator={viewMode === "facilitator" && isFacilitator}
        />
        <div className={`side-column ${viewMode === "player" ? "player-side-column" : ""}`}>
          <EventModal resolution={room.activeResolution} canDrawEvent={canDrawEvent} onDrawEvent={() => void drawEvent()} />
          <section className={`panel logs-panel ${viewMode === "player" ? "compact-logs-panel" : ""}`}>
            <div className="section-header">
              <h2>{viewMode === "facilitator" ? "進行ログ" : "プレイヤーメモ"}</h2>
              <p>{currentTurnPlayer ? `${currentTurnPlayer.name} の手番` : "待機中"}</p>
            </div>
            <div className="log-list">
              {visibleLogs.map((log) => (
                <p key={log.id}>{log.message}</p>
              ))}
            </div>
            {viewMode === "player" ? (
              <p className="player-focus-note">カードの配布やターン終了はファシリテーターが行います。自分の番ではサイコロを振って会話に集中しましょう。</p>
            ) : null}
          </section>
        </div>
      </div>

      <PlayerPanel
        players={room.players}
        currentTurnPlayerId={currentTurnPlayer?.id}
        focusedPlayerId={viewMode === "player" ? viewedPlayer?.id : undefined}
        title={viewMode === "facilitator" ? "PlayerPanel" : "プレイヤー視点パネル"}
      />

      {showFacilitatorControls ? (
        <FacilitatorControlPanel
          room={room}
          onSetPlayerOrder={(orderedPlayerIds) => void setPlayerOrder(orderedPlayerIds)}
          onRollTurnOrderDice={() => void rollTurnOrderDice()}
          onMovePlayer={(targetPlayerId, position) => void movePlayer(targetPlayerId, position)}
        />
      ) : null}

      {showFacilitatorControls ? (
        <StrengthCardPanel
          players={room.players}
          currentPlayerId={playerId}
          facilitatorId={room.facilitatorId}
          facilitatorName={room.facilitatorName}
          strengthGiftHistory={room.strengthGiftHistory}
          title="強みカード配布"
          onGiveStrengthCard={(targetPlayerId, strengthCardId) => void giveStrengthCard(targetPlayerId, strengthCardId)}
          onGiveRandomStrengthCard={(targetPlayerId) => void giveRandomStrengthCard(targetPlayerId)}
          onUndoStrengthGift={(giftId) => void undoStrengthGift(giftId)}
        />
      ) : null}

      <HelpPanel mode={helpMode} onClose={() => setHelpMode(null)} />

      {errorMessage ? <p className="error-text bottom-error">{errorMessage}</p> : null}
    </main>
  );
};
