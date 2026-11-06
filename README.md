# mochi

物品管理をする個人用のアプリです

## Stack

- TypeScript / React / TanStack Start / Vite
- Cloudflare Workers / D1 / R2
- Drizzle ORM / Better Auth (GitHub OAuth)
- pnpm / Biome

## Development

Node.js 22.12+ と pnpm を使用します。

```shell
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate
pnpm dev
```

<http://localhost:3000> で起動します。

GitHub 認証を使う場合は `.dev.vars` に OAuth の情報、管理者の GitHub 数値 ID、認証用 Secret を設定してください。
OAuth App の callback URL は `http://localhost:3000/api/auth/callback/github` です。

ログイン後、物品の登録・検索・編集、場所の管理ができます。
「収納先として使う」をオンにした物品に収納でき、入れ物を移動すると中身の所在表示も変わります。
タグはカンマ区切りで設定でき、一覧から検索・絞り込みできます。
管理番号は登録年（日本時間）を含む `M-2026-000001` の形式で自動発行されます。連番は年をまたいで継続します。
`/i/M-2026-000001` で参照でき、発行済みの年なし番号・URLもそのまま利用できます。

```shell
pnpm check        # 書式・Lint・型を検査
pnpm format       # フォーマット
pnpm lint:fix     # 自動修正できる Lint 指摘を直す
pnpm build        # ビルド
pnpm test         # D1・認証・収納のテスト（本番・ローカルの台帳には影響しません）
pnpm preview      # ビルド結果をローカルで確認
pnpm db:generate  # スキーマからマイグレーションを生成
pnpm db:migrate   # ローカル D1 に適用
```
