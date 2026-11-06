import { itemCode } from "src/lib/inventory";
import { parseItemCode } from "src/lib/public-item";
import { archiveItem, readInventory, saveItem } from "src/server/inventory";
import { readPublicItem } from "src/server/public-item";
import { parseUsesInput, publicUse, saveUsesEntry, unpublishUse } from "src/server/uses";
import { parseItemInput } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { applyMigrations, testDatabase } from "./database";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async () => {
  proxy = await testDatabase();
});
afterAll(async () => {
  await proxy?.dispose();
});
const createItem = (extra: Record<string, unknown> = {}) =>
  saveItem(
    proxy.env.DB,
    parseItemInput({ name: "Camera", description: "PRIVATE MEMO", tags: "PRIVATE TAG", ...extra }),
  );
const publicItem = (item: Parameters<typeof itemCode>[0]) => readPublicItem(proxy.env.DB, itemCode(item), "Ryoga");

test("items default to private and enabling QR publication never copies private notes", async () => {
  const item = await createItem();
  expect(item).toMatchObject({ isPublic: false, publicDescription: "" });
  expect(await publicItem(item)).toBeNull();
  const published = await saveItem(proxy.env.DB, parseItemInput({ ...item, isPublic: true }));
  expect(await publicItem(published)).toEqual({
    ownerName: "Ryoga",
    name: "Camera",
    status: "available",
    description: "",
  });
});

test("returns only the public allowlist, reflects status edits and revokes on disabling", async () => {
  const item = await createItem({
    isPublic: true,
    publicDescription: "動画の撮影に使っています。",
    status: "lost",
    ownership: "borrowed",
    isContainer: true,
  });
  await createItem({ name: "PRIVATE CHILD", containerItemId: item.id });
  const content = await publicItem(item);
  expect(content).toEqual({
    ownerName: "Ryoga",
    name: "Camera",
    status: "lost",
    description: "動画の撮影に使っています。",
  });
  expect(Object.keys(content ?? {}).sort()).toEqual(["description", "name", "ownerName", "status"]);
  expect(JSON.stringify(content)).not.toMatch(/PRIVATE|borrowed|containerItemId|number|tags|locationId|images/);
  const edited = await saveItem(
    proxy.env.DB,
    parseItemInput({ ...item, name: "Lens", status: "available", publicDescription: "持ち歩いているレンズです。" }),
  );
  expect(await publicItem(edited)).toMatchObject({
    name: "Lens",
    status: "available",
    description: "持ち歩いているレンズです。",
  });
  await saveItem(proxy.env.DB, parseItemInput({ ...edited, isPublic: false }));
  expect(await publicItem(item)).toBeNull();
  expect(await readPublicItem(proxy.env.DB, "M-2026-999999", "Ryoga")).toBeNull();
});

test("QR publication and uses publication are independent in both directions", async () => {
  let item = await createItem();
  const entry = await saveUsesEntry(
    proxy.env.DB,
    parseUsesInput({
      itemId: item.id,
      version: null,
      title: "uses title",
      descriptionMarkdown: "uses description",
      images: [],
      sortOrder: 0,
      isPublished: true,
    }),
    "https://mochi.example",
  );
  expect(await publicUse(proxy.env.DB, entry.id)).not.toBeNull();
  expect(await publicItem(item)).toBeNull();
  item = await saveItem(proxy.env.DB, parseItemInput({ ...item, isPublic: true, publicDescription: "QR description" }));
  await unpublishUse(proxy.env.DB, entry);
  expect(await publicUse(proxy.env.DB, entry.id)).toBeNull();
  expect(await publicItem(item)).toMatchObject({ description: "QR description" });
});

test("archiving revokes publication and restoration requires explicitly publishing again", async () => {
  const item = await createItem({ isPublic: true });
  const archived = await archiveItem(proxy.env.DB, { ...item, archived: true });
  expect(await publicItem(item)).toBeNull();
  expect(archived.isPublic).toBe(false);
  const restored = await archiveItem(proxy.env.DB, { ...archived, archived: false });
  expect(await publicItem(item)).toBeNull();
  const published = await saveItem(proxy.env.DB, parseItemInput({ ...restored, isPublic: true }));
  expect(await publicItem(published)).not.toBeNull();
});

test("accepts only canonical codes with the actual registration year", async () => {
  const item = await createItem({ isPublic: true });
  const code = itemCode(item);
  expect(await publicItem(item)).not.toBeNull();
  for (const candidate of [
    code.replace(`-${item.registrationYear}-`, "-"),
    code.replace(`-${item.registrationYear}-`, "-2050-"),
    code.replace(/-(\d+)$/, "-0$1"),
    code.toLowerCase(),
    `${code}suffix`,
    "M-000000",
    "M-2026-999999999999999999",
    "https://example.com",
    "//example.com",
    "../items/new",
  ]) {
    expect(await readPublicItem(proxy.env.DB, candidate, "Ryoga")).toBeNull();
  }
  expect(parseItemCode("M-000001")).toEqual({ number: 1, registrationYear: null });
  expect(parseItemCode("M-2026-1000000")).toEqual({ number: 1000000, registrationYear: 2026 });
});

test("migration preserves existing inventory and leaves every old item private", async () => {
  const legacy = await testDatabase((name) => name < "0007");
  try {
    const id = crypto.randomUUID();
    const now = Date.now();
    await legacy.env.DB.prepare(
      "INSERT INTO items (id, name, description, created_at, updated_at) VALUES (?, 'Legacy', 'PRIVATE LEGACY MEMO', ?, ?)",
    )
      .bind(id, now, now)
      .run();
    await applyMigrations(legacy.env.DB, (name) => name >= "0007");
    const { items } = await readInventory(legacy.env.DB);
    expect(items[0]).toMatchObject({
      id,
      name: "Legacy",
      description: "PRIVATE LEGACY MEMO",
      isPublic: false,
      publicDescription: "",
    });
    expect(await readPublicItem(legacy.env.DB, itemCode(items[0]), "Ryoga")).toBeNull();
    const published = await saveItem(legacy.env.DB, parseItemInput({ ...items[0], isPublic: true }));
    expect(await readPublicItem(legacy.env.DB, itemCode(published), "Ryoga")).toMatchObject({ name: "Legacy" });
  } finally {
    await legacy.dispose();
  }
});

test("rejects invalid publication flags and oversized short descriptions", () => {
  for (const isPublic of ["true", 1, {}, []])
    expect(() => parseItemInput({ name: "Camera", isPublic })).toThrow("公開範囲");
  expect(() => parseItemInput({ name: "Camera", publicDescription: "a".repeat(301) })).toThrow("300文字");
  expect(parseItemInput({ name: "Camera", publicDescription: "  description  " }).publicDescription).toBe(
    "description",
  );
});
