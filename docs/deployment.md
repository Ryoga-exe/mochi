# Cloudflare へのデプロイ

本番は `https://mochi.ryoga.dev` です。R2 の公開ドメインは `https://mochi-assets.ryoga.dev`。アプリの画像 URL は Worker 経由のままで、R2 の直接アクセスはバケットの公開設定に従います。

## 設定の管理

Wrangler 設定は Git で管理しません。`scripts/worker-config.ts` が各コマンドの実行時に `wrangler.json` を生成します。これは `.gitignore` の対象で、手で編集する必要はありません。

本番固有の値は GitHub リポジトリの **Settings → Environments → production → Variables** で管理します。

| Variable                    | 内容                                      |
| --------------------------- | ----------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`     | Cloudflare の Account ID                  |
| `CLOUDFLARE_D1_DATABASE_ID` | 本番 D1 の ID                             |
| `BETTER_AUTH_URL`           | 本番の HTTPS オリジン（末尾 `/` なし）    |
| `PUBLIC_OWNER_NAME`         | QR ページの持ち主の表示名（既定 `Ryoga`） |
| `CLOUDFLARE_R2_BUCKET`      | R2 バケット名（既定 `mochi-assets`）      |

Worker 名は `mochi`、D1 名は `mochi`、独自ドメインは `BETTER_AUTH_URL` のホスト名から設定します。ローカルは `mochi-local` と Wrangler のローカル D1 / R2 を使います。ローカルの DB・画像は本番へ移行しません。

手元から本番デプロイを行う場合は `.env.example` を `.env.production.local` にコピーして同じ値を設定します。このファイルも Git で管理しません。環境変数が既に設定されている場合は、そちらが優先されます。

```shell
cp .env.example .env.production.local
pnpm exec wrangler login
pnpm deploy
```

開発用の認証情報は従来どおり `.dev.vars` に設定します。

## Cloudflare 側の初回設定

1. Worker `mochi`、D1 `mochi`、R2 `mochi-assets` を作成します。
2. Worker の独自ドメインを設定し、上記の本番変数を GitHub に登録します。
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

デプロイ用には **production → Secrets** に `CLOUDFLARE_API_TOKEN` を登録します。対象アカウントの Workers・D1・R2 を扱え、独自ドメインに必要な Workers Routes の編集権限を持つ Token を使います。[API Token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

**Repository variable** `DEPLOY_ON_PUSH=true` で main への push 後、チェック成功時に `Deploy` が動きます。手動では **Actions → CI → Run workflow → main** から実行できます。production Environment は main だけからデプロイできるように設定します。

デプロイは本番ビルド → 設定確認 → リモート D1 マイグレーション → Worker と静的ファイルの公開の順です。仮の D1 ID・URL のままなら本番への操作前に止まります。同時実行は1件に限定し、後続の push で実行中のマイグレーションをキャンセルしません。

## ローカルでの確認

```shell
pnpm check
pnpm test
pnpm build             # ローカルの認証情報で preview するためのビルド
pnpm preview
pnpm build:production  # 本番設定でビルド。公開・DB 更新は行わない
pnpm deploy:check
pnpm exec wrangler deploy --dry-run --config dist/server/wrangler.json
```

本番ビルドは React の production モードを選び、プレビュー用に複製された `.dev.vars` を成果物から除きます。Worker Secrets は実行時に供給します。

`pnpm deploy` はマイグレーションと公開を実行します。マイグレーションだけ行う場合も、先に `pnpm build:production` で本番用設定を生成し、`pnpm db:migrate:production` を実行してください。

## 更新と確認

- GitHub ログインと、管理者以外のアクセス拒否を確認します。
- 管理画面の画像 URL は未ログインで取得できないことを確認します。R2 の公開ドメインは別の配信経路です。
- QR ページと uses API の公開・非公開切り替えを確認します。

後続のマイグレーションは旧 Worker と互換性を保つ形にします。Worker のデプロイが失敗しても適用済みマイグレーションは残り、コードの rollback は DB を巻き戻しません。[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

ドメイン変更時は `BETTER_AUTH_URL` と OAuth callback URL を更新し、uses の公開設定も保存し直してください。QR ラベルの生成はテプラなど外部のツールで行います。
