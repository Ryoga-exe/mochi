import { errorResponse, privateHeaders } from "src/server/http";
import { saveItem } from "src/server/inventory";
import { mutation } from "src/server/mutation";
import { itemInputSchema } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async () => {
  proxy = await testDatabase();
});
afterAll(async () => {
  await proxy?.dispose();
});

test("validation errors retain their message in mutation results and HTTP responses", async () => {
  const operation = async () => itemInputSchema.parse({ name: "  " });
  const expected = { ok: false, message: "品名は1〜200文字で入力してください。" };
  expect(await mutation(operation)).toEqual(expected);
  const error = await operation().catch((error: unknown) => error);
  const response = errorResponse(error, privateHeaders);
  expect(response.status).toBe(400);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual(expected);
});

test("constraint names in item data do not change the actual database error", async () => {
  for (const code of ["item_cycle", "location_cycle", "archived_container", "not_a_container", "container_not_empty"]) {
    const operation = () =>
      saveItem(
        proxy.env.DB,
        itemInputSchema.parse({ name: code, description: code, tags: code, locationId: crypto.randomUUID() }),
      );
    expect(await mutation(operation)).toMatchObject({
      ok: false,
      message: expect.stringContaining("収納先が存在しない"),
    });
    const error = await operation().catch((error: unknown) => error);
    const response = errorResponse(error, privateHeaders);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, message: expect.stringContaining("収納先が存在しない") });
  }
});
