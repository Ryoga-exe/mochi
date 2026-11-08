import { migrate } from "drizzle-orm/d1/migrator";
import { getDb } from "src/server/db";
import { getPlatformProxy } from "wrangler";

export async function testDatabase() {
  const proxy = await getPlatformProxy<Cloudflare.Env>({ configPath: "wrangler.jsonc", persist: false });
  try {
    await migrate(getDb(proxy.env.DB), { migrationsFolder: "drizzle" });
    return proxy;
  } catch (error) {
    await proxy.dispose();
    throw error;
  }
}
