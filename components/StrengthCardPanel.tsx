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
  usedStrengthCardIds: number[];
  title: string;
  onGiveStrengthCard: (targetPlayerId: string, strengthCardId: number) => void;
  onGiveRandomStrengthCard: (targetPlayerId: string) => void;
  onMoveStrengthCard: (strengthCardId: number, fromPlayerId?: string | null, toPlayerId?: string | null) => void;
  onUndoStrengthGift: (giftId: string) => void;
}

export const StrengthCardPanel = ({
  players,
  currentPlayerId,
  viewedPlayerId,
  facilitatorId,
  facilitatorName,
  strengthGiftHistory,
  usedStrengthCardIds,
  title,
  onGiveStrengthCard,
  onGiveRandomStrengthCard,
  onMoveStrengthCard,
  onUndoStrengthGift,
}: StrengthCardPanelProps) => {
  const currentPlayer = players.find((player) => player.id === currentPlayerId);
  const visiblePlayers = viewedPlayerId ? players.filter((player) => player.id === viewedPlayerId) : players;
  const distributedIds = new Set(players.flatMap((player) => player.strengthCards.map((card) => card.id)));
  const availableCards = strengthCards.filter((card) => !distributedIds.has(card.id));
  const defaultTargetId = players.find((player) => player.id !== currentPlayerId)?.id ?? "";
  const [targetPlayerId, setTargetPlayerId] = useState(defaultTargetId);
  const [selectedCardId, setSelectedCardId] = useState<number>(availableCards[0]?.id ?? 1);
  const [moveSourceId, setMoveSourceId] = useState<string>("pool");
  const [moveTargetId, setMoveTargetId] = useState<string>(players[0]?.id ?? "");
  const [moveCardId, setMoveCardId] = useState<number>(availableCards[0]?.id ?? strengthCards[0]?.id ?? 1);
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

  const moveSourceCards =
    moveSourceId === "pool"
      ? strengthCards.filter((card) => !distributedIds.has(card.id))
      : players.find((player) => player.id === moveSourceId)?.strengthCards ?? [];

  useEffect(() => {
    if (moveSourceId === moveTargetId) {
      setMoveTargetId(moveSourceId === "pool" ? players[0]?.id ?? "" : "pool");
    }
  }, [moveSourceId, moveTargetId, players]);

  useEffect(() => {
    if (!moveSourceCards.some((card) => card.id === moveCardId)) {
      setMoveCardId(moveSourceCards[0]?.id ?? 1);
    }
  }, [moveCardId, moveSourceCards]);

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
                  {card.id}. [{card.category}] {card.text}
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

      <div className="strength-give-box strength-move-box">
        <div className="section-header">
          <h3>強みカードを自由に移動</h3>
          <p>未配布にも戻せます</p>
        </div>
        <div className="strength-history-filters strength-move-grid">
          <label>
            移動元
            <select value={moveSourceId} onChange={(event) => setMoveSourceId(event.target.value)}>
              <option value="pool">未配布</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            カード
            <select value={moveCardId} onChange={(event) => setMoveCardId(Number(event.target.value))}>
              {moveSourceCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.id}. [{card.category}] {card.text}
                </option>
              ))}
            </select>
          </label>
          <label>
            移動先
            <select value={moveTargetId} onChange={(event) => setMoveTargetId(event.target.value)}>
              <option value="pool">未配布</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => onMoveStrengthCard(moveCardId, moveSourceId === "pool" ? null : moveSourceId, moveTargetId === "pool" ? null : moveTargetId)}
            disabled={!moveSourceCards.length || moveSourceId === moveTargetId}
          >
            強みカードを移動
          </button>
        </div>
        <small>一覧の {usedStrengthCardIds.length} 枚が現在どこかに配布中です。</small>
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
