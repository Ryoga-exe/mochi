export type DeploymentConfig = {
  name?: string;
  vars?: Record<string, unknown>;
  d1_databases?: { binding: string; database_id: string }[];
  r2_buckets?: { binding: string; bucket_name: string }[];
};

export function validateDeployment(config: DeploymentConfig) {
  const errors: string[] = [];
  if (config.name !== "mochi") errors.push("本番用ビルドではありません。pnpm build:production を実行してください。");
  const databaseId = config.d1_databases?.find((database) => database.binding === "DB")?.database_id;
  if (
    !databaseId ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(databaseId) ||
    /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(databaseId)
  )
    errors.push("wrangler.jsonc の env.production.d1_databases に作成済み D1 の database_id を設定してください。");
  if (!config.r2_buckets?.some((bucket) => bucket.binding === "ASSETS_BUCKET" && bucket.bucket_name))
    errors.push("本番用の ASSETS_BUCKET バインディングを設定してください。");
  try {
    const value = config.vars?.BETTER_AUTH_URL;
    if (typeof value !== "string") throw new Error();
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname.endsWith(".invalid") ||
      url.hostname === "localhost" ||
      url.origin !== value
    )
      throw new Error();
  } catch {
    errors.push("env.production.vars.BETTER_AUTH_URL に本番の HTTPS オリジンを設定してください（末尾の / は不要）。");
  }
  if (typeof config.vars?.PUBLIC_OWNER_NAME !== "string" || !config.vars.PUBLIC_OWNER_NAME.trim())
    errors.push("env.production.vars.PUBLIC_OWNER_NAME に持ち主の表示名を設定してください。");
  return errors;
}
