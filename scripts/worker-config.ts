import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { pathToFileURL } from "node:url";

export function workerConfig(production: boolean, values: Record<string, string | undefined> = process.env) {
  const origin = production ? values.BETTER_AUTH_URL || "https://replace-me.invalid" : undefined;
  return {
    $schema: "node_modules/wrangler/config-schema.json",
    name: production ? "mochi" : "mochi-local",
    ...(production && values.CLOUDFLARE_ACCOUNT_ID ? { account_id: values.CLOUDFLARE_ACCOUNT_ID } : {}),
    main: "@tanstack/react-start/server-entry",
    compatibility_date: "2026-11-06",
    compatibility_flags: ["nodejs_compat"],
    workers_dev: false,
    preview_urls: false,
    ...(origin ? { routes: [{ pattern: new URL(origin).hostname, custom_domain: true }] } : {}),
    vars: {
      PUBLIC_OWNER_NAME: production ? values.PUBLIC_OWNER_NAME || "Ryoga" : "Ryoga",
      ...(origin ? { BETTER_AUTH_URL: origin } : {}),
    },
    ...(production
      ? { secrets: { required: ["BETTER_AUTH_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "ADMIN_GITHUB_ID"] } }
      : {}),
    observability: { enabled: true },
    d1_databases: [
      {
        binding: "DB",
        database_name: "mochi",
        database_id: production
          ? values.CLOUDFLARE_D1_DATABASE_ID || "00000000-0000-0000-0000-000000000000"
          : "00000000-0000-0000-0000-000000000000",
        migrations_dir: "drizzle",
      },
    ],
    r2_buckets: [
      {
        binding: "ASSETS_BUCKET",
        bucket_name: production ? values.CLOUDFLARE_R2_BUCKET || "mochi-assets" : "mochi-assets",
      },
    ],
  };
}

export async function writeWorkerConfig(production = false) {
  const root = new URL("../", import.meta.url);
  const envFile = new URL(".env.production.local", root);
  if (production && existsSync(envFile)) loadEnvFile(envFile);
  await writeFile(new URL("wrangler.json", root), `${JSON.stringify(workerConfig(production), null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await writeWorkerConfig();
