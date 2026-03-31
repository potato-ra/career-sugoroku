import strengthCards from "../data/strength_cards.json";

interface HelpPanelProps {
  mode: "rules" | "strengths" | null;
  usedStrengthCardIds?: number[];
  onClose: () => void;
}

const groupedStrengthCards = strengthCards.reduce<Record<string, typeof strengthCards>>((groups, card) => {
  const existing = groups[card.category] ?? [];
  groups[card.category] = [...existing, card];
  return groups;
}, {});

export const HelpPanel = ({ mode, usedStrengthCardIds = [], onClose }: HelpPanelProps) => {
  if (!mode) {
    return null;
  }

  const title = mode === "rules" ? "ルール" : "強みカード一覧";

  return (
    <div className="help-overlay" role="dialog" aria-modal="true">
      <section className="panel help-panel">
        <div className="section-header">
          <h2>{title}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            閉じる
          </button>
        </div>

        {mode === "rules" ? (
          <div className="help-body">
            <section className="rule-section">
              <h3>キャリアすごろく プレイガイド</h3>
              <p>
                このゲームは、勝ち負けを競うものではありません。対話を通じて
                <strong>「自分の大切にしている価値観」</strong>
                や
                <strong>「他者から見た自分の強み」</strong>
                を再発見するためのワークショップ型ゲームです。
              </p>
            </section>

            <section className="rule-section">
              <h3>1. ゲームのコンセプト</h3>
              <ul className="help-list">
                <li>
                  <strong>目的</strong>：自己理解と相互理解を深める。
                </li>
                <li>
                  <strong>ゴール</strong>：自分らしいキャリアのヒントを、参加者全員で見つける。
                </li>
                <li>
                  <strong>スタンス</strong>：正解はありません。「今の自分」を言葉にしてみる場です。
                </li>
              </ul>
            </section>

            <section className="rule-section">
              <h3>2. 基本的な進め方</h3>
              <p>プレイヤーは順番にサイコロを振り、止まったマスの指示に従ってアクションを行います。</p>

              <h4>マスの種類とアクション</h4>
              <div className="help-table-wrap">
                <table className="help-table">
                  <thead>
                    <tr>
                      <th>マス目</th>
                      <th>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>質問マス</td>
                      <td>お題に沿って、自分の考えやエピソードを話します。</td>
                    </tr>
                    <tr>
                      <td>他者質問マス</td>
                      <td>他のプレイヤーに対して、気になることを質問します。</td>
                    </tr>
                    <tr>
                      <td>ほめ活マス</td>
                      <td>その人の良さや強みを言葉にして伝えます。</td>
                    </tr>
                    <tr>
                      <td>イベントマス</td>
                      <td>イベントカードを引き、その内容に沿って進めます。</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4>使用するカードの役割</h4>
              <ul className="help-list">
                <li>
                  <strong>職業カード</strong>：働き方のヒント。「少し気になる」「意外と合うかも」という直感を大切にします。
                </li>
                <li>
                  <strong>強みカード</strong>：他者の良さを言語化するツール。可能性を広げるヒントとして使います。
                </li>
                <li>カードの進行・管理はファシリテーターが行います。</li>
              </ul>
            </section>

            <section className="rule-section">
              <h3>3. フィードバック（ゲームの締めくくり）</h3>
              <p>ゲームの最後には、参加者同士でフィードバックの時間を持ちます。</p>
              <ol className="help-list">
                <li>
                  <strong>フィードバックを送る</strong>：相手の「強み」とその「理由」を伝えます。相手の持ち札の中から「似合いそうな職業」を選んで伝えます。
                </li>
                <li>
                  <strong>フィードバックを受け取る</strong>：聞いた内容に対して、自分がどう感じたか率直な感想を返します。
                </li>
              </ol>
            </section>

            <section className="rule-section">
              <h3>4. 大切にしたい4つの約束（グランドルール）</h3>
              <p>安心して対話を楽しむために、以下のルールを共有しましょう。</p>
              <ol className="help-list">
                <li>
                  <strong>否定しない</strong>：まずは「そう感じるんだね」と受け止める。
                </li>
                <li>
                  <strong>決めつけない</strong>：自分も相手も、変化する可能性を尊重する。
                </li>
                <li>
                  <strong>無理をしない</strong>：話したくないことは話さなくてOK。
                </li>
                <li>
                  <strong>うまく話そうとしない</strong>：思いついた言葉を少しずつ出すだけで十分です。
                </li>
              </ol>
            </section>
          </div>
        ) : (
          <div className="help-body">
            {Object.entries(groupedStrengthCards).map(([category, cards]) => (
              <section key={category} className="strength-reference-section">
                <div className="section-header">
                  <h3>{category}</h3>
                  <p>{cards.length}枚</p>
                </div>
                <div className="strength-reference-grid">
                  {cards.map((card) => (
                    <div
                      key={card.id}
                      className={`strength-reference-item ${usedStrengthCardIds.includes(card.id) ? "is-distributed" : "is-available"}`}
                    >
                      <strong>
                        {card.id}. {card.text}
                      </strong>
                      <span className="strength-reference-status">{usedStrengthCardIds.includes(card.id) ? "配布済み" : "未配布"}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
