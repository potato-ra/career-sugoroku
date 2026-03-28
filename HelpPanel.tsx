import strengthCards from "../data/strength_cards.json";

interface HelpPanelProps {
  mode: "rules" | "strengths" | null;
  onClose: () => void;
}

const RULE_TEXT = [
  "このゲームは、キャリア観や自分らしさをみんなで対話しながら見つけていくゲームです。勝ち負けはなく、正解を当てる場でもありません。",
  "プレイヤーは順番にサイコロを振ってコマを進め、止まったマスのお題に沿って話します。質問マスでは自分の考えを話し、他者質問マスではほかの人に質問します。ほめ活マスでは、その人の良さや強みを言葉にします。イベントマスではイベントを引いて、その内容に沿って進めます。",
  "職業カードは、いろいろな仕事や働き方のヒントとして使うカードです。強みカードは、その人らしさや良さを言葉にするためのカードです。",
  "ゲームの最後には、他のプレイヤーから、自分の強み・そう思った理由・その人に合いそうな職業を伝えてもらいます。そして本人は、それを聞いた感想を返します。",
  "このようにして、自己理解と相互理解を深めることが、このゲームのゴールです。積極的に自己開示をしつつ、相手にも興味を持って質問していきましょう。",
];

export const HelpPanel = ({ mode, onClose }: HelpPanelProps) => {
  if (!mode) {
    return null;
  }

  return (
    <div className="help-overlay" role="dialog" aria-modal="true">
      <section className="panel help-panel">
        <div className="section-header">
          <h2>{mode === "rules" ? "ルール" : "強みカード一覧"}</h2>
          <button type="button" className="secondary" onClick={onClose}>
            閉じる
          </button>
        </div>

        {mode === "rules" ? (
          <div className="help-body">
            {RULE_TEXT.map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        ) : (
          <div className="help-body">
            <div className="strength-reference-grid">
              {strengthCards.map((card) => (
                <div key={card.id} className="strength-reference-item">
                  <strong>{card.text}</strong>
                  <small>{card.category}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
