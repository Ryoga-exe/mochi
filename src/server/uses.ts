import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  MAX_IMAGES_PER_ITEM,
  MAX_MARKDOWN_LENGTH,
  type PublicUse,
  publicImageUrl,
  type UsesImage,
} from "src/lib/media";
import { getDb } from "./db";
import { itemAssets, items, usesEntries } from "./db/schema";
import { publicMarkdown } from "./public-markdown";
import { InventoryError, id, object, parseTags, parseTarget, text } from "./validation";

export function parseUsesInput(value: unknown) {
  const data = object(value);
  const itemId = id(data.itemId);
  if (!itemId) throw new InventoryError("物品 ID が不正です。");
  const version = data.version === null ? null : parseTarget({ id: itemId, version: data.version }).version;
  if (typeof data.isPublished !== "boolean") throw new InventoryError("公開設定が不正です。");
  if (!Number.isSafeInteger(data.sortOrder) || typeof data.sortOrder !== "number" || Math.abs(data.sortOrder) > 10000)
    throw new InventoryError("表示順は -10000〜10000 の整数にしてください。");
  if (!Array.isArray(data.images) || data.images.length > MAX_IMAGES_PER_ITEM)
    throw new InventoryError("公開画像の指定が不正です。");
  const images: UsesImage[] = data.images.map((value) => {
    const image = object(value);
    const assetId = id(image.assetId);
    if (!assetId || typeof image.inGallery !== "boolean") throw new InventoryError("公開画像の指定が不正です。");
    return {
      assetId,
      inGallery: image.inGallery,
      alt: text(image.alt, "画像の代替テキスト", 300, { required: false }),
      caption: text(image.caption, "画像の説明", 1000, { required: false }),
    };
  });
  if (new Set(images.map((image) => image.assetId)).size !== images.length)
    throw new InventoryError("画像を重複して指定できません。");
  const externalUrl = text(data.externalUrl ?? "", "製品リンク", 2000, { required: false });
  if (externalUrl) {
    let valid = false;
    try {
      valid = ["http:", "https:"].includes(new URL(externalUrl).protocol);
    } catch {
      /* validated below */
    }
    if (!valid) throw new InventoryError("製品リンクは http または https の URL にしてください。");
  }
  return {
    itemId,
    version,
    isPublished: data.isPublished,
    sortOrder: data.sortOrder,
    title: text(data.title, "公開タイトル", 200, { required: data.isPublished }),
    descriptionMarkdown: text(data.descriptionMarkdown, "公開用の説明", MAX_MARKDOWN_LENGTH, {
      required: false,
      trim: false,
    }),
    externalUrl: externalUrl || null,
    section: text(data.section ?? "", "セクション", 100, { required: false }),
    tags: parseTags(data.tags),
    images,
  };
}

export async function saveUsesEntry(database: D1Database, input: ReturnType<typeof parseUsesInput>, baseUrl: string) {
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
  const rendered = publicMarkdown(
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

export async function unpublishUse(database: D1Database, target: ReturnType<typeof parseTarget>) {
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
