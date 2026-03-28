import strengthCards from "../data/strength_cards.json";
import eventCards from "../data/event_spaces_20.json";
import careerCards from "../data/career_cards.json";

interface HelpPanelProps {
  mode: "guide" | "rules" | "strengths" | null;
  onClose: () => void;
}

const groupedStrengthCards = strengthCards.reduce<Record<string, typeof strengthCards>>((groups, card) => {
  const existing = groups[card.category] ?? [];
  groups[card.category] = [...existing, card];
  return groups;
}, {});

const groupedCareerCards = careerCards.reduce<Record<string, typeof careerCards>>((groups, card) => {
  const existing = groups[card.category] ?? [];
  groups[card.category] = [...existing, card];
  return groups;
}, {});

const groupedEventCards = eventCards.reduce<Record<string, typeof eventCards>>((groups, card) => {
  const existing = groups[card.eventType] ?? [];
  groups[card.eventType] = [...existing, card];
  return groups;
}, {});

const eventTypeLabels: Record<string, string> = {
  strength: "強み発見系",
  career: "キャリア転機系",
  dialogue: "対話深化系",
  game: "ゲーム性イベント",
};

export const HelpPanel = ({ mode, onClose }: HelpPanelProps) => {
  if (!mode) {
    return null;
  }

  const title =
    mode === "guide" ? "配布ガイド" : mode === "rules" ? "ルール" : "強みカード一覧";

  return (
    <div className="help-overlay" role="dialog" aria-modal="true">
      <section className="panel help-panel">
        <div className="section-header">
          <h2>{title}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            閉じる
          </button>
        </div>

        {mode === "guide" ? (
          <div className="help-body">
            <section className="rule-section">
              <h3>1. ルール</h3>
              <p>勝ち負けを競うゲームではなく、対話を通じて価値観や強みを再発見するワークショップ型ゲームです。</p>
              <ul className="help-list">
                <li>質問マスでは、自分の考えや経験を話します。</li>
                <li>他者質問マスでは、他のプレイヤーに質問します。</li>
                <li>ほめ活マスでは、相手の強みや良さを言葉にします。</li>
                <li>イベントマスでは、イベントカードを引いて進めます。</li>
                <li>最後に、強み・理由・似合いそうな職業を伝え合って締めくくります。</li>
              </ul>
            </section>

            <section className="rule-section">
              <h3>2. プレイヤーの操作方法</h3>
              <ul className="help-list">
                <li>ロビーでルームに参加します。</li>
                <li>ゲーム開始前に、必要なら `順番を引く` ボタンで順番くじを引きます。</li>
                <li>自分の手番になったら `サイコロを振る` を押します。</li>
                <li>止まったマスの内容に沿って話します。</li>
                <li>ルールや強みカード一覧が気になったら、右上のボタンからいつでも確認できます。</li>
              </ul>
            </section>

            <section className="rule-section">
              <h3>3. 職業カード一覧</h3>
              {Object.entries(groupedCareerCards).map(([category, cards]) => (
                <div key={category} className="guide-subsection">
                  <h4>{category}</h4>
                  <div className="help-table-wrap">
                    <table className="help-table">
                      <thead>
                        <tr>
                          <th>職業</th>
                          <th>説明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cards.map((card) => (
                          <tr key={card.id}>
                            <td>{card.title}</td>
                            <td>{card.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>

            <section className="rule-section">
              <h3>4. 強みカード一覧</h3>
              {Object.entries(groupedStrengthCards).map(([category, cards]) => (
                <div key={category} className="guide-subsection">
                  <h4>{category}</h4>
                  <div className="strength-reference-grid">
                    {cards.map((card) => (
                      <div key={card.id} className="strength-reference-item">
                        <strong>
                          {card.id}. {card.text}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="rule-section">
              <h3>5. ファシリテーターの操作方法</h3>
              <ul className="help-list">
                <li>ルームを作成し、人数がそろったら `ゲーム開始` を押します。</li>
                <li>必要に応じて、プレイヤーの順番を手動で並び替えます。</li>
                <li>イベントや強みカード配布、ターン終了を進行します。</li>
                <li>途中参加や再合流があったら、任意のマスへ移動して調整できます。</li>
                <li>終了したいタイミングで `ゲーム終了` を押すと、全員に終了画面が表示されます。</li>
              </ul>
            </section>

            <section className="rule-section">
              <h3>6. イベントカード一覧</h3>
              {Object.entries(groupedEventCards).map(([eventType, cards]) => (
                <div key={eventType} className="guide-subsection">
                  <h4>{eventTypeLabels[eventType] ?? eventType}</h4>
                  <div className="help-table-wrap">
                    <table className="help-table">
                      <thead>
                        <tr>
                          <th>イベント名</th>
                          <th>内容</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cards.map((card) => (
                          <tr key={card.id}>
                            <td>{card.title}</td>
                            <td>{card.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </div>
        ) : mode === "rules" ? (
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
                    <div key={card.id} className="strength-reference-item">
                      <strong>
                        {card.id}. {card.text}
                      </strong>
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
