import { useMemo, useState } from "react";
import type { RoomState, TurnResolution } from "../lib/types";

interface DeveloperPanelProps {
  room: RoomState;
  onAddBot: () => void;
  onRemoveBot: (playerId?: string) => void;
  onSetTurn: (playerId: string) => void;
  onRollFixedDice: (dice: number) => void;
  onMovePlayer: (playerId: string, position: number) => void;
  onShowResolution: (resolution: TurnResolution) => void;
  onRedealCards: () => void;
}

const modalTemplates: TurnResolution[] = [
  { kind: "question", title: "質問カード", description: "あなたにとって理想の働き方は？", spaceId: 2 },
  { kind: "deep", title: "深掘りタイム", description: "その経験をさらに詳しく聞いてみましょう。", spaceId: 6 },
  { kind: "event", title: "キャリアイベント", description: "最近のキャリアの悩みを共有してください。", spaceId: 14 },
];

export const DeveloperPanel = ({
  room,
  onAddBot,
  onRemoveBot,
  onSetTurn,
  onRollFixedDice,
  onMovePlayer,
  onShowResolution,
  onRedealCards,
}: DeveloperPanelProps) => {
  const [turnPlayerId, setTurnPlayerId] = useState(room.players[0]?.id ?? "");
  const [dice, setDice] = useState(6);
  const [movePlayerId, setMovePlayerId] = useState(room.players[0]?.id ?? "");
  const [position, setPosition] = useState(1);
  const [removeBotId, setRemoveBotId] = useState("");
  const [templateIndex, setTemplateIndex] = useState(0);

  const botPlayers = useMemo(() => room.players.filter((player) => player.isBot), [room.players]);

  return (
    <section className="panel developer-panel">
      <div className="section-header">
        <h2>DeveloperPanel</h2>
        <p>development環境でのみ表示</p>
      </div>
      <div className="developer-grid">
        <div className="developer-card">
          <h3>Botの追加・削除</h3>
          <div className="inline-actions">
            <button type="button" onClick={onAddBot}>
              Bot追加
            </button>
            <button type="button" className="secondary" onClick={() => onRemoveBot(removeBotId || undefined)}>
              Bot削除
            </button>
          </div>
          <label>
            削除対象
            <select value={removeBotId} onChange={(event) => setRemoveBotId(event.target.value)}>
              <option value="">末尾のBot</option>
              {botPlayers.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="developer-card">
          <h3>現在ターン変更</h3>
          <label>
            ターン対象
            <select value={turnPlayerId} onChange={(event) => setTurnPlayerId(event.target.value)}>
              {room.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => onSetTurn(turnPlayerId)}>
            現在ターンに設定
          </button>
        </div>

        <div className="developer-card">
          <h3>ダイスと移動</h3>
          <label>
            ダイス目
            <input type="number" min={1} max={6} value={dice} onChange={(event) => setDice(Number(event.target.value))} />
          </label>
          <button type="button" onClick={() => onRollFixedDice(dice)}>
            指定出目で振る
          </button>
          <label>
            移動プレイヤー
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
          <button type="button" className="secondary" onClick={() => onMovePlayer(movePlayerId, position)}>
            任意マスへ移動
          </button>
        </div>

        <div className="developer-card">
          <h3>モーダルと再配布</h3>
          <label>
            表示テンプレート
            <select value={templateIndex} onChange={(event) => setTemplateIndex(Number(event.target.value))}>
              {modalTemplates.map((template, index) => (
                <option key={`${template.kind}_${index}`} value={index}>
                  {template.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => onShowResolution(modalTemplates[templateIndex]!)}>
            任意イベントモーダル表示
          </button>
          <button type="button" className="secondary" onClick={onRedealCards}>
            キャリアカード再配布
          </button>
        </div>
      </div>

      <details>
        <summary>現在のゲーム状態をJSONで表示</summary>
        <pre className="json-viewer">{JSON.stringify(room, null, 2)}</pre>
      </details>
    </section>
  );
};
