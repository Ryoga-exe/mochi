import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const result = spawnSync(process.execPath, [fileURLToPath(new URL("node_modules/vite/bin/vite.js", root)), "build"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production", CLOUDFLARE_ENV: "production" },
  stdio: "inherit",
});
// The Vite plugin copies local secrets for `vite preview`. Production artifacts use Worker secrets instead.
await rm(new URL("dist/server/.dev.vars", root), { force: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
