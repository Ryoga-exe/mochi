import { eq } from "drizzle-orm";
import { assetReference, type PublicUse } from "src/lib/media";
import { getDb } from "src/server/db";
import { itemAssets } from "src/server/db/schema";
import { archiveItem, saveItem } from "src/server/inventory";
import { addImage, readItemMedia, removeImage } from "src/server/media";
import { publicImageResponse, publicUsesResponse } from "src/server/media-http";
import { mutation } from "src/server/mutation";
import { parseUsesInput, publicUse, publicUses, saveUsesEntry, unpublishUse } from "src/server/uses";
import { parseItemInput } from "src/server/validation";
import { afterAll, beforeAll, expect, test } from "vitest";
import { testDatabase } from "./database";
import { png } from "./images";

let proxy: Awaited<ReturnType<typeof testDatabase>>;
beforeAll(async () => {
  proxy = await testDatabase();
});
afterAll(async () => {
  await proxy?.dispose();
});
const item = () =>
  saveItem(proxy.env.DB, parseItemInput({ name: "PRIVATE NAME", description: "PRIVATE MEMO", tags: "PRIVATE TAG" }));
const input = (itemId: string, extra: Record<string, unknown> = {}) =>
  parseUsesInput({
    itemId,
    version: null,
    title: "公開する道具",
    descriptionMarkdown: "",
    images: [],
    isPublished: false,
    sortOrder: 0,
    ...extra,
  });
const save = (value: ReturnType<typeof parseUsesInput>) => saveUsesEntry(proxy.env.DB, value, "https://mochi.example");

test("stores private images in R2, exposes only selected public fields and revokes images on unpublish", async () => {
  const object = await item();
  const first = await addImage(proxy.env, object.id, "PRIVATE FILENAME.png", png);
  const second = await addImage(proxy.env, object.id, "hidden.png", png);
  expect(first.state).toBe("ready");
  expect(await proxy.env.ASSETS_BUCKET.get(first.objectKey)).not.toBeNull();
  let entry = await save(input(object.id));
  expect(await publicUse(proxy.env.DB, entry.id)).toBeNull();
  entry = await save(
    input(object.id, {
      version: entry.version,
      isPublished: true,
      descriptionMarkdown: `前の段落\n\n![使用例](${assetReference(first.id)})\n\n後の段落`,
      images: [{ assetId: first.id, alt: "使用例", caption: "公開する説明", inGallery: false }],
      tags: "公開タグ",
    }),
  );
  const request = new Request("https://mochi.example/api/v1/uses");
  const detail = await publicUsesResponse(proxy.env, request, entry.id);
  const content = (await detail.json()) as PublicUse;
  expect(detail.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(detail.headers.get("Cache-Control")).toBe("no-store");
  expect(content.images).toHaveLength(1);
  expect(content.images[0]).toMatchObject({ assetId: first.id, inGallery: false, width: 1, height: 1 });
  const serialized = JSON.stringify(content);
  for (const privateValue of [
    "PRIVATE",
    object.id,
    second.id,
    first.objectKey,
    "archivedAt",
    "ownership",
    "locationId",
    "number",
  ])
    expect(serialized).not.toContain(privateValue);
  expect(content.descriptionMarkdown).toContain(content.images[0].url);
  expect(content.descriptionHtml).toContain(content.images[0].url);
  expect((await publicImageResponse(proxy.env, entry.id, first.id)).status).toBe(200);
  expect((await publicImageResponse(proxy.env, entry.id, second.id)).status).toBe(404);
  expect(await mutation(() => removeImage(proxy.env, first.id))).toMatchObject({
    ok: false,
    message: expect.stringContaining("外して"),
  });
  await saveItem(proxy.env.DB, parseItemInput({ ...object, description: "PRIVATE EDIT" }));
  expect((await publicUse(proxy.env.DB, entry.id))?.content).toEqual(content);
  await unpublishUse(proxy.env.DB, entry);
  expect((await publicUsesResponse(proxy.env, request, entry.id)).status).toBe(404);
  expect((await publicImageResponse(proxy.env, entry.id, first.id)).status).toBe(404);
  const media = await readItemMedia(proxy.env.DB, object.id);
  await save(input(object.id, { version: media.entry?.version, images: [] }));
  await removeImage(proxy.env, first.id);
  expect(await proxy.env.ASSETS_BUCKET.get(first.objectKey)).toBeNull();
});

test("rejects foreign, unready, unselected images and stale public edits", async () => {
  const a = await item();
  const b = await item();
  const asset = await addImage(proxy.env, a.id, "image.png", png);
  const images = [{ assetId: asset.id, alt: "", caption: "", inGallery: true }];
  await expect(save(input(b.id, { images }))).rejects.toThrow("この物品");
  await expect(save(input(a.id, { descriptionMarkdown: `![x](${assetReference(asset.id)})` }))).rejects.toThrow(
    "公開対象",
  );
  await getDb(proxy.env.DB).update(itemAssets).set({ state: "deleting" }).where(eq(itemAssets.id, asset.id));
  await expect(save(input(a.id, { images }))).rejects.toThrow("この物品");
  const entry = await save(input(a.id));
  await expect(save(input(a.id))).rejects.toThrow("他の画面");
  await save(input(a.id, { version: entry.version }));
  await expect(unpublishUse(proxy.env.DB, entry)).rejects.toThrow("他の画面");
});

test("archive unpublishes and restore does not republish", async () => {
  const object = await item();
  const asset = await addImage(proxy.env, object.id, "archive.png", png);
  const entry = await save(
    input(object.id, { isPublished: true, images: [{ assetId: asset.id, alt: "", caption: "", inGallery: true }] }),
  );
  const archived = await archiveItem(proxy.env.DB, { ...object, archived: true });
  expect(await publicUse(proxy.env.DB, entry.id)).toBeNull();
  expect((await publicImageResponse(proxy.env, entry.id, asset.id)).status).toBe(404);
  expect((await readItemMedia(proxy.env.DB, object.id)).entry).toMatchObject({
    isPublished: false,
    publicContent: null,
    version: entry.version + 1,
  });
  await archiveItem(proxy.env.DB, { ...archived, archived: false });
  expect(await publicUse(proxy.env.DB, entry.id)).toBeNull();
});

test("database guards concurrent deletion/publication and the 20 image limit", async () => {
  const object = await item();
  const asset = await addImage(proxy.env, object.id, "race.png", png);
  const results = await Promise.allSettled([
    save(
      input(object.id, { isPublished: true, images: [{ assetId: asset.id, alt: "", caption: "", inGallery: true }] }),
    ),
    removeImage(proxy.env, asset.id),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const other = await item();
  const images = await Promise.allSettled(
    Array.from({ length: 21 }, () => addImage(proxy.env, other.id, "limit.png", png)),
  );
  expect(images.filter((result) => result.status === "fulfilled")).toHaveLength(20);
  expect((await readItemMedia(proxy.env.DB, other.id)).assets).toHaveLength(20);
});

test("orders and paginates the API and rejects invalid query bounds", async () => {
  const a = await item();
  const b = await item();
  const first = await save(input(a.id, { isPublished: true, sortOrder: -10000 }));
  await save(input(b.id, { isPublished: true, sortOrder: 10000 }));
  const page = await publicUses(proxy.env.DB, 1, 0);
  expect(page.items.map((entry) => entry.id)).toEqual([first.id]);
  expect(page.total).toBeGreaterThanOrEqual(2);
  for (const query of ["limit=0", "limit=51", "offset=-1", "offset=1.5", "limit=NaN"])
    expect(
      (await publicUsesResponse(proxy.env, new Request(`https://mochi.example/api/v1/uses?${query}`))).status,
    ).toBe(400);
});

test("cleans up failed writes and permits retrying failed object deletion", async () => {
  const object = await item();
  const failing = {
    ...proxy.env,
    ASSETS_BUCKET: {
      put: async () => {
        throw new Error("test failure");
      },
      delete: proxy.env.ASSETS_BUCKET.delete.bind(proxy.env.ASSETS_BUCKET),
    } as unknown as R2Bucket,
  };
  await expect(addImage(failing, object.id, "failed.png", png)).rejects.toThrow("test failure");
  expect((await readItemMedia(proxy.env.DB, object.id)).assets).toHaveLength(0);
  const asset = await addImage(proxy.env, object.id, "retry.png", png);
  const failedDelete = {
    ...proxy.env,
    ASSETS_BUCKET: {
      delete: async () => {
        throw new Error("delete failed");
      },
    } as unknown as R2Bucket,
  };
  await expect(removeImage(failedDelete, asset.id)).rejects.toThrow("delete failed");
  expect((await readItemMedia(proxy.env.DB, object.id)).assets[0].state).toBe("deleting");
  await removeImage(proxy.env, asset.id);
  expect((await readItemMedia(proxy.env.DB, object.id)).assets).toHaveLength(0);
});
