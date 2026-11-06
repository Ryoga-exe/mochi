import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "mochi" },
      { name: "description", content: "持ち物と、その居場所を管理する。" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  errorComponent: ({ reset }) => (
    <main>
      <h1>読み込みできませんでした。</h1>
      <p>接続と設定を確認してから、もう一度お試しください。</p>
      <button type="button" onClick={reset}>
        再試行
      </button>
    </main>
  ),
  notFoundComponent: () => <main>ページが見つかりません。</main>,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
