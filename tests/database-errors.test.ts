import { saveItem } from "src/server/inventory";
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
    await expect(
      saveItem(
        proxy.env.DB,
        parseItemInput({ name: code, description: code, tags: code, locationId: crypto.randomUUID() }),
      ),
    ).rejects.toThrow("収納先が存在しない");
  }
});
