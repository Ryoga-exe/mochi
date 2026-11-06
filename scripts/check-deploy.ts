import { readFile } from "node:fs/promises";
import { validateDeployment } from "./deployment.ts";

const config = JSON.parse(await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
const errors = validateDeployment(config);
if (errors.length) {
  for (const message of errors) console.error(message);
  process.exit(1);
}
console.log("本番のデプロイ先設定を確認しました。");
