import { errorResponse, privateHeaders } from "src/server/http";
import { saveItem } from "src/server/inventory";
import { mutation } from "src/server/mutation";
import { parseItemInput } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async () => {
  proxy = await testDatabase();
});
afterAll(async () => {
  await proxy?.dispose();
});

test("constraint names in item data do not change the actual database error", async () => {
  for (const code of ["item_cycle", "location_cycle", "archived_container", "not_a_container", "container_not_empty"]) {
    const operation = () =>
      saveItem(
        proxy.env.DB,
        parseItemInput({ name: code, description: code, tags: code, locationId: crypto.randomUUID() }),
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
