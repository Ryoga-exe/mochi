import { readdir, readFile } from "node:fs/promises";
import { getPlatformProxy } from "wrangler";

export async function applyMigrations(database: D1Database, include: (name: string) => boolean = () => true) {
  const files = (await readdir("drizzle")).filter((name) => name.endsWith(".sql") && include(name)).sort();
  for (const file of files) {
    const source = await readFile(`drizzle/${file}`, "utf8");
    for (const statement of source.split("--> statement-breakpoint").filter((sql) => sql.trim())) {
      await database.prepare(statement).run();
    }
  }
}

export async function testDatabase(include?: (name: string) => boolean) {
  const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: "wrangler.json", persist: false });
  try {
    await applyMigrations(proxy.env.DB, include);
    return proxy;
  } catch (error) {
    await proxy.dispose();
    throw error;
  }
}
