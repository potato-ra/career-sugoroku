import { useEffect, useState } from "react";
import strengthCards from "../data/strength_cards.json";
import { getStrengthCategoryClassName } from "../lib/cardThemes";
import type { Player, StrengthGift } from "../lib/types";

interface StrengthCardPanelProps {
  players: Player[];
  currentPlayerId: string;
  viewedPlayerId?: string;
  facilitatorId?: string | null;
  facilitatorName?: string | null;
  strengthGiftHistory: StrengthGift[];
  title: string;
  onGiveStrengthCard: (targetPlayerId: string, strengthCardId: number) => void;
  onGiveRandomStrengthCard: (targetPlayerId: string) => void;
  onUndoStrengthGift: (giftId: string) => void;
}

export const StrengthCardPanel = ({
  players,
  currentPlayerId,
  viewedPlayerId,
  facilitatorId,
  facilitatorName,
  strengthGiftHistory,
  title,
  onGiveStrengthCard,
  onGiveRandomStrengthCard,
  onUndoStrengthGift,
}: StrengthCardPanelProps) => {
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  const visiblePlayers = viewedPlayerId ? players.filter((player) => player.id === viewedPlayerId) : players;
  const distributedIds = new Set(players.flatMap((player) => player.strengthCards.map((card) => card.id)));
  const availableCards = strengthCards.filter((card) => !distributedIds.has(card.id));
  const defaultTargetId = players.find((player) => player.id !== currentPlayerId)?.id ?? "";
  const [targetPlayerId, setTargetPlayerId] = useState(defaultTargetId);
  const [selectedCardId, setSelectedCardId] = useState<number>(availableCards[0]?.id ?? 1);
  const [historyPlayerFilter, setHistoryPlayerFilter] = useState("all");
  const [historyOrder, setHistoryOrder] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    if (!players.some((player) => player.id === targetPlayerId && player.id !== currentPlayerId)) {
      setTargetPlayerId(defaultTargetId);
    }
  }, [currentPlayerId, defaultTargetId, players, targetPlayerId]);

  useEffect(() => {
    if (!availableCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(availableCards[0]?.id ?? 1);
    }
  }, [availableCards, selectedCardId]);

  const filteredHistory = strengthGiftHistory
    .filter((gift) => {
      if (historyPlayerFilter === "all") {
        return true;
      }
      return gift.fromPlayerId === historyPlayerFilter || gift.toPlayerId === historyPlayerFilter;
    })
    .sort((left, right) =>
      historyOrder === "newest"
        ? right.createdAt.localeCompare(left.createdAt)
        : left.createdAt.localeCompare(right.createdAt),
    );

  return (
    <section className="panel strength-panel">
      <div className="section-header">
        <h2>{title}</h2>
        <p>{currentPlayer ? `${currentPlayer.name} から渡す強みカード` : facilitatorName ? `${facilitatorName} が配る強みカード` : "強みカード"}</p>
      </div>

      <div className="strength-layout">
        <div className="strength-give-box">
          <label>
            渡す相手
            <select value={targetPlayerId} onChange={(event) => setTargetPlayerId(event.target.value)}>
              {players
                .filter((player) => player.id !== currentPlayerId)
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            強みカード
            <select value={selectedCardId} onChange={(event) => setSelectedCardId(Number(event.target.value))}>
              {availableCards.map((card) => (
                <option key={card.id} value={card.id}>
                  [{card.category}] {card.text}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onGiveStrengthCard(targetPlayerId, selectedCardId)}
            disabled={!targetPlayerId || availableCards.length === 0}
          >
            強みカードを渡す
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => onGiveRandomStrengthCard(targetPlayerId)}
            disabled={!targetPlayerId || availableCards.length === 0}
          >
            ランダムで1枚引いて配る
          </button>
          <small>残り {availableCards.length} 枚 / 配布済み {distributedIds.size} 枚</small>
          {availableCards.length > 0 ? (
            <div className="selected-strength-preview">
              {availableCards
                .filter((card) => card.id === selectedCardId)
                .map((card) => (
                  <span key={card.id} className={`strength-tag ${getStrengthCategoryClassName(card.category)}`}>
                    <span className="strength-tag-category">{card.category}</span>
                    {card.text}
                  </span>
                ))}
            </div>
          ) : null}
        </div>

        <div className="strength-player-grid">
          {visiblePlayers.map((player) => (
            <article key={player.id} className="strength-player-card">
              <h3>
                {player.name}
              </h3>
              {player.strengthCards.length > 0 ? (
                <div className="strength-tag-list">
                  {player.strengthCards.map((card) => (
                    <span key={`${player.id}_${card.id}`} className={`strength-tag ${getStrengthCategoryClassName(card.category)}`}>
                      <span className="strength-tag-category">{card.category}</span>
                      {card.text}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-text">まだ強みカードはありません</p>
              )}
            </article>
          ))}
        </div>
      </div>

      <div className="strength-history">
        <div className="section-header">
          <h3>配布履歴</h3>
          <p>誰が誰に渡したかを表示</p>
        </div>
        <div className="strength-history-filters">
          <label>
            並び順
            <select value={historyOrder} onChange={(event) => setHistoryOrder(event.target.value as "newest" | "oldest")}>
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
            </select>
          </label>
          <label>
            プレイヤー別
            <select value={historyPlayerFilter} onChange={(event) => setHistoryPlayerFilter(event.target.value)}>
              <option value="all">全員</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {filteredHistory.length > 0 ? (
          <div className="strength-history-list">
            {filteredHistory.map((gift) => {
              const fromPlayer = players.find((player) => player.id === gift.fromPlayerId);
              const toPlayer = players.find((player) => player.id === gift.toPlayerId);
              const canUndo = currentPlayerId === gift.fromPlayerId || currentPlayerId === facilitatorId;
              const fromName = fromPlayer?.name ?? (gift.fromPlayerId === facilitatorId ? facilitatorName ?? "ファシリテーター" : "不明");

              return (
                <article key={gift.id} className="strength-history-item">
                  <div>
                    <span className={`strength-tag ${getStrengthCategoryClassName(gift.strengthCard.category)}`}>
                      <span className="strength-tag-category">{gift.strengthCard.category}</span>
                      {gift.strengthCard.text}
                    </span>
                    <p>
                      {fromName} → {toPlayer?.name ?? "不明"}
                    </p>
                  </div>
                  <button type="button" className="secondary" onClick={() => onUndoStrengthGift(gift.id)} disabled={!canUndo}>
                    取り消し
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-text">条件に合う配布履歴はありません</p>
        )}
      </div>
    </section>
  );
};
