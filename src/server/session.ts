import { and, eq } from "drizzle-orm";
import { type AuthEnv, getAuth } from "./auth";
import { getDb } from "./db";
import { account } from "./db/schema";

export async function getAdministrator(env: AuthEnv, headers: Headers) {
  const session = await getAuth(env).api.getSession({ headers });
  if (!session) return null;
  // Recheck the provider account on every request, including existing sessions.
  const [administrator] = await getDb(env.DB)
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "github"),
        eq(account.accountId, env.ADMIN_GITHUB_ID ?? ""),
      ),
    )
    .limit(1);
  return administrator ? { id: session.user.id, name: session.user.name } : null;
}
