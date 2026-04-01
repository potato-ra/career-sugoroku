import { useState } from "react";
import type { FacilitatorAuthUser } from "../hooks/useFacilitatorAuth";
import type { JoinPayload } from "../hooks/useGameSocket";

interface LobbyFacilitatorAccountSummary {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface LobbyProps {
  onCreateRoom: (payload: JoinPayload) => Promise<unknown>;
  onJoinRoom: (payload: JoinPayload) => Promise<unknown>;
  authUser: FacilitatorAuthUser | null;
  authLoading: boolean;
  authError?: string;
  facilitatorAccounts: LobbyFacilitatorAccountSummary[];
  onLogin: (loginId: string, password: string) => Promise<boolean>;
  onLogout: () => Promise<void> | void;
  onChangePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onCreateFacilitatorAccount: (loginId: string, displayName: string, temporaryPassword: string) => Promise<void>;
  onResetFacilitatorPassword: (loginId: string, temporaryPassword: string) => Promise<void>;
  errorMessage?: string;
}

export const Lobby = ({
  onCreateRoom,
  onJoinRoom,
  authUser,
  authLoading,
  authError,
  facilitatorAccounts,
  onLogin,
  onLogout,
  onChangePassword,
  onCreateFacilitatorAccount,
  onResetFacilitatorPassword,
  errorMessage,
}: LobbyProps) => {
  const [createRoomId, setCreateRoomId] = useState("");
  const [createAvatarUrl, setCreateAvatarUrl] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [joinAvatarUrl, setJoinAvatarUrl] = useState("");
  const [createMode, setCreateMode] = useState<"normal" | "demo">("normal");
  const [botCount, setBotCount] = useState(2);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [newFacilitatorLoginId, setNewFacilitatorLoginId] = useState("");
  const [newFacilitatorDisplayName, setNewFacilitatorDisplayName] = useState("");
  const [newTemporaryPassword, setNewTemporaryPassword] = useState("");
  const [resetTargetLoginId, setResetTargetLoginId] = useState("");
  const [resetTemporaryPassword, setResetTemporaryPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

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
        <section className="panel facilitator-entry-panel">
          <div className="section-header">
            <div>
              <h2>ファシリ入口</h2>
              <p className="mode-caption">ファシリとしてログインすると、そのまま同じ画面でルーム作成に進めます。</p>
            </div>
          </div>

          <form
            className="facilitator-auth-form"
            autoComplete="off"
            onSubmit={async (event) => {
              event.preventDefault();
              const ok = await onLogin(loginId, password);
              if (ok) {
                setPassword("");
                setAccountMessage("ファシリログインしました。続けてルームを作成できます。");
              }
            }}
          >
            <h3>1. ファシリログイン</h3>
            {authUser ? (
              <>
                <p className="mode-caption">
                  ログイン中: {authUser.displayName} ({authUser.loginId})
                </p>
                <div className="inline-actions">
                  <span className={`mode-badge ${authUser.role === "admin" ? "demo" : "perspective"}`}>
                    {authUser.role === "admin" ? "管理者" : "ファシリ"}
                  </span>
                  {authUser.mustChangePassword ? <span className="mode-badge normal">パスワード変更が必要</span> : null}
                </div>
                <label>
                  現在のパスワード
                  <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
                </label>
                <label>
                  新しいパスワード
                  <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
                </label>
                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      await onChangePassword(currentPassword, nextPassword);
                      setCurrentPassword("");
                      setNextPassword("");
                      setAccountMessage("パスワードを変更しました。");
                    }}
                  >
                    パスワード変更
                  </button>
                  <button type="button" className="secondary" onClick={() => void onLogout()}>
                    ログアウト
                  </button>
                </div>
              </>
            ) : (
              <>
                <label>
                  ログインID
                  <input
                    name="facilitator_login_id"
                    autoComplete="off"
                    value={loginId}
                    onChange={(event) => setLoginId(event.target.value)}
                  />
                </label>
                <label>
                  パスワード
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <button type="submit" disabled={authLoading}>
                  ファシリログイン
                </button>
              </>
            )}
            {authError ? <p className="error-text">{authError}</p> : null}
            {accountMessage ? <p className="mode-caption">{accountMessage}</p> : null}
          </form>

          <form
            className="facilitator-room-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreateRoom({
                roomId: createRoomId,
                name: authUser?.displayName ?? "",
                isFacilitator: true,
                authToken: authUser ? window.localStorage.getItem("career-sugoroku-auth") ?? undefined : undefined,
                avatarUrl: createMode === "demo" ? createAvatarUrl : undefined,
                isDemoMode: createMode === "demo",
                botCount,
              });
            }}
          >
            <h3>2. ルーム作成</h3>
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
              ファシリ名
              <input value={authUser?.displayName ?? ""} readOnly placeholder="ファシリログインすると表示されます" />
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
            <button type="submit" disabled={!authUser}>
              新しいルームを作る
            </button>
            {!authUser ? <p className="mode-caption">まずは上のファシリログインを完了してください。</p> : null}
          </form>
        </section>

        <form
          className="panel"
          autoComplete="off"
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
            <input
              name="player_join_name"
              autoComplete="off"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
            />
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

        {authUser?.role === "admin" ? (
          <section className="panel">
            <h2>ファシリアカウント管理</h2>
            <label>
              新しいログインID
              <input value={newFacilitatorLoginId} onChange={(event) => setNewFacilitatorLoginId(event.target.value)} />
            </label>
            <label>
              表示名
              <input value={newFacilitatorDisplayName} onChange={(event) => setNewFacilitatorDisplayName(event.target.value)} />
            </label>
            <label>
              仮パスワード
              <input value={newTemporaryPassword} onChange={(event) => setNewTemporaryPassword(event.target.value)} />
            </label>
            <button
              type="button"
              onClick={async () => {
                await onCreateFacilitatorAccount(newFacilitatorLoginId, newFacilitatorDisplayName, newTemporaryPassword);
                setNewFacilitatorLoginId("");
                setNewFacilitatorDisplayName("");
                setNewTemporaryPassword("");
                setAccountMessage("ファシリアカウントを発行しました。");
              }}
            >
              アカウント発行
            </button>
            <label>
              再発行対象
              <select value={resetTargetLoginId} onChange={(event) => setResetTargetLoginId(event.target.value)}>
                <option value="">選択してください</option>
                {facilitatorAccounts.map((account) => (
                  <option key={account.loginId} value={account.loginId}>
                    {account.displayName} ({account.loginId})
                  </option>
                ))}
              </select>
            </label>
            <label>
              新しい仮パスワード
              <input value={resetTemporaryPassword} onChange={(event) => setResetTemporaryPassword(event.target.value)} />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                await onResetFacilitatorPassword(resetTargetLoginId, resetTemporaryPassword);
                setResetTargetLoginId("");
                setResetTemporaryPassword("");
                setAccountMessage("仮パスワードを再発行しました。");
              }}
              disabled={!resetTargetLoginId}
            >
              仮パスワード再発行
            </button>
            <div className="account-list">
              {facilitatorAccounts.map((account) => (
                <div key={account.loginId} className="account-row">
                  <strong>{account.displayName}</strong>
                  <span>{account.loginId}</span>
                  <span>{account.role === "admin" ? "管理者" : "ファシリ"}</span>
                  <span>{account.mustChangePassword ? "初回変更待ち" : "利用中"}</span>
                  <span>{account.lastLoginAt ? `最終ログイン: ${new Date(account.lastLoginAt).toLocaleString("ja-JP")}` : "最終ログイン: なし"}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
