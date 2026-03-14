import type { Player } from "../lib/types";

interface RoleSwitcherProps {
  viewMode: "facilitator" | "player";
  onChangeViewMode: (mode: "facilitator" | "player") => void;
  selectedPlayerId: string;
  onChangePlayerId: (playerId: string) => void;
  players: Player[];
}

export const RoleSwitcher = ({
  viewMode,
  onChangeViewMode,
  selectedPlayerId,
  onChangePlayerId,
  players,
}: RoleSwitcherProps) => {
  return (
    <section className="panel role-switcher">
      <div className="section-header">
        <h2>RoleSwitcher</h2>
        <p>{viewMode === "facilitator" ? "ファシリ視点" : "プレイヤー視点"}</p>
      </div>
      <div className="mode-switch">
        <button type="button" className={viewMode === "facilitator" ? "" : "secondary"} onClick={() => onChangeViewMode("facilitator")}>
          ファシリ視点
        </button>
        <button type="button" className={viewMode === "player" ? "" : "secondary"} onClick={() => onChangeViewMode("player")}>
          プレイヤー視点
        </button>
      </div>
      {viewMode === "player" ? (
        <label>
          表示対象プレイヤー
          <select value={selectedPlayerId} onChange={(event) => onChangePlayerId(event.target.value)}>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
};
