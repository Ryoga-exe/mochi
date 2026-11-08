import {
  availableTags,
  containerChoices,
  createInventoryIndex,
  filterItems,
  itemCode,
  registrationYearAt,
} from "src/lib/inventory";
import { archiveItem, readInventory, saveItem, saveLocation } from "src/server/inventory";
import { mutation } from "src/server/mutation";
import { itemInputSchema, locationInputSchema } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
let database: D1Database;
beforeAll(async () => {
  proxy = await testDatabase();
  database = proxy.env.DB;
});
afterAll(async () => {
  await proxy?.dispose();
});

const item = (name: string, extra: Record<string, unknown> = {}) =>
  saveItem(database, itemInputSchema.parse({ name, ...extra }));

test("only explicit, active containers are candidates and server writes enforce the flag", async () => {
  const bag = await item("収納可のバッグ", { isContainer: true });
  const laptop = await item("通常の PC");
  const child = await item("収納する充電器");
  const archived = await item("保管終了のバッグ", { isContainer: true });
  await archiveItem(database, { ...archived, archived: true });
  const choices = containerChoices(createInventoryIndex(await readInventory(database)));
  expect(choices.map((entry) => entry.id)).toContain(bag.id);
  expect(choices.map((entry) => entry.id)).not.toContain(laptop.id);
  expect(choices.map((entry) => entry.id)).not.toContain(archived.id);
  for (const operation of [
    () => item("入れられない物品", { containerItemId: laptop.id }),
    () => saveItem(database, itemInputSchema.parse({ ...child, containerItemId: laptop.id })),
  ]) {
    expect(await mutation(operation)).toMatchObject({
      ok: false,
      message: expect.stringContaining("収納先として使える"),
    });
  }
  await expect(
    database.prepare("UPDATE items SET container_item_id = ? WHERE id = ?").bind(laptop.id, child.id).run(),
  ).rejects.toThrow("not_a_container");
  const enabled = await saveItem(database, itemInputSchema.parse({ ...laptop, isContainer: true }));
  expect((await item("設定後に入れる物品", { containerItemId: enabled.id })).containerItemId).toBe(enabled.id);
});

test("an occupied container cannot be disabled and a rejected edit preserves tags", async () => {
  const box = await item("中身がある箱", { isContainer: true, tags: "備品" });
  const child = await item("箱の中身", { containerItemId: box.id });
  expect(
    await mutation(() => saveItem(database, itemInputSchema.parse({ ...box, isContainer: false, tags: "変更不可" }))),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining("中身がある間"),
  });
  const unchanged = createInventoryIndex(await readInventory(database)).items.find((entry) => entry.id === box.id);
  expect(unchanged).toMatchObject({ isContainer: true, tags: ["備品"], version: box.version });
  await saveItem(database, itemInputSchema.parse({ ...child, containerItemId: null }));
  expect((await saveItem(database, itemInputSchema.parse({ ...box, isContainer: false }))).isContainer).toBe(false);
});

test("concurrent disabling and insertion cannot leave contents in a non-container", async () => {
  const box = await item("競合する箱", { isContainer: true });
  const results = await Promise.allSettled([
    saveItem(database, itemInputSchema.parse({ ...box, isContainer: false })),
    item("同時に追加される中身", { containerItemId: box.id }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const inventory = createInventoryIndex(await readInventory(database));
  const current = inventory.items.find((entry) => entry.id === box.id);
  if (!current?.isContainer) expect(inventory.items.some((entry) => entry.containerItemId === box.id)).toBe(false);
});

test("tags can be normalized, deduplicated, filtered with location and searched", async () => {
  const place = await saveLocation(database, locationInputSchema.parse({ name: "タグ検証場所" }));
  const bag = await item("タグ付きバッグ", { isContainer: true, locationId: place.id, tags: "通勤" });
  const charger = await item("タグ付き充電器", { containerItemId: bag.id, tags: " USB-C, 予備、USB-C, ,ガジェット" });
  expect(charger.tags).toEqual(["USB-C", "予備", "ガジェット"]);
  const other = await item("別の場所の物品", { tags: ["USB-C"] });
  let inventory = createInventoryIndex(await readInventory(database));
  expect(filterItems(inventory, { tag: "USB-C", location: place.id }).map((entry) => entry.id)).toEqual([charger.id]);
  expect(filterItems(inventory, { q: "usb-c" }).map((entry) => entry.id)).toEqual(
    expect.arrayContaining([charger.id, other.id]),
  );
  expect(filterItems(inventory, { tag: "USB" })).toHaveLength(0);
  expect(filterItems(inventory, { q: itemCode(charger) }).map((entry) => entry.id)).toEqual([charger.id]);
  expect(availableTags(inventory).filter((tag) => tag === "USB-C")).toHaveLength(1);
  await archiveItem(database, { ...charger, archived: true });
  inventory = createInventoryIndex(await readInventory(database));
  expect(filterItems(inventory, { tag: "USB-C", archived: "archived" }).map((entry) => entry.id)).toEqual([charger.id]);
  expect(filterItems(inventory, { tag: "USB-C" }).map((entry) => entry.id)).toEqual([other.id]);
  const cleared = await saveItem(database, itemInputSchema.parse({ ...other, tags: "" }));
  expect(cleared.tags).toEqual([]);
});

test("registration years are issued once and codes remain stable through edits and restoration", async () => {
  const original = await item("年入りの物品");
  expect(original.registrationYear).toBe(registrationYearAt(original.createdAt));
  expect(itemCode(original)).toBe(`M-${original.registrationYear}-${String(original.number).padStart(6, "0")}`);
  const edited = await saveItem(
    database,
    itemInputSchema.parse({ ...original, registrationYear: 2050, name: "名称変更後" }),
  );
  const archived = await archiveItem(database, { ...edited, archived: true });
  const restored = await archiveItem(database, { ...archived, archived: false });
  expect(itemCode(restored)).toBe(itemCode(original));
  await expect(
    database.prepare("UPDATE items SET registration_year = 2050 WHERE id = ?").bind(original.id).run(),
  ).rejects.toThrow("item_number_immutable");
  await expect(
    database.prepare("UPDATE items SET number = 999999 WHERE id = ?").bind(original.id).run(),
  ).rejects.toThrow("item_number_immutable");
});

test("registration years follow the new year in Japan rather than UTC", () => {
  expect(registrationYearAt(Date.parse("2026-12-31T14:59:59.999Z"))).toBe(2026);
  expect(registrationYearAt(Date.parse("2026-12-31T15:00:00.000Z"))).toBe(2027);
  expect(itemCode({ number: 1, registrationYear: 2026 })).toBe("M-2026-000001");
});

test("invalid flags and tags are rejected before persistence", () => {
  for (const isContainer of ["true", 1, [], {}])
    expect(() => itemInputSchema.parse({ name: "物品", isContainer })).toThrow("収納可否");
  for (const tags of [
    12,
    {},
    [12],
    ["a,b"],
    ["a".repeat(41)],
    Array.from({ length: 21 }, (_, index) => `tag${index}`),
  ]) {
    expect(() => itemInputSchema.parse({ name: "物品", tags })).toThrow();
  }
});
