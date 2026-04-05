import { useState } from "react";
import type { FacilitatorAuthUser } from "../hooks/useFacilitatorAuth";
import type { JoinPayload } from "../hooks/useGameSocket";

interface LobbyFacilitatorAccountSummary {
  loginId: string;
  displayName: string;
  role: "admin" | "facilitator";
  accessKeys: {
    primary: string;
    backup: string;
  };
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface LobbyProps {
  variant: "admin" | "facilitator" | "player";
  accessKey?: string;
  initialRoomId?: string;
  fixedRoomSlot?: "a" | "b";
  inviterName?: string;
  onOpenFacilitatorRoom: (slot: "a" | "b") => Promise<unknown>;
  onCreateRoom: (payload: JoinPayload) => Promise<unknown>;
  onJoinRoom: (payload: JoinPayload) => Promise<unknown>;
  authUser: FacilitatorAuthUser | null;
  authLoading: boolean;
  authError?: string;
  facilitatorAccounts: LobbyFacilitatorAccountSummary[];
  onLogin: (loginId: string, password: string) => Promise<boolean>;
  onLoginWithAccessKey: (accessKey: string, password: string) => Promise<boolean>;
  onLogout: () => Promise<void> | void;
  onChangePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  onCreateFacilitatorAccount: (loginId: string, displayName: string, temporaryPassword: string) => Promise<void>;
  onResetFacilitatorPassword: (loginId: string, temporaryPassword: string) => Promise<void>;
  onRegenerateAccessLink: (loginId: string, slot: "primary" | "backup") => Promise<void>;
  errorMessage?: string;
}

export const Lobby = ({
  variant,
  accessKey,
  initialRoomId,
  fixedRoomSlot,
  inviterName,
  onOpenFacilitatorRoom,
  onCreateRoom,
  onJoinRoom,
  authUser,
  authLoading,
  authError,
  facilitatorAccounts,
  onLogin,
  onLoginWithAccessKey,
  onLogout,
  onChangePassword,
  onCreateFacilitatorAccount,
  onResetFacilitatorPassword,
  onRegenerateAccessLink,
  errorMessage,
}: LobbyProps) => {
  const [joinName, setJoinName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId ?? "");
  const [joinAvatarUrl, setJoinAvatarUrl] = useState("");
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
          {variant === "admin"
            ? "管理人ページです。"
            : variant === "facilitator"
              ? "ファシリページです。専用URLでログインし、固定2ルームを使って進行します。"
              : "プレイヤーページです。共有URLからそのまま参加できます。"}
        </p>
      </div>

      <div className="lobby-grid">
        {variant === "facilitator" ? (
          <section className="panel facilitator-entry-panel">
            <h2>ファシリ入口</h2>

            <form
              className="facilitator-auth-form"
              autoComplete="off"
              onSubmit={async (event) => {
                event.preventDefault();
                const ok = accessKey ? await onLoginWithAccessKey(accessKey, password) : await onLogin(loginId, password);
                if (ok) {
                  setPassword("");
                  setAccountMessage("ログインしました。固定ルームを選択してください。");
                }
              }}
            >
              <h3>1. ログイン</h3>
              {authUser ? (
                <>
                  <p className="mode-caption">ログイン中: {authUser.displayName}</p>
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
                  {!accessKey ? (
                    <label>
                      ログインID
                      <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
                    </label>
                  ) : (
                    <p className="mode-caption">専用URLでアクセス中です。パスワードを入力してください。</p>
                  )}
                  <label>
                    パスワード
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                  </label>
                  <button type="submit" disabled={authLoading}>
                    ファシリログイン
                  </button>
                </>
              )}
            </form>

            <section className="facilitator-room-form">
              <h3>2. 固定ルームを選択</h3>
              <div className="inline-actions">
                <button type="button" disabled={!authUser} onClick={() => void onOpenFacilitatorRoom("a")}>
                  ルームAに入室
                </button>
                <button type="button" disabled={!authUser} onClick={() => void onOpenFacilitatorRoom("b")}>
                  ルームBに入室
                </button>
              </div>
              {authUser?.accessKeys ? (
                <div className="account-list">
                  <div className="account-row">
                    <strong>プレイヤーURL（A）</strong>
                    <span>{`${window.location.origin}/player/${authUser.accessKeys.primary}/a`}</span>
                  </div>
                  <div className="account-row">
                    <strong>プレイヤーURL（B）</strong>
                    <span>{`${window.location.origin}/player/${authUser.accessKeys.primary}/b`}</span>
                  </div>
                </div>
              ) : null}
            </section>
            {authError ? <p className="error-text">{authError}</p> : null}
            {accountMessage ? <p className="mode-caption">{accountMessage}</p> : null}
          </section>
        ) : null}

        {variant === "player" ? (
          <form
            className="panel"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              void onJoinRoom({
                roomId: initialRoomId || joinRoomId,
                name: joinName,
                avatarUrl: joinAvatarUrl || undefined,
                isFacilitator: false,
              });
            }}
          >
            <h2>プレイヤー参加</h2>
            {inviterName ? <p className="mode-caption">招待元: {inviterName}</p> : null}
            {fixedRoomSlot ? <p className="mode-caption">接続先: ルーム{fixedRoomSlot.toUpperCase()}</p> : null}
            {!initialRoomId ? (
              <label>
                ルームID
                <input value={joinRoomId} onChange={(event) => setJoinRoomId(event.target.value.toUpperCase())} />
              </label>
            ) : null}
            <label>
              名前
              <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
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
            <button type="submit">ルームに参加する</button>
            {authError ? <p className="error-text">{authError}</p> : null}
          </form>
        ) : null}

        {variant === "admin" ? (
          <section className="panel">
            <h2>管理人ページ</h2>
            {!authUser ? (
              <form
                className="facilitator-auth-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const ok = await onLogin(loginId, password);
                  if (ok) {
                    setPassword("");
                  }
                }}
              >
                <label>
                  ログインID
                  <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
                </label>
                <label>
                  パスワード
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </label>
                <button type="submit">ログイン</button>
              </form>
            ) : (
              <>
                <div className="inline-actions">
                  <span className="mode-badge demo">ログイン中: {authUser.displayName}</span>
                  <button type="button" className="secondary" onClick={() => void onLogout()}>
                    ログアウト
                  </button>
                </div>

                <h3>ファシリアカウント管理</h3>
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
                      <span>Primary: {account.accessKeys.primary}</span>
                      <span>Backup: {account.accessKeys.backup}</span>
                      <div className="inline-actions">
                        <button type="button" className="secondary" onClick={() => void onRegenerateAccessLink(account.loginId, "primary")}>
                          Primary URL再発行
                        </button>
                        <button type="button" className="secondary" onClick={() => void onRegenerateAccessLink(account.loginId, "backup")}>
                          Backup URL再発行
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {authError ? <p className="error-text">{authError}</p> : null}
            {accountMessage ? <p className="mode-caption">{accountMessage}</p> : null}
          </section>
        ) : null}
      </div>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
};
