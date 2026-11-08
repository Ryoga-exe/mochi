# Cloudflare へのデプロイ

本番は `https://mochi.ryoga.dev` です。R2 の公開ドメインは `https://mochi-assets.ryoga.dev`。アプリの画像 URL は Worker 経由のままで、R2 の直接アクセスはバケットの公開設定に従います。

## 設定の管理

`wrangler.jsonc` を Git で管理します。トップレベルはローカル開発、`env.production` は本番用です。Worker 名・ドメイン・D1・R2・公開用の環境変数をここに定義します。

ローカルは `mochi-local` と Wrangler のローカル D1 / R2 を使います。本番は Worker `mochi`、D1 `mochi`、R2 `mochi-assets` を使います。ローカルの DB・画像は本番へ移行しません。

手元からの本番デプロイは Wrangler のログイン後に実行できます。

```shell
pnpm exec wrangler login
pnpm deploy
```

開発用の認証情報は `.dev.vars`、本番用は Cloudflare の Worker Secrets に設定します。

## Cloudflare 側の初回設定

1. Worker `mochi`、D1 `mochi`、R2 `mochi-assets` を作成します。
2. `wrangler.jsonc` の `env.production` に作成済みリソースの情報と独自ドメインを設定します。
3. GitHub OAuth App の Homepage URL を本番オリジン、callback URL を `<本番オリジン>/api/auth/callback/github` にします。
4. Worker **mochi → Settings → Variables and Secrets** に次の4つを Secret として登録します。

| Worker Secret          | 内容                                                 |
| ---------------------- | ---------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32` などで生成した本番専用の値 |
| `GITHUB_CLIENT_ID`     | 本番 OAuth App の Client ID                          |
| `GITHUB_CLIENT_SECRET` | 本番 OAuth App の Client Secret                      |
| `ADMIN_GITHUB_ID`      | 管理者の GitHub 数値 ID（ユーザー名ではありません）  |

これらの OAuth Secrets を GitHub Actions に渡す必要はありません。通常のデプロイでも保持され、必須 Secret が未登録なら Wrangler が検出します。[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## GitHub Actions

PR・main への push・手動実行で `Check` が動きます。Node.js 24 と固定した pnpm を使い、frozen lockfile によるインストール、Format / Lint / 型チェック、テスト、生成ファイルの整合性、本番ビルド、Wrangler の dry run を確認します。チェックに Cloudflare や OAuth の認証情報は不要です。

デプロイ用には **production → Variables** に `CLOUDFLARE_ACCOUNT_ID`、**production → Secrets** に `CLOUDFLARE_API_TOKEN` を登録します。Token は対象アカウントの Workers・D1・R2 と、独自ドメインの Workers Routes に必要な権限を持つものを使います。[API Token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

**Repository variable** `DEPLOY_ON_PUSH=true` で main への push 後、チェック成功時に `Deploy` が動きます。手動では **Actions → CI → Run workflow → main** から実行できます。production Environment は main だけからデプロイできるように設定します。

デプロイは本番ビルド → リモート D1 マイグレーション → Worker と静的ファイルの公開の順です。同時実行は1件に限定し、後続の push で実行中のマイグレーションをキャンセルしません。

## ローカルでの確認

```shell
pnpm check
pnpm test
pnpm build             # ローカルで preview するためのビルド
pnpm preview
pnpm build:production  # 本番設定でビルド。公開・DB 更新は行わない
pnpm exec wrangler deploy --dry-run
```

`pnpm build:production` は `CLOUDFLARE_ENV=production` で本番の設定を選びます。Vite プラグインがビルド結果と出力用の Wrangler 設定を生成し、`wrangler deploy` はその出力を自動で使います。[Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)

`.dev.vars` がビルド先に複製される場合も、ローカルのプレビュー用で、デプロイには含まれません。本番の認証情報は Worker Secrets から実行時に供給します。

`pnpm deploy` はビルド・マイグレーション・公開を実行します。マイグレーションだけ行う場合は `pnpm db:migrate:production` を使います。このコマンドは `--env production --remote` で本番 D1 を指定するため、事前のビルドは不要です。

## 更新と確認

`drizzle/0000_init.sql` は、初期開発時の履歴を統合した初期スキーマです。既存の本番・ローカル DB はデータを保持して切り替え、ローカルの年なし物品には作成日時の日本時間の年を補完しています。適用済みの旧履歴は D1 内に保持し、新しい初期 SQL を適用済みとして登録しています。

今後のスキーマ変更は `pnpm db:generate` で追加のマイグレーションを生成します。トリガーの変更は `pnpm exec drizzle-kit generate --custom --name=変更名` で SQL を追加します。Drizzle のスナップショットにはトリガーが含まれないため、SQLite のテーブルを再作成する変更では、そのテーブルに関係するトリガーの復元も SQL に含めます。

- GitHub ログインと、管理者以外のアクセス拒否を確認します。
- 管理画面の画像 URL は未ログインで取得できないことを確認します。R2 の公開ドメインは別の配信経路です。
- QR ページと uses API の公開・非公開切り替えを確認します。

後続のマイグレーションは旧 Worker と互換性を保つ形にします。Worker のデプロイが失敗しても適用済みマイグレーションは残り、コードの rollback は DB を巻き戻しません。[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

ドメイン変更時は `wrangler.jsonc` の `routes`・`BETTER_AUTH_URL` と OAuth callback URL を更新し、uses の公開設定も保存し直してください。QR ラベルの生成はテプラなど外部のツールで行います。
