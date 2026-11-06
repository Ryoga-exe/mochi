# Cloudflare へのデプロイ

Cloudflare Workers に TanStack Start をデプロイし、D1 と非公開の R2 バケットをバインドします。設定は `wrangler.jsonc` の `env.production` にまとめています。

| 環境                 | Worker 名     | DB / 画像                   |
| -------------------- | ------------- | --------------------------- |
| ローカル（既定）     | `mochi-local` | Wrangler のローカル D1 / R2 |
| 本番（`production`） | `mochi`       | 作成した Cloudflare D1 / R2 |

`pnpm dev` と既存の `.dev.vars` は引き続きローカル用です。ローカルの DB・画像・認証情報は本番へ移行しません。

## 初回セットアップ

### 1. Cloudflare のリソースを作成

ダッシュボードで Workers のサブドメインを設定し、Worker `mochi` を作成します。最初は Hello World で構いません。この Worker に後述の Secrets を登録します。

CLI で操作する場合は、リポジトリでログインしてから D1 と R2 を作成します。ダッシュボードから作成しても構いません。

```shell
pnpm exec wrangler login
pnpm exec wrangler d1 create mochi --location apac
pnpm exec wrangler r2 bucket create mochi-assets
```

R2 の利用を有効にし、バケットの公開アクセス（`r2.dev`・カスタムドメイン）は無効のままにします。画像は Worker 経由で配信するため、R2 用の S3 キーや公開 URL は不要です。

### 2. 本番の設定値を記入

`wrangler.jsonc` の **`env.production` 内だけ**を変更します。

| 設定                          | 値                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `d1_databases[0].database_id` | 作成した `mochi` の D1 ID                                                             |
| `vars.BETTER_AUTH_URL`        | 公開する HTTPS オリジン。例：`https://mochi.<subdomain>.workers.dev`（末尾 `/` なし） |
| `vars.PUBLIC_OWNER_NAME`      | QR ページで表示する名前。既定は `Ryoga`                                               |

D1 ID と公開 URL は秘密情報ではないためコミットします。既定のローカル設定の D1 ID は変更不要です。仮の D1 ID・URL のまま `pnpm deploy` すると、本番への操作前に停止します。

独自ドメインを使う場合は `env.production.routes` に `{ "pattern": "mochi.example.com", "custom_domain": true }` を追加し、`BETTER_AUTH_URL` もそのオリジンに合わせます。以降 `workers.dev` を使わない場合は `env.production.workers_dev` を `false` にします。[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

### 3. GitHub OAuth と Worker Secrets を設定

本番で使う GitHub OAuth App の Homepage URL を公開オリジン、Authorization callback URL を `<公開オリジン>/api/auth/callback/github` にします。開発用と分けて OAuth App を用意すると、それぞれの認証設定を管理できます。

Cloudflare の Worker **`mochi` → Settings → Variables and Secrets** に、次の4つを **Secret** として登録します。GitHub Actions に OAuth の値を渡す必要はありません。

| Secret                 | 内容                                                 |
| ---------------------- | ---------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | `openssl rand -base64 32` などで生成した本番専用の値 |
| `GITHUB_CLIENT_ID`     | 本番 OAuth App の Client ID                          |
| `GITHUB_CLIENT_SECRET` | 本番 OAuth App の Client Secret                      |
| `ADMIN_GITHUB_ID`      | 管理者の GitHub 数値 ID（ユーザー名ではありません）  |

CLI では各値を対話入力できます。値をコマンド引数やリポジトリに書かないでください。

```shell
pnpm exec wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc --env production
pnpm exec wrangler secret put GITHUB_CLIENT_ID --config wrangler.jsonc --env production
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.jsonc --env production
pnpm exec wrangler secret put ADMIN_GITHUB_ID --config wrangler.jsonc --env production
```

`BETTER_AUTH_URL` と `PUBLIC_OWNER_NAME` は `wrangler.jsonc` で管理します。ダッシュボードだけで変更すると次のデプロイで設定ファイルの値に戻ります。Secrets は通常のデプロイでも保持され、未登録の必須 Secrets は Wrangler が検出します。[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

### 4. 初回デプロイ

ローカルから実行する場合：

```shell
pnpm check
pnpm test
pnpm deploy
```

`pnpm deploy` は本番ビルド → 設定確認 → **リモート D1 へのマイグレーション適用** → Worker と静的ファイルの公開を行います。本番の操作を行わずビルドを確認する場合は次を使います。

```shell
pnpm build:production
pnpm exec wrangler deploy --dry-run --config dist/server/wrangler.json
```

`pnpm build` / `pnpm preview` は従来どおりローカルの確認用です。本番用には `pnpm build:production` を使います。このコマンドは本番環境と React の production モードを選択し、プレビュー用に複製された `.dev.vars` を成果物から取り除きます。Worker の Secrets は実行時に供給します。

## GitHub Actions

`.github/workflows/ci.yml` の `Check` は PR・main への push・手動実行で動作します。Node.js 24 と `packageManager` で指定した pnpm を使い、次を検証します。

- frozen lockfile による依存のインストール
- Format / Lint / 型チェックと D1・認証・画像・公開処理のテスト
- スキーマとマイグレーション、生成したルートの整合性
- 本番ビルドと Wrangler の dry run

CI に Cloudflare や OAuth の認証情報は不要です。Actions はコミット SHA で固定し、Dependabot が Actions と依存パッケージの更新 PR を作成します。main のブランチ保護で `Check` を必須にできます。

Actions からデプロイする場合は GitHub リポジトリの **Settings → Environments → production** を作成し、次を設定します。

| 種別                 | 名前                    | 値                                |
| -------------------- | ----------------------- | --------------------------------- |
| Environment secret   | `CLOUDFLARE_API_TOKEN`  | デプロイ用の Cloudflare API Token |
| Environment variable | `CLOUDFLARE_ACCOUNT_ID` | 対象の Cloudflare Account ID      |

Token は対象アカウントに限定します。`Edit Cloudflare Workers` テンプレートを使い、マイグレーション用に D1 の編集権限を追加してください。独自ドメインを設定する場合は、そのゾーンの Workers Routes の編集権限も必要です。[Token templates](https://developers.cloudflare.com/fundamentals/api/reference/template/)、[Token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/)

Actions の **CI → Run workflow → main** で、チェック成功後に `Deploy` が動きます。初期状態では main への push だけではデプロイしません。自動デプロイを使うときは、**Repository variable** `DEPLOY_ON_PUSH` を `true` にします（Environment variable ではありません）。production Environment のデプロイ対象ブランチは main に制限できます。

デプロイは同時に1件だけ実行し、後続の push で実行中のマイグレーションをキャンセルしません。Cloudflare 側の Workers Builds を併用する必要はありません。

## デプロイ後の確認と更新

- GitHub ログインと、許可した管理者以外のアクセス拒否を確認します。
- 画像を追加し、ログアウト状態で非公開画像が見えないことを確認します。
- QR ページと uses API の公開・非公開の切り替えを確認します。

後続のマイグレーションは、適用中に動いている旧 Worker と互換性を保つ形にします。Worker のデプロイが失敗しても適用済みの DB マイグレーションは残ります。Worker の rollback は DB を巻き戻しません。DB の復旧が必要な場合は D1 の Time Travel / バックアップを別途使用します。[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)

公開ドメインを変更した場合は OAuth の callback URL と `BETTER_AUTH_URL` を更新し、uses の公開設定も保存し直してください（画像の絶対 URL を更新するため）。QR ラベルの生成はテプラなど外部のツールで行います。
