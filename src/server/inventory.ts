import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { type Inventory, registrationYearAt } from "src/lib/inventory";
import { getDb } from "./db";
import { databaseError } from "./db/errors";
import { items, locations } from "./db/schema";
import { InventoryError, type ItemInput, type LocationInput } from "./validation";

export async function readInventory(database: D1Database): Promise<Inventory> {
  const db = getDb(database);
  const [allItems, allLocations] = await db.batch([
    db.select().from(items).orderBy(desc(items.number)),
    db.select().from(locations).orderBy(locations.name),
  ]);
  return { items: allItems, locations: allLocations };
}

function stale(): never {
  throw new InventoryError("他の画面で更新されたか、対象が見つかりません。再読み込みしてやり直してください。");
}

export async function saveItem(database: D1Database, input: ItemInput) {
  const db = getDb(database);
  const { id, version, ...values } = input;
  try {
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
  } catch (error) {
    throw databaseError(error);
  }
}

export async function archiveItem(database: D1Database, input: { id: string; version: number; archived: boolean }) {
  const db = getDb(database);
  try {
    const [updated] = await db
      .update(items)
      .set({
        archivedAt: input.archived ? Date.now() : null,
        updatedAt: Date.now(),
        version: sql`${items.version} + 1`,
      })
      .where(and(eq(items.id, input.id), eq(items.version, input.version)))
      .returning();
    return updated ?? stale();
  } catch (error) {
    throw databaseError(error);
  }
}

export async function saveLocation(database: D1Database, input: LocationInput) {
  const db = getDb(database);
  const { id, version, ...values } = input;
  try {
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
  } catch (error) {
    throw databaseError(error);
  }
}

export async function deleteLocation(database: D1Database, input: { id: string; version: number }) {
  const db = getDb(database);
  try {
    const deleted = await db
      .delete(locations)
      .where(and(eq(locations.id, input.id), eq(locations.version, input.version)))
      .returning({ id: locations.id });
    if (!deleted.length) stale();
  } catch (error) {
    throw databaseError(error);
  }
}
