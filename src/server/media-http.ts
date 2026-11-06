import { and, eq } from "drizzle-orm";
import { MAX_IMAGE_BYTES } from "src/lib/media";
import { z } from "zod";
import type { AuthEnv } from "./auth";
import { getDb } from "./db";
import { itemAssets } from "./db/schema";
import { adminResponse, errorResponse, HttpError, limitedBody, privateHeaders, publicHeaders } from "./http";
import { addImage, type MediaEnv, removeImage } from "./media";
import { publicUse, publicUses } from "./uses";
import { idSchema, usesPaginationSchema } from "./validation";

export function uploadImageResponse(env: MediaEnv & AuthEnv, request: Request, itemId: string) {
  return adminResponse(env, request, async () => {
    idSchema.parse(itemId);
    const bytes = await limitedBody(request, MAX_IMAGE_BYTES + 1024 * 1024);
    let form: FormData;
    try {
      form = await new Request(request.url, { method: "POST", headers: request.headers, body: bytes }).formData();
    } catch {
      throw new HttpError(400, "画像を multipart/form-data で送信してください。");
    }
    const file = z.file({ error: "画像を選んでください。" }).parse(form.get("file"));
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, "画像は1枚5MB以下にしてください。");
    const asset = await addImage(env, itemId, file.name, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ ok: true, value: asset }, { status: 201, headers: privateHeaders });
  });
}

export function privateImageResponse(env: MediaEnv & AuthEnv, request: Request, assetId: string) {
  return adminResponse(env, request, async () => {
    if (request.method === "DELETE") {
      await removeImage(env, assetId);
      return Response.json({ ok: true, value: null }, { headers: privateHeaders });
    }
    const [asset] = await getDb(env.DB)
      .select()
      .from(itemAssets)
      .where(and(eq(itemAssets.id, assetId), eq(itemAssets.state, "ready")))
      .limit(1);
    if (!asset) throw new HttpError(404, "画像が見つかりません。");
    const object = await env.ASSETS_BUCKET.get(asset.objectKey);
    if (!object) throw new HttpError(404, "画像が見つかりません。");
    return new Response(object.body, { headers: { ...privateHeaders, "Content-Type": asset.contentType } });
  });
}

export async function publicUsesResponse(env: Pick<MediaEnv, "DB">, request: Request, entryId?: string) {
  try {
    if (entryId) {
      const entry = await publicUse(env.DB, entryId);
      if (!entry?.content) throw new HttpError(404, "公開情報が見つかりません。");
      return Response.json(entry.content, { headers: publicHeaders });
    }
    const url = new URL(request.url);
    const { limit, offset } = usesPaginationSchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });
    return Response.json(await publicUses(env.DB, limit, offset), { headers: publicHeaders });
  } catch (error) {
    return errorResponse(error, publicHeaders);
  }
}

export async function publicImageResponse(env: MediaEnv, entryId: string, assetId: string) {
  try {
    const entry = await publicUse(env.DB, entryId);
    if (!entry?.content?.images.some((image) => image.assetId === assetId))
      throw new HttpError(404, "画像が見つかりません。");
    const [asset] = await getDb(env.DB)
      .select()
      .from(itemAssets)
      .where(and(eq(itemAssets.id, assetId), eq(itemAssets.itemId, entry.itemId), eq(itemAssets.state, "ready")))
      .limit(1);
    if (!asset) throw new HttpError(404, "画像が見つかりません。");
    const object = await env.ASSETS_BUCKET.get(asset.objectKey);
    if (!object) throw new HttpError(404, "画像が見つかりません。");
    return new Response(object.body, { headers: { ...publicHeaders, "Content-Type": asset.contentType } });
  } catch (error) {
    return errorResponse(error, publicHeaders);
  }
}
