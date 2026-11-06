import { createHmac } from "node:crypto";
import { type AuthEnv, getAuth } from "src/server/auth";
import { getDb } from "src/server/db";
import { account, session, user } from "src/server/db/schema";
import { getAdministrator } from "src/server/session";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
let env: AuthEnv;
const secret = "test-only-secret-for-mochi-authorization-123456789";

beforeAll(async () => {
  proxy = await testDatabase();
  env = {
    DB: proxy.env.DB,
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: secret,
    GITHUB_CLIENT_ID: "test-only",
    GITHUB_CLIENT_SECRET: "test-only",
    ADMIN_GITHUB_ID: "12345",
  };
});
afterAll(async () => {
  await proxy?.dispose();
});

async function sessionHeaders(providerId: string, accountId: string, expiresAt = new Date(Date.now() + 60_000)) {
  const id = crypto.randomUUID();
  const now = new Date();
  const token = crypto.randomUUID();
  const db = getDb(env.DB);
  await db
    .insert(user)
    .values({ id, name: "Test user", email: `${id}@example.invalid`, createdAt: now, updatedAt: now });
  await db
    .insert(account)
    .values({ id: crypto.randomUUID(), userId: id, providerId, accountId, createdAt: now, updatedAt: now });
  await db
    .insert(session)
    .values({ id: crypto.randomUUID(), userId: id, token, expiresAt, createdAt: now, updatedAt: now });
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  return new Headers({ Cookie: `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` });
}

test("permits only a valid session linked to the configured GitHub numeric ID", async () => {
  expect(await getAdministrator(env, new Headers())).toBeNull();
  expect(await getAdministrator(env, new Headers({ Cookie: "better-auth.session_token=forged" }))).toBeNull();
  expect(await getAdministrator(env, await sessionHeaders("github", "99999"))).toBeNull();
  expect(await getAdministrator(env, await sessionHeaders("google", "12345"))).toBeNull();
  expect(await getAdministrator(env, await sessionHeaders("github", "12345", new Date(Date.now() - 1000)))).toBeNull();
  const headers = await sessionHeaders("github", "12345");
  expect(await getAdministrator(env, headers)).toMatchObject({ name: "Test user" });
  expect(await getAdministrator({ ...env, ADMIN_GITHUB_ID: "99999" }, headers)).toBeNull();
});

test("validates the GitHub profile on first login, account linking and returning sign-in", async () => {
  const auth = getAuth(env);
  const validate = auth.options.user.validateUserInfo;
  for (const action of ["create-user", "link-account", "sign-in"] as const) {
    expect(
      await validate({
        user: {},
        source: { action, method: "oauth", oauth: { providerId: "github", profile: { id: 12345 } } },
      }),
    ).toBeUndefined();
    for (const oauth of [
      { providerId: "github", profile: { id: 99999 } },
      { providerId: "github" },
      { providerId: "google", profile: { id: 12345 } },
      undefined,
    ]) {
      expect(await validate({ user: {}, source: { action, method: "oauth", oauth } })).toMatchObject({
        error: "access_denied",
      });
    }
  }
});

test("fails closed when authentication configuration is missing or the administrator is not a numeric ID", () => {
  expect(() => getAuth({ DB: env.DB })).toThrow();
  expect(() => getAuth({ ...env, ADMIN_GITHUB_ID: "username" })).toThrow();
});
