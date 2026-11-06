import { and, asc, eq, sql } from "drizzle-orm";
import { MAX_IMAGES_PER_ITEM } from "src/lib/media";
import { getDb } from "./db";
import { itemAssets, items, usesEntries } from "./db/schema";
import { sanitizeImage } from "./image-data";
import { InventoryError } from "./validation";

export type MediaEnv = Pick<Cloudflare.Env, "DB" | "ASSETS_BUCKET">;

export async function readItemMedia(database: D1Database, itemId: string) {
  const db = getDb(database);
  const [assets, entries] = await db.batch([
    db
      .select()
      .from(itemAssets)
      .where(eq(itemAssets.itemId, itemId))
      .orderBy(asc(itemAssets.createdAt), asc(itemAssets.id)),
    db.select().from(usesEntries).where(eq(usesEntries.itemId, itemId)).limit(1),
  ]);
  return { assets, entry: entries[0] ?? null };
}

export async function addImage(env: MediaEnv, itemId: string, filename: string, bytes: Uint8Array) {
  const db = getDb(env.DB);
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item || item.archivedAt !== null) throw new InventoryError("管理中の物品に画像を追加してください。");
  const count = await db.select({ count: sql<number>`count(*)` }).from(itemAssets).where(eq(itemAssets.itemId, itemId));
  if (count[0].count >= MAX_IMAGES_PER_ITEM)
    throw new InventoryError(`画像は1物品${MAX_IMAGES_PER_ITEM}枚まで追加できます。`);
  const normalized = sanitizeImage(bytes);
  const id = crypto.randomUUID();
  const objectKey = `items/${itemId}/${id}`;
  // Reserve a row first, so interrupted uploads remain visible and can be removed or retried.
  await db.insert(itemAssets).values({
    id,
    itemId,
    objectKey,
    filename: filename.slice(0, 200),
    contentType: normalized.contentType,
    bytes: normalized.data.length,
    width: normalized.width,
    height: normalized.height,
    state: "uploading",
    createdAt: Date.now(),
  });
  try {
    await env.ASSETS_BUCKET.put(objectKey, normalized.data, { httpMetadata: { contentType: normalized.contentType } });
    const [asset] = await db
      .update(itemAssets)
      .set({ state: "ready" })
      .where(and(eq(itemAssets.id, id), eq(itemAssets.state, "uploading")))
      .returning();
    if (!asset) throw new InventoryError("アップロードが取り消されました。もう一度画像を選んでください。");
    return asset;
  } catch (error) {
    // Keep a failed reservation if cleanup fails; its object key is needed for a later retry.
    try {
      await env.ASSETS_BUCKET.delete(objectKey);
      await db.delete(itemAssets).where(eq(itemAssets.id, id));
    } catch (cleanupError) {
      console.error("Image upload cleanup failed", cleanupError);
    }
    throw error;
  }
}

export async function removeImage(env: MediaEnv, assetId: string) {
  const db = getDb(env.DB);
  const [asset] = await db.update(itemAssets).set({ state: "deleting" }).where(eq(itemAssets.id, assetId)).returning();
  if (!asset) throw new InventoryError("画像が見つかりません。");
  await env.ASSETS_BUCKET.delete(asset.objectKey);
  await db.delete(itemAssets).where(eq(itemAssets.id, assetId));
}
