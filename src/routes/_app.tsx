import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getViewer } from "src/functions/inventory";
import { authClient } from "src/lib/auth-client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const viewer = await getViewer();
    if (!viewer) throw redirect({ to: "/login" });
    return { viewer };
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: App,
});

function App() {
  const { viewer } = Route.useRouteContext();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("ログアウトできませんでした。");
      window.location.assign("/login");
    } catch {
      setError("ログアウトできませんでした。もう一度お試しください。");
      setPending(false);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="app-header">
        <h1>
          <Link to="/">mochi</Link>
        </h1>
        <nav aria-label="メイン">
          <Link to="/" activeOptions={{ exact: true }}>
            物品一覧
          </Link>
          <Link to="/items/new">物品を登録</Link>
          <Link to="/locations">場所を管理</Link>
        </nav>
        <p>
          {viewer.name}{" "}
          <button type="button" onClick={signOut} disabled={pending}>
            ログアウト
          </button>
        </p>
        {error && <p role="alert">{error}</p>}
      </header>
      <main id="main-content" tabIndex={-1} aria-busy={navigating}>
        <Outlet />
      </main>
    </>
  );
}
