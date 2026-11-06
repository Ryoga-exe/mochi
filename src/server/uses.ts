import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { renderMarkdown } from "src/lib/markdown";
import { type PublicUse, publicImageUrl } from "src/lib/media";
import { InventoryError } from "src/lib/mutation";
import { getDb } from "./db";
import { itemAssets, items, usesEntries } from "./db/schema";
import type { TargetInput, UsesInput } from "./validation";

export async function saveUsesEntry(database: D1Database, input: UsesInput, baseUrl: string) {
  const db = getDb(database);
  const [item] = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
  if (!item || item.archivedAt !== null) throw new InventoryError("管理中の物品の公開設定を編集してください。");
  const [existing] = await db.select().from(usesEntries).where(eq(usesEntries.itemId, input.itemId)).limit(1);
  if ((existing?.version ?? null) !== input.version)
    throw new InventoryError("公開設定が他の画面で更新されています。再読み込みしてください。");
  const assets = await db
    .select()
    .from(itemAssets)
    .where(and(eq(itemAssets.itemId, input.itemId), eq(itemAssets.state, "ready")));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const entryId = existing?.id ?? crypto.randomUUID();
  const publicImages = input.images.map((image) => {
    const asset = assetsById.get(image.assetId);
    if (!asset) throw new InventoryError("公開画像はこの物品に追加済みの画像から選んでください。");
    return { ...image, url: publicImageUrl(baseUrl, entryId, image.assetId), width: asset.width, height: asset.height };
  });
  const rendered = renderMarkdown(
    input.descriptionMarkdown,
    Object.fromEntries(publicImages.map((image) => [image.assetId, image.url])),
  );
  const now = Date.now();
  // Construct the public document explicitly; never serialize the inventory item or private asset rows.
  const publicContent: PublicUse | null = input.isPublished
    ? {
        id: entryId,
        title: input.title,
        descriptionMarkdown: rendered.markdown,
        descriptionHtml: rendered.html,
        externalUrl: input.externalUrl,
        section: input.section,
        tags: input.tags,
        images: publicImages,
        updatedAt: new Date(now).toISOString(),
      }
    : null;
  const { version, ...values } = input;
  const saved = existing
    ? await db
        .update(usesEntries)
        .set({ ...values, publicContent, updatedAt: now, version: sql`${usesEntries.version} + 1` })
        .where(and(eq(usesEntries.id, entryId), eq(usesEntries.version, version ?? 0)))
        .returning()
    : await db
        .insert(usesEntries)
        .values({ ...values, id: entryId, publicContent, createdAt: now, updatedAt: now })
        .onConflictDoNothing()
        .returning();
  if (!saved.length) throw new InventoryError("公開設定が他の画面で更新されています。再読み込みしてください。");
  return saved[0];
}

export async function unpublishUse(database: D1Database, target: TargetInput) {
  const [entry] = await getDb(database)
    .update(usesEntries)
    .set({ isPublished: false, publicContent: null, updatedAt: Date.now(), version: sql`${usesEntries.version} + 1` })
    .where(and(eq(usesEntries.id, target.id), eq(usesEntries.version, target.version)))
    .returning();
  if (!entry) throw new InventoryError("公開設定が他の画面で更新されています。再読み込みしてください。");
  return entry;
}

const visible = and(eq(usesEntries.isPublished, true), isNull(items.archivedAt));

export async function publicUses(database: D1Database, limit: number, offset: number) {
  const db = getDb(database);
  const [entries, count] = await db.batch([
    db
      .select({ content: usesEntries.publicContent })
      .from(usesEntries)
      .innerJoin(items, eq(items.id, usesEntries.itemId))
      .where(visible)
      .orderBy(asc(usesEntries.sortOrder), asc(usesEntries.id))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(usesEntries)
      .innerJoin(items, eq(items.id, usesEntries.itemId))
      .where(visible),
  ]);
  return {
    apiVersion: 1,
    items: entries.flatMap((entry) => (entry.content ? [entry.content] : [])),
    total: count[0].total,
    limit,
    offset,
  };
}

export async function publicUse(database: D1Database, entryId: string) {
  const [entry] = await getDb(database)
    .select({ content: usesEntries.publicContent, itemId: usesEntries.itemId })
    .from(usesEntries)
    .innerJoin(items, eq(items.id, usesEntries.itemId))
    .where(and(visible, eq(usesEntries.id, entryId)))
    .limit(1);
  return entry ?? null;
}
