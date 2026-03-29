import type { BoardSpace, Player } from "../lib/types";

interface GameBoardProps {
  board: BoardSpace[];
  players: Player[];
  currentTurnPlayerId?: string;
  currentUserId: string;
  lastDice: number | null;
  started: boolean;
  winnerName?: string;
  hasActiveResolution: boolean;
  canRoll: boolean;
  onRollDice: () => void;
  onEndTurn: () => void;
  isFacilitator: boolean;
}

export const GameBoard = ({
  board,
  players,
  currentTurnPlayerId,
  currentUserId,
  lastDice,
  started,
  winnerName,
  hasActiveResolution,
  canRoll,
  onRollDice,
  onEndTurn,
  isFacilitator,
}: GameBoardProps) => {
  const currentTurnPlayer = players.find((player) => player.id === currentTurnPlayerId);
  const isCurrentUserTurn = currentTurnPlayerId === currentUserId;
  const boardRows = Array.from({ length: Math.ceil(board.length / 10) }, (_value, rowIndex) => {
    const rowSpaces = board.slice(rowIndex * 10, rowIndex * 10 + 10);
    return rowIndex % 2 === 0 ? rowSpaces : [...rowSpaces].reverse();
  });
  const displayedBoard = boardRows.flat();

  return (
    <section className="board-panel panel">
      <div className="board-header">
        <div>
          <h2>GameBoard</h2>
          <p>現在のターン: {currentTurnPlayer?.name ?? "待機中"}</p>
        </div>
        <div className="turn-actions">
          <div className="dice-card">直近の出目: {lastDice ?? "-"}</div>
          <button onClick={onRollDice} disabled={!started || !isCurrentUserTurn || hasActiveResolution || !canRoll}>
            サイコロを振る
          </button>
          {isFacilitator ? (
            <button className="secondary" onClick={onEndTurn} disabled={!started}>
              ターン終了
            </button>
          ) : null}
        </div>
      </div>

      {winnerName ? <p className="winner-banner">{winnerName} がゴールしました。進行はファシリ判断で続行できます。</p> : null}

      <div className="board-grid">
        {displayedBoard.map((space) => {
          const spacePlayers = players.filter((player) => player.position === space.id);

          return (
            <article key={space.id} className={`board-cell space-${space.type}`}>
              <header>
                <span>#{space.id}</span>
                <strong>{space.label}</strong>
              </header>
              <div className="token-row">
                {spacePlayers.map((player) => (
                <span key={player.id} className="token" style={{ backgroundColor: player.color }} title={player.name}>
                    {player.avatarUrl ? <img src={player.avatarUrl} alt={`${player.name}の画像`} className="token-image" /> : player.name.slice(0, 1)}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
