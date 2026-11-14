import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { type Inventory, registrationYearAt } from "src/lib/inventory";
import { InventoryError } from "src/lib/mutation";
import { getDb } from "./db";
import { itemAssets, items, locations } from "./db/schema";
import type { ArchiveInput, ItemInput, LocationInput, TargetInput } from "./validation";

export async function readInventory(database: D1Database): Promise<Inventory> {
  const db = getDb(database);
  const [allItems, allLocations] = await db.batch([
    db.select().from(items).orderBy(desc(items.number)),
    db.select().from(locations).orderBy(locations.name),
  ]);
  return { items: allItems, locations: allLocations };
}

export async function readItemThumbnails(database: D1Database): Promise<Record<string, string | null>> {
  const db = getDb(database);
  const firstImage = db
    .select({ id: itemAssets.id })
    .from(itemAssets)
    .where(and(eq(itemAssets.itemId, items.id), eq(itemAssets.state, "ready")))
    .orderBy(asc(itemAssets.createdAt), asc(itemAssets.id))
    .limit(1);
  const rows = await db.select({ itemId: items.id, assetId: sql<string | null>`(${firstImage})` }).from(items);
  return Object.fromEntries(rows.map(({ itemId, assetId }) => [itemId, assetId]));
}

function stale(): never {
  throw new InventoryError("他の画面で更新されたか、対象が見つかりません。再読み込みしてやり直してください。");
}

export async function saveItem(database: D1Database, input: ItemInput) {
  const db = getDb(database);
  const { id, version, ...values } = input;
  if (id && version) {
    const [updated] = await db
      .update(items)
      .set({ ...values, updatedAt: Date.now(), version: sql`${items.version} + 1` })
      .where(and(eq(items.id, id), eq(items.version, version), isNull(items.archivedAt)))
      .returning();
    return updated ?? stale();
  }
  const now = Date.now();
  const [created] = await db
    .insert(items)
    .values({
      ...values,
      id: crypto.randomUUID(),
      registrationYear: registrationYearAt(now),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return created;
}

export async function archiveItem(database: D1Database, input: ArchiveInput) {
  const db = getDb(database);
  const [updated] = await db
    .update(items)
    .set({
      archivedAt: input.archived ? Date.now() : null,
      isPublic: input.archived ? false : sql`${items.isPublic}`,
      updatedAt: Date.now(),
      version: sql`${items.version} + 1`,
    })
    .where(and(eq(items.id, input.id), eq(items.version, input.version)))
    .returning();
  return updated ?? stale();
}

export async function saveLocation(database: D1Database, input: LocationInput) {
  const db = getDb(database);
  const { id, version, ...values } = input;
  if (id && version) {
    const [updated] = await db
      .update(locations)
      .set({ ...values, updatedAt: Date.now(), version: sql`${locations.version} + 1` })
      .where(and(eq(locations.id, id), eq(locations.version, version)))
      .returning();
    return updated ?? stale();
  }
  const now = Date.now();
  const [created] = await db
    .insert(locations)
    .values({ ...values, id: crypto.randomUUID(), createdAt: now, updatedAt: now })
    .returning();
  return created;
}

export async function deleteLocation(database: D1Database, input: TargetInput) {
  const db = getDb(database);
  const deleted = await db
    .delete(locations)
    .where(and(eq(locations.id, input.id), eq(locations.version, input.version)))
    .returning({ id: locations.id });
  if (!deleted.length) stale();
}
