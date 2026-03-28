import { useEffect, useMemo, useState } from "react";
import type { RoomState } from "../lib/types";

interface FacilitatorControlPanelProps {
  room: RoomState;
  onSetPlayerOrder: (orderedPlayerIds: string[]) => void;
  onRollTurnOrderDice: () => void;
  onMovePlayer: (targetPlayerId: string, position: number) => void;
}

export const FacilitatorControlPanel = ({
  room,
  onSetPlayerOrder,
  onRollTurnOrderDice,
  onMovePlayer,
}: FacilitatorControlPanelProps) => {
  const [orderedPlayerIds, setOrderedPlayerIds] = useState<string[]>(room.players.map((player) => player.id));
  const [movePlayerId, setMovePlayerId] = useState(room.players[0]?.id ?? "");
  const [position, setPosition] = useState(1);

  useEffect(() => {
    setOrderedPlayerIds(room.players.map((player) => player.id));
    setMovePlayerId((currentPlayerId) =>
      room.players.some((player) => player.id === currentPlayerId) ? currentPlayerId : room.players[0]?.id ?? "",
    );
  }, [room.players]);

  const orderedPlayers = useMemo(
    () =>
      orderedPlayerIds
        .map((playerId) => room.players.find((player) => player.id === playerId))
        .filter((player): player is RoomState["players"][number] => Boolean(player)),
    [orderedPlayerIds, room.players],
  );

  const movePlayerUp = (playerId: string) => {
    setOrderedPlayerIds((current) => {
      const index = current.indexOf(playerId);
      if (index <= 0) {
        return current;
      }

      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const movePlayerDown = (playerId: string) => {
    setOrderedPlayerIds((current) => {
      const index = current.indexOf(playerId);
      if (index < 0 || index >= current.length - 1) {
        return current;
      }

      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  return (
    <section className="panel facilitator-control-panel">
      <div className="section-header">
        <h2>進行コントロール</h2>
        <p>順番調整や途中合流の補助を行えます</p>
      </div>

      <div className="facilitator-control-grid">
        <div className="developer-card">
          <h3>手番順の変更</h3>
          <p className="empty-text">手動で並び替えるか、順番決めサイコロで自動決定できます。</p>
          <div className="order-list">
            {orderedPlayers.map((player, index) => (
              <div key={player.id} className="order-item">
                <strong>
                  {index + 1}. {player.name}
                </strong>
                <div className="inline-actions">
                  <button type="button" className="secondary" onClick={() => movePlayerUp(player.id)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => movePlayerDown(player.id)}
                    disabled={index === orderedPlayers.length - 1}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="inline-actions">
            <button type="button" onClick={() => onSetPlayerOrder(orderedPlayers.map((player) => player.id))}>
              この順番を反映
            </button>
            <button type="button" className="secondary" onClick={onRollTurnOrderDice}>
              順番決めサイコロ
            </button>
          </div>
          {room.turnOrderRolls.length > 0 ? (
            <div className="order-dice-results">
              {room.turnOrderRolls.map((roll) => (
                <p key={roll.playerId}>
                  {roll.playerName}: {roll.dice}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="developer-card">
          <h3>任意マスへ移動</h3>
          <p className="empty-text">途中合流や再参加のときに、現在位置をファシリが調整できます。</p>
          <label>
            対象プレイヤー
            <select value={movePlayerId} onChange={(event) => setMovePlayerId(event.target.value)}>
              {room.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            移動先マス
            <input type="number" min={1} max={40} value={position} onChange={(event) => setPosition(Number(event.target.value))} />
          </label>
          <button type="button" onClick={() => onMovePlayer(movePlayerId, position)}>
            コマを移動する
          </button>
        </div>
      </div>
    </section>
  );
};
