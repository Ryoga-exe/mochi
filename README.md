# mochi

物品管理をする個人用のアプリです

## Stack

- TypeScript / React / TanStack Start / Vite
- Mantine / CSS Modules
- Cloudflare Workers / D1 / R2
- Drizzle ORM / Better Auth (GitHub OAuth)
- pnpm / Biome

## Development

Node.js 24（`.node-version`）と pnpm を使用します。

```shell
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate
pnpm dev
```

<http://localhost:3000> で起動します。

GitHub 認証を使う場合は `.dev.vars` に OAuth の情報、管理者の GitHub 数値 ID、認証用 Secret を設定してください。
OAuth App の callback URL は `http://localhost:3000/api/auth/callback/github` です。

```shell
pnpm check        # 書式・Lint・型を検査
pnpm format       # フォーマット
pnpm lint:fix     # 自動修正できる Lint 指摘を直す
pnpm build        # ビルド
pnpm test         # D1・認証・画像・公開 API のテスト
pnpm preview      # ビルド結果をローカルで確認
pnpm db:generate  # スキーマからマイグレーションを生成
pnpm db:migrate   # ローカル D1 に適用
```

画像の追加・公開用 Markdown・uses API は [uses API](docs/uses-api.md) を参照してください。
物品ごとの公開範囲と未ログイン時の表示は [QR ページ](docs/qr-pages.md) を参照してください。
CI/CD と本番の設定・初回公開手順は [Cloudflare へのデプロイ](docs/deployment.md) を参照してください。
