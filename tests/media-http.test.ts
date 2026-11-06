import { createHmac } from "node:crypto";
import type { AuthEnv } from "src/server/auth";
import { getDb } from "src/server/db";
import { account, session, user } from "src/server/db/schema";
import { limitedBody } from "src/server/http";
import { saveItem } from "src/server/inventory";
import { type MediaEnv, readItemMedia } from "src/server/media";
import { privateImageResponse, uploadImageResponse } from "src/server/media-http";
import { itemInputSchema } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";
import { png } from "./images";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
let env: MediaEnv & AuthEnv;
let cookie: string;
let itemId: string;
beforeAll(async () => {
  proxy = await testDatabase();
  const secret = "test-only-secret-for-image-authorization-123456789";
  env = {
    ...proxy.env,
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: secret,
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    ADMIN_GITHUB_ID: "12345",
  };
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  const token = crypto.randomUUID();
  const now = new Date();
  await db.insert(user).values({ id, name: "Test", email: "images@example.invalid", createdAt: now, updatedAt: now });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId: id,
    providerId: "github",
    accountId: "12345",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(session).values({
    id: crypto.randomUUID(),
    userId: id,
    token,
    expiresAt: new Date(Date.now() + 60000),
    createdAt: now,
    updatedAt: now,
  });
  const signature = createHmac("sha256", secret).update(token).digest("base64");
  cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  itemId = (await saveItem(env.DB, itemInputSchema.parse({ name: "HTTP test" }))).id;
});
afterAll(async () => {
  await proxy?.dispose();
});

function upload(body: BodyInit, headers: HeadersInit = { Cookie: cookie, Origin: "http://localhost:3000" }) {
  return uploadImageResponse(
    env,
    new Request(`http://localhost:3000/api/items/${itemId}/images`, { method: "POST", headers, body }),
    itemId,
  );
}
function form(bytes: Uint8Array = png, filename = "photo.png") {
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), filename);
  return body;
}

test("requires an administrator and same origin before reading upload/delete bodies", async () => {
  expect((await upload(form(), {})).status).toBe(401);
  expect((await upload(form(), { Cookie: cookie, Origin: "https://attacker.example" })).status).toBe(403);
  expect((await upload(form(), { Cookie: cookie })).status).toBe(403);
  expect((await readItemMedia(env.DB, itemId)).assets).toHaveLength(0);
});

test("uploads a private image, protects reads/deletes and deletes the object", async () => {
  const response = await upload(form());
  expect(response.status).toBe(201);
  const { value: asset } = (await response.json()) as { value: { id: string } };
  const url = `http://localhost:3000/api/images/${asset.id}`;
  expect((await privateImageResponse(env, new Request(url), asset.id)).status).toBe(401);
  const image = await privateImageResponse(env, new Request(url, { headers: { Cookie: cookie } }), asset.id);
  expect(image.headers.get("Cache-Control")).toBe("private, no-store");
  expect(image.headers.get("Content-Type")).toBe("image/png");
  expect(Buffer.from(await image.arrayBuffer())).toEqual(png);
  expect(
    (
      await privateImageResponse(
        env,
        new Request(url, { method: "DELETE", headers: { Cookie: cookie, Origin: "https://attacker.example" } }),
        asset.id,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await privateImageResponse(
        env,
        new Request(url, { method: "DELETE", headers: { Cookie: cookie, Origin: "http://localhost:3000" } }),
        asset.id,
      )
    ).status,
  ).toBe(200);
  expect((await privateImageResponse(env, new Request(url, { headers: { Cookie: cookie } }), asset.id)).status).toBe(
    404,
  );
});

test("rejects malformed multipart, spoofed file types and oversized bodies", async () => {
  expect((await upload("invalid multipart")).status).toBe(400);
  expect((await upload(form(Buffer.from('<svg onload="alert(1)"/>'), "spoof.png"))).status).toBe(400);
  expect(
    (
      await upload(form(), {
        Cookie: cookie,
        Origin: "http://localhost:3000",
        "Content-Length": String(7 * 1024 * 1024),
      })
    ).status,
  ).toBe(413);
  expect((await readItemMedia(env.DB, itemId)).assets).toHaveLength(0);
});

test("bounds streaming bodies without a Content-Length header", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost/upload", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(limitedBody(request, 10)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});
