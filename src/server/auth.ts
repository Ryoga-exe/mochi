import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db";

type AuthEnv = Pick<Cloudflare.Env, "DB"> & {
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_GITHUB_ID?: string;
};

export function getAuth(env: AuthEnv) {
  const { BETTER_AUTH_URL, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, ADMIN_GITHUB_ID } = env;

  if (
    !BETTER_AUTH_URL ||
    !BETTER_AUTH_SECRET ||
    !GITHUB_CLIENT_ID ||
    !GITHUB_CLIENT_SECRET ||
    !ADMIN_GITHUB_ID?.match(/^[1-9]\d*$/)
  ) {
    throw new Response("Authentication is not configured.", { status: 503 });
  }

  return betterAuth({
    appName: "mochi",
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(env.DB), { provider: "sqlite" }),
    socialProviders: {
      github: {
        clientId: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
      },
    },
    account: { accountLinking: { enabled: false } },
    user: {
      validateUserInfo: ({ source }) => {
        const oauth = source.oauth;
        if (oauth?.providerId !== "github" || String(oauth.profile?.id) !== ADMIN_GITHUB_ID) {
          return {
            error: "access_denied",
            errorDescription: "Only the administrator can sign in.",
          };
        }
      },
    },
  });
}
