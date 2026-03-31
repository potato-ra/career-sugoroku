import { useEffect, useMemo, useState } from "react";
import type { Player } from "../lib/types";
import { getCareerCategoryClassName, getCareerIllustration, getStrengthCategoryClassName } from "../lib/cardThemes";

interface PlayerPeekPanelProps {
  players: Player[];
  currentPlayerId?: string;
}

export const PlayerPeekPanel = ({ players, currentPlayerId }: PlayerPeekPanelProps) => {
  const otherPlayers = useMemo(
    () => players.filter((player) => player.id !== currentPlayerId),
    [currentPlayerId, players],
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState(otherPlayers[0]?.id ?? "");

  useEffect(() => {
    if (!selectedPlayerId || !otherPlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(otherPlayers[0]?.id ?? "");
    }
  }, [otherPlayers, selectedPlayerId]);

  const selectedPlayer = otherPlayers.find((player) => player.id === selectedPlayerId) ?? otherPlayers[0];

  if (otherPlayers.length === 0) {
    return (
      <section className="panel player-peek-panel">
        <div className="section-header">
          <h2>他プレイヤーの持ち札</h2>
          <p>相手のカード確認</p>
        </div>
        <p className="empty-text">他プレイヤーが参加すると、ここから持ち札を確認できます。</p>
      </section>
    );
  }

  return (
    <section className="panel player-peek-panel">
      <div className="section-header">
        <h2>他プレイヤーの持ち札</h2>
        <p>必要な時だけ確認できます</p>
      </div>
      <label>
        確認するプレイヤー
        <select value={selectedPlayer?.id ?? ""} onChange={(event) => setSelectedPlayerId(event.target.value)}>
          {otherPlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </label>
      {selectedPlayer ? (
        <div className="peek-content">
          <div className="player-meta">
            <span className="token large-token" style={{ backgroundColor: selectedPlayer.color }}>
              {selectedPlayer.avatarUrl ? <img src={selectedPlayer.avatarUrl} alt={`${selectedPlayer.name}の画像`} className="token-image" /> : selectedPlayer.name.slice(0, 1)}
            </span>
            <div>
              <h3>{selectedPlayer.name}</h3>
              <p>{selectedPlayer.position} マス目</p>
            </div>
          </div>
          <div className="peek-section">
            <strong>職業カード</strong>
            <div className="career-card-grid">
              {selectedPlayer.careerCards.map((card) => (
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
          </div>
          <div className="peek-section">
            <strong>強みカード</strong>
            {selectedPlayer.strengthCards.length > 0 ? (
              <div className="strength-tag-list">
                {selectedPlayer.strengthCards.map((card) => (
                  <span key={`${selectedPlayer.id}_peek_strength_${card.id}`} className={`strength-tag ${getStrengthCategoryClassName(card.category)}`}>
                    <span className="strength-tag-category">{card.category}</span>
                    {card.id}. {card.text}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty-text">まだ配られていません</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
};
