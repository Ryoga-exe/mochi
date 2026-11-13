import { Button, ColorSchemeScript, MantineProvider, mantineHtmlProps, Title } from "@mantine/core";
import mantineStyles from "@mantine/core/styles.css?url";
import { ModalsProvider } from "@mantine/modals";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import classes from "src/styles/layout.module.css";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: mantineStyles }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "mochi" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  errorComponent: ({ reset }) => (
    <main className={classes.standalone}>
      <Title order={1}>読み込みできませんでした。</Title>
      <p>接続と設定を確認してから、もう一度お試しください。</p>
      <Button type="button" onClick={reset}>
        再試行
      </Button>
    </main>
  ),
  notFoundComponent: () => <main>ページが見つかりません。</main>,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
        <HeadContent />
      </head>
      <body>
        <MantineProvider forceColorScheme="light">
          <ModalsProvider
            labels={{ confirm: "確認", cancel: "キャンセル" }}
            modalProps={{ closeButtonProps: { "aria-label": "閉じる" } }}
          >
            <div className={classes.page}>{children}</div>
          </ModalsProvider>
        </MantineProvider>
        <Scripts />
      </body>
    </html>
  );
}
