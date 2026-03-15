import type { TurnResolution } from "../lib/types";

interface EventModalProps {
  resolution: TurnResolution | null;
  canDrawEvent?: boolean;
  onDrawEvent?: () => void;
}

export const EventModal = ({ resolution, canDrawEvent = false, onDrawEvent }: EventModalProps) => {
  if (!resolution) {
    return (
      <section className="panel event-panel empty-state">
        <h2>EventModal</h2>
        <p>サイコロ後にここへ質問やイベント内容が表示されます。必要に応じてファシリテーターが深掘りします。</p>
      </section>
    );
  }

  return (
    <section className="panel event-panel">
      <div className="section-header">
        <h2>EventModal</h2>
        <span className={`type-chip type-${resolution.kind}`}>{resolution.kind}</span>
      </div>
      <h3>{resolution.title}</h3>
      <p>{resolution.description}</p>
      {resolution.actionRequired === "draw_event" ? (
        <button type="button" onClick={onDrawEvent} disabled={!canDrawEvent}>
          イベントを引く
        </button>
      ) : null}
      <small>対象マス: {resolution.spaceId}</small>
    </section>
  );
};
