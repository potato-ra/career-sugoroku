import type { Player } from "../lib/types";
import { getCareerCategoryClassName, getCareerIllustration, getStrengthCategoryClassName } from "../lib/cardThemes";

interface PlayerPanelProps {
  players: Player[];
  currentTurnPlayerId?: string;
  focusedPlayerId?: string;
  title?: string;
}

export const PlayerPanel = ({
  players,
  currentTurnPlayerId,
  focusedPlayerId,
  title = "PlayerPanel",
}: PlayerPanelProps) => {
  const visiblePlayers = focusedPlayerId ? players.filter((player) => player.id === focusedPlayerId) : players;

  return (
    <section className="panel">
      <div className="section-header">
        <h2>{title}</h2>
        <p>{focusedPlayerId ? "選択したプレイヤーの情報を表示中" : "全プレイヤーのキャリアカードを表示中"}</p>
      </div>
      <div className="player-list">
        {visiblePlayers.map((player) => (
          <article key={player.id} className={`player-card ${player.id === currentTurnPlayerId ? "is-current" : ""}`}>
            <div className="player-meta">
              <span className="token large-token" style={{ backgroundColor: player.color }}>
                {player.avatarUrl ? <img src={player.avatarUrl} alt={`${player.name}の画像`} className="token-image" /> : player.name.slice(0, 1)}
              </span>
              <div>
                <h3>{player.name}</h3>
                <p>
                  {player.isBot ? "Botプレイヤー" : "プレイヤー"} / {player.position} マス目
                </p>
              </div>
            </div>
            <div className="career-card-grid">
              {player.careerCards.map((card) => (
                <div key={card.id} className={`career-card ${getCareerCategoryClassName(card.category)}`}>
                  <div className="career-card-top">
                    <span className="career-illustration" aria-hidden="true">
                      {getCareerIllustration(card.title, card.category)}
                    </span>
                    <span className="career-category-badge">{card.category}</span>
                  </div>
                  <strong>{card.title}</strong>
                  <p>{card.description}</p>
                  <div className="card-section">
                    <span className="card-section-label">活かしやすいスキル</span>
                    <div className="trait-chip-list">
                      {card.skills.map((skill) => (
                        <span key={`${card.id}_${skill}`} className="trait-chip skill-chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="card-section">
                    <span className="card-section-label">こんな人に向いている</span>
                    <div className="trait-chip-list">
                      {card.personality.map((trait) => (
                        <span key={`${card.id}_${trait}`} className="trait-chip personality-chip">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="received-strengths">
              <strong>受け取った強みカード</strong>
              {player.strengthCards.length > 0 ? (
                <div className="strength-tag-list">
                  {player.strengthCards.map((card) => (
                    <span
                      key={`${player.id}_strength_${card.id}`}
                      className={`strength-tag ${getStrengthCategoryClassName(card.category)}`}
                    >
                      <span className="strength-tag-category">{card.category}</span>
                      {card.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-text">まだ配られていません</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
