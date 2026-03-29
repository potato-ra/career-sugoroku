import { useState } from "react";
import type { JoinPayload } from "../hooks/useGameSocket";

interface LobbyProps {
  onCreateRoom: (payload: JoinPayload) => Promise<unknown>;
  onJoinRoom: (payload: JoinPayload) => Promise<unknown>;
  errorMessage?: string;
}

export const Lobby = ({ onCreateRoom, onJoinRoom, errorMessage }: LobbyProps) => {
  const [createName, setCreateName] = useState("");
  const [createRoomId, setCreateRoomId] = useState("CAREER01");
  const [createAvatarUrl, setCreateAvatarUrl] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("CAREER01");
  const [joinAvatarUrl, setJoinAvatarUrl] = useState("");
  const [createMode, setCreateMode] = useState<"normal" | "demo">("normal");
  const [botCount, setBotCount] = useState(2);

  const readImageFile = async (file: File | null) => {
    if (!file) {
      return "";
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });
  };

  return (
    <section className="lobby-shell">
      <div className="hero-card">
        <p className="eyebrow">ファシリテーター進行型オンラインワークショップ</p>
        <h1>キャリアすごろくゲーム</h1>
        <p className="hero-copy">
          通常モードに加えて、1人でも確認しやすいデモモードを追加しました。Bot を交えながら、ローカルで進行確認できます。
        </p>
      </div>

      <div className="lobby-grid">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateRoom({
              roomId: createRoomId,
              name: createName,
              isFacilitator: true,
              avatarUrl: createMode === "demo" ? createAvatarUrl : undefined,
              isDemoMode: createMode === "demo",
              botCount,
            });
          }}
        >
          <h2>ルーム作成</h2>
          <div className="mode-switch">
            <button type="button" className={createMode === "normal" ? "" : "secondary"} onClick={() => setCreateMode("normal")}>
              通常モード
            </button>
            <button type="button" className={createMode === "demo" ? "" : "secondary"} onClick={() => setCreateMode("demo")}>
              デモモード
            </button>
          </div>
          <label>
            ルームID
            <input value={createRoomId} onChange={(event) => setCreateRoomId(event.target.value.toUpperCase())} />
          </label>
          <label>
            名前
            <input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="ファシリテーター名" />
          </label>
          {createMode === "demo" ? (
            <label>
              デモプレイヤー画像
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={async (event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  const nextUrl = await readImageFile(nextFile);
                  setCreateAvatarUrl(nextUrl);
                }}
              />
            </label>
          ) : null}
          {createMode === "demo" && createAvatarUrl ? (
            <div className="avatar-upload-preview">
              <img src={createAvatarUrl} alt="デモプレイヤー画像プレビュー" />
              <button type="button" className="secondary" onClick={() => setCreateAvatarUrl("")}>
                画像を外す
              </button>
            </div>
          ) : null}
          {createMode === "demo" ? (
            <label>
              Bot人数
              <select value={botCount} onChange={(event) => setBotCount(Number(event.target.value))}>
                <option value={2}>2人</option>
                <option value={3}>3人</option>
                <option value={4}>4人</option>
              </select>
            </label>
          ) : null}
          <p className="mode-caption">
            {createMode === "demo"
              ? "1人でも開始可能です。Bot_A 〜 Bot_D から不足人数を自動補完します。"
              : "通常モードは 3〜5 人でのプレイを想定しています。"}
          </p>
          <button type="submit">新しいルームを作る</button>
        </form>

        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault();
            void onJoinRoom({ roomId: joinRoomId, name: joinName, avatarUrl: joinAvatarUrl || undefined, isFacilitator: false });
          }}
        >
          <h2>プレイヤー参加</h2>
          <label>
            ルームID
            <input value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value.toUpperCase())} />
          </label>
          <label>
            名前
            <input value={joinName} onChange={(event) => setJoinName(event.target.value)} placeholder="プレイヤー名" />
          </label>
          <label>
            プレイヤー画像
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={async (event) => {
                const nextFile = event.target.files?.[0] ?? null;
                const nextUrl = await readImageFile(nextFile);
                setJoinAvatarUrl(nextUrl);
              }}
            />
          </label>
          {joinAvatarUrl ? (
            <div className="avatar-upload-preview">
              <img src={joinAvatarUrl} alt="プレイヤー画像プレビュー" />
              <button type="button" className="secondary" onClick={() => setJoinAvatarUrl("")}>
                画像を外す
              </button>
            </div>
          ) : null}
          <p className="mode-caption">既存の通常モード / デモモードどちらのルームにも参加できます。</p>
          <button type="submit">ルームに参加する</button>
        </form>
      </div>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
