import {
  containerChoices,
  createInventoryIndex,
  itemCode,
  locationPath,
  storageLabel,
  storagePath,
} from "src/lib/inventory";
import { archiveItem, deleteLocation, readInventory, saveItem, saveLocation } from "src/server/inventory";
import { mutation } from "src/server/mutation";
import { archiveInputSchema, itemInputSchema, locationInputSchema } from "src/server/validation";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
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
const location = (name: string, extra: Record<string, unknown> = {}) =>
  saveLocation(database, locationInputSchema.parse({ name, ...extra }));

describe("D1 inventory", () => {
  test("registers with a name only and allocates unique, permanent codes concurrently", async () => {
    const rows = await Promise.all(Array.from({ length: 8 }, (_, index) => item(`道具 ${index}`)));
    expect(new Set(rows.map((row) => row.id)).size).toBe(8);
    expect(new Set(rows.map((row) => itemCode(row))).size).toBe(8);
    expect(rows[0]).toMatchObject({
      description: "",
      locationId: null,
      containerItemId: null,
      status: "available",
      ownership: "owned",
      archivedAt: null,
      isContainer: false,
      tags: [],
    });
    const archived = await archiveItem(database, { ...rows[0], archived: true });
    const restored = await archiveItem(database, { ...archived, archived: false });
    expect(restored.number).toBe(rows[0].number);
    expect((await item("次の物品")).number).toBeGreaterThan(Math.max(...rows.map((row) => row.number)));
  });

  test("resolves nested storage and moving a bag moves its contents without updating them", async () => {
    const home = await location("自宅");
    const room = await location("作業部屋", { parentId: home.id });
    const lab = await location("研究室");
    const bag = await item("バッグ", { locationId: room.id, isContainer: true });
    const pouch = await item("ポーチ", { containerItemId: bag.id, isContainer: true });
    const charger = await item("充電器", { containerItemId: pouch.id, ownership: "borrowed", status: "lent" });
    let inventory = createInventoryIndex(await readInventory(database));
    expect(storageLabel(charger, inventory)).toBe("自宅 › 作業部屋 › バッグ › ポーチ");
    expect(locationPath(room, inventory).map((part) => part.name)).toEqual(["自宅", "作業部屋"]);
    expect(containerChoices(inventory, bag.id).map((entry) => entry.id)).not.toContain(pouch.id);
    expect(containerChoices(inventory, bag.id).map((entry) => entry.id)).not.toContain(charger.id);
    await saveItem(database, itemInputSchema.parse({ ...bag, locationId: lab.id }));
    inventory = createInventoryIndex(await readInventory(database));
    expect(storageLabel(charger, inventory)).toBe("研究室 › バッグ › ポーチ");
    expect(storagePath(charger, inventory).some((part) => part.id === lab.id)).toBe(true);
    expect(inventory.items.find((entry) => entry.id === charger.id)).toEqual(charger);
    expect(charger.ownership).toBe("borrowed");
    expect(charger.status).toBe("lent");
  });

  test("supports unknown locations and removing a single item from a container", async () => {
    const bag = await item("所在未設定のバッグ", { isContainer: true });
    const pouch = await item("所在未設定のポーチ", { containerItemId: bag.id, isContainer: true });
    const cable = await item("ケーブル", { containerItemId: pouch.id });
    expect(storageLabel(cable, createInventoryIndex(await readInventory(database)))).toBe(
      "（場所未設定） › 所在未設定のバッグ › 所在未設定のポーチ",
    );
    const takenOut = await saveItem(database, itemInputSchema.parse({ ...cable, containerItemId: null }));
    expect(storageLabel(takenOut, createInventoryIndex(await readInventory(database)))).toBe("未設定");
  });

  test("rejects item cycles, including concurrent opposing moves", async () => {
    const bag = await item("循環バッグ", { isContainer: true });
    const pouch = await item("循環ポーチ", { containerItemId: bag.id, isContainer: true });
    for (const containerItemId of [pouch.id, bag.id]) {
      expect(
        await mutation(() => saveItem(database, itemInputSchema.parse({ ...bag, containerItemId }))),
      ).toMatchObject({
        ok: false,
        message: expect.stringContaining("自分自身"),
      });
    }
    const a = await item("A", { isContainer: true });
    const b = await item("B", { isContainer: true });
    const results = await Promise.allSettled([
      saveItem(database, itemInputSchema.parse({ ...a, containerItemId: b.id })),
      saveItem(database, itemInputSchema.parse({ ...b, containerItemId: a.id })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("rejects location cycles, including concurrent opposing moves", async () => {
    const a = await location("階層A");
    const b = await location("階層B", { parentId: a.id });
    for (const parentId of [b.id, a.id]) {
      expect(await mutation(() => saveLocation(database, locationInputSchema.parse({ ...a, parentId })))).toMatchObject(
        {
          ok: false,
          message: expect.stringContaining("自分自身"),
        },
      );
    }
    const c = await location("階層C");
    const d = await location("階層D");
    const results = await Promise.allSettled([
      saveLocation(database, locationInputSchema.parse({ ...c, parentId: d.id })),
      saveLocation(database, locationInputSchema.parse({ ...d, parentId: c.id })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  test("prevents concurrent archive/insertion from leaving contents in an archived container", async () => {
    const container = await item("同時操作する入れ物", { isContainer: true });
    const results = await Promise.allSettled([
      archiveItem(database, { ...container, archived: true }),
      item("同時に入れる物品", { containerItemId: container.id }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  test("protects contents during archiving and prevents storing in archived items", async () => {
    const bag = await item("保護するバッグ", { isContainer: true });
    const child = await item("保護する物品", { containerItemId: bag.id });
    expect(await mutation(() => archiveItem(database, { ...bag, archived: true }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("中身"),
    });
    await saveItem(database, itemInputSchema.parse({ ...child, containerItemId: null }));
    await archiveItem(database, { ...bag, archived: true });
    expect(await mutation(() => item("追加不可", { containerItemId: bag.id }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("アーカイブ済み"),
    });
    expect(createInventoryIndex(await readInventory(database)).items.some((entry) => entry.id === child.id)).toBe(true);
  });

  test("protects occupied locations and permits deleting an empty location", async () => {
    const parent = await location("削除できない場所");
    const child = await location("子の場所", { parentId: parent.id });
    expect(await mutation(() => deleteLocation(database, parent))).toMatchObject({
      ok: false,
      message: expect.stringContaining("物品・子の場所"),
    });
    await deleteLocation(database, child);
    const object = await item("直接置く物品", { locationId: parent.id });
    expect(await mutation(() => deleteLocation(database, parent))).toMatchObject({
      ok: false,
      message: expect.stringContaining("物品・子の場所"),
    });
    await saveItem(database, itemInputSchema.parse({ ...object, locationId: null }));
    await deleteLocation(database, parent);
    expect(createInventoryIndex(await readInventory(database)).locations.some((entry) => entry.id === parent.id)).toBe(
      false,
    );
  });

  test("rejects stale edits and archives rather than overwriting newer data", async () => {
    const original = await item("更新前");
    await saveItem(database, itemInputSchema.parse({ ...original, name: "更新後" }));
    await expect(saveItem(database, itemInputSchema.parse({ ...original, name: "上書き不可" }))).rejects.toThrow(
      "他の画面",
    );
    await expect(archiveItem(database, { ...original, archived: true })).rejects.toThrow("他の画面");
    const place = await location("改名前");
    await saveLocation(database, locationInputSchema.parse({ ...place, name: "改名後" }));
    await expect(deleteLocation(database, place)).rejects.toThrow("他の画面");
  });

  test("database constraints reject invalid storage even when validation is bypassed", async () => {
    const place = await location("制約検証場所");
    const bag = await item("制約検証バッグ", { isContainer: true });
    const child = await item("制約検証物品");
    await expect(
      database
        .prepare("UPDATE items SET location_id = ?, container_item_id = ? WHERE id = ?")
        .bind(place.id, bag.id, child.id)
        .run(),
    ).rejects.toThrow("CHECK constraint failed");
    expect(await mutation(() => item("存在しない場所", { locationId: crypto.randomUUID() }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("収納先が存在しない"),
    });
  });
});

test("normalizes optional fields and accepts only editable item and location fields", () => {
  expect(itemInputSchema.parse({ name: "  道具  ", id: "", locationId: "", description: null, number: 999 })).toEqual({
    id: null,
    version: null,
    name: "道具",
    description: "",
    isContainer: false,
    isPublic: false,
    publicDescription: "",
    tags: [],
    status: "available",
    ownership: "owned",
    locationId: null,
    containerItemId: null,
  });
  expect(locationInputSchema.parse({ name: "  自宅  ", parentId: "", version: null })).toEqual({
    id: null,
    version: null,
    name: "自宅",
    parentId: null,
  });
});

test("rejects blank/oversized names, invalid states, identities and simultaneous destinations", () => {
  expect(() => itemInputSchema.parse({ name: "  " })).toThrow();
  expect(() => itemInputSchema.parse({ name: "a".repeat(201) })).toThrow();
  expect(() => itemInputSchema.parse({ name: "物品", status: "invalid" })).toThrow();
  expect(() => itemInputSchema.parse({ name: "物品", ownership: "invalid" })).toThrow();
  expect(() => itemInputSchema.parse({ name: "物品", locationId: "invalid" })).toThrow();
  expect(() => itemInputSchema.parse({ name: "物品", id: crypto.randomUUID() })).toThrow();
  expect(() => itemInputSchema.parse({ name: "物品", version: 1 })).toThrow();
  for (const version of [0, 1.5, Number.MAX_SAFE_INTEGER + 1])
    expect(() => itemInputSchema.parse({ name: "物品", id: crypto.randomUUID(), version })).toThrow();
  expect(() =>
    itemInputSchema.parse({ name: "物品", locationId: crypto.randomUUID(), containerItemId: crypto.randomUUID() }),
  ).toThrow();
  expect(() => archiveInputSchema.parse({ id: crypto.randomUUID(), version: 1, archived: "true" })).toThrow();
  expect(() => locationInputSchema.parse({ name: "" })).toThrow();
});
