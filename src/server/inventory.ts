import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { type Inventory, registrationYearAt } from "src/lib/inventory";
import { getDb } from "./db";
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

function causeMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error) || typeof error.message !== "string") return;
  return ("cause" in error ? causeMessage(error.cause) : undefined) ?? error.message;
}

function databaseError(error: unknown): never {
  // Drizzle's wrapper includes SQL and parameter values. Only inspect the SQLite cause.
  const code =
    causeMessage(error)
      ?.replace(/^D1_ERROR: /, "")
      .split(": SQLITE_CONSTRAINT")[0] ?? "";
  const messages: Record<string, string> = {
    item_cycle: "自分自身や、自分の配下には移動できません。",
    location_cycle: "自分自身や、自分の配下には移動できません。",
    container_not_empty: "中身がある物品はアーカイブできません。先に中身を移動してください。",
    container_flag_in_use: "中身がある間は収納先の設定をオフにできません。先に中身を移動してください。",
    not_a_container: "収納先として使える物品を選んでください。入れ物側の「収納先として使う」をオンにできます。",
    archived_container: "アーカイブ済みの物品には収納できません。",
    "FOREIGN KEY constraint failed": "収納先が存在しないか、この場所に物品・子の場所が残っています。",
  };
  if (Object.hasOwn(messages, code)) throw new InventoryError(messages[code]);
  throw error;
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
    return databaseError(error);
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
    return databaseError(error);
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
    return databaseError(error);
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
    databaseError(error);
  }
}
