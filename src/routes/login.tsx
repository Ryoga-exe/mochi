import { Alert, Button, Title } from "@mantine/core";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { getViewer } from "src/functions/inventory";
import { authClient } from "src/lib/auth-client";
import { parseItemCode } from "src/lib/public-item";
import classes from "src/styles/layout.module.css";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({
    error: z.string().optional().catch(undefined),
    item: z
      .string()
      .refine((value) => parseItemCode(value) !== null)
      .optional()
      .catch(undefined),
  }),
  beforeLoad: async ({ search }) => {
    if (await getViewer())
      throw redirect(search.item ? { to: "/items/$code", params: { code: search.item } } : { to: "/" });
  },
  headers: () => ({ "Cache-Control": "private, no-store" }),
  component: Login,
});

function Login() {
  const search = Route.useSearch();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: search.item ? `/i/${search.item}` : "/",
        errorCallbackURL: search.item ? `/login?item=${encodeURIComponent(search.item)}` : "/login",
      });
      if (result.error) throw new Error("ログインできませんでした。");
    } catch {
      setError("ログインを開始できませんでした。設定と接続を確認してください。");
      setPending(false);
    }
  }

  return (
    <main className={classes.standalone}>
      <Title order={1}>mochi</Title>
      {(error || search.error) && (
        <Alert color="red">{error || "ログインできませんでした。許可されたアカウントか確認してください。"}</Alert>
      )}
      <Button type="button" onClick={signIn} loading={pending}>
        {pending ? "GitHub に移動しています…" : "GitHub でログイン"}
      </Button>
    </main>
  );
}
