import type { BoardSpace } from "../lib/types";

interface BoardDebugPanelProps {
  roomId: string;
  boardVersion: string;
  board: BoardSpace[];
}

export const BoardDebugPanel = ({ roomId, boardVersion, board }: BoardDebugPanelProps) => {
  const spaces31to39 = board.filter((space) => space.id >= 31 && space.id <= 39);

  return (
    <section className="panel board-debug-panel">
      <h2>BoardDebugPanel</h2>
      <p>roomId = {roomId}</p>
      <p>boardVersion = {boardVersion}</p>
      <div className="board-debug-list">
        {spaces31to39.map((space) => (
          <p key={space.id}>
            #{space.id} = {space.type}
          </p>
        ))}
      </div>
    </section>
  );
};
