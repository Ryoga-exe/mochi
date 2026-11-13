import { Alert, Anchor, Button, Title } from "@mantine/core";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { getViewer } from "src/functions/inventory";
import { authClient } from "src/lib/auth-client";
import classes from "src/styles/layout.module.css";

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
      <Anchor className={classes.skipLink} href="#main-content">
        本文へ移動
      </Anchor>
      <header className={classes.header}>
        <Title order={1} className={classes.brand}>
          <Anchor inherit renderRoot={(props) => <Link {...props} to="/" />}>
            mochi
          </Anchor>
        </Title>
        <nav className={classes.navigation} aria-label="メイン">
          <Anchor renderRoot={(props) => <Link {...props} to="/" activeOptions={{ exact: true }} />}>物品一覧</Anchor>
          <Anchor renderRoot={(props) => <Link {...props} to="/locations" />}>場所を管理</Anchor>
        </nav>
        <div className={classes.account}>
          {viewer.name}{" "}
          <Button type="button" variant="default" onClick={signOut} loading={pending}>
            ログアウト
          </Button>
        </div>
        {error && <Alert color="red">{error}</Alert>}
      </header>
      <main className={classes.content} id="main-content" tabIndex={-1} aria-busy={navigating}>
        <Outlet />
      </main>
    </>
  );
}
