import { redirect } from "@tanstack/react-router";
import imageCompression from "browser-image-compression";
import { type ItemAsset, MAX_IMAGE_BYTES, MAX_ORIGINAL_BYTES, privateImageUrl } from "./media";
import type { MutationResult } from "./mutation";

async function prepareImage(file: File) {
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("元の画像は20MB以下にしてください。");
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml")
    throw new Error("写真または PNG・JPEG・WebP 画像を選んでください。");
  const type = ["image/png", "image/webp"].includes(file.type) ? "image/png" : "image/jpeg";
  let compressed: File;
  try {
    compressed = await imageCompression(file, {
      maxSizeMB: MAX_IMAGE_BYTES / 1024 ** 2,
      maxWidthOrHeight: 2000,
      fileType: type,
      initialQuality: type === "image/png" ? 1 : 0.85,
      // The library's worker loads its script from a CDN by default.
      useWebWorker: false,
    });
  } catch {
    throw new Error("画像を処理できません。JPEG または PNG に変換して再度追加してください。");
  }
  if (compressed.size > MAX_IMAGE_BYTES) throw new Error("画像を5MB以下に変換できませんでした。");
  return new File([compressed], `${file.name.replace(/\.[^.]+$/, "")}.${type === "image/png" ? "png" : "jpg"}`, {
    type,
  });
}

async function imageRequest<T>(url: string, init: RequestInit): Promise<MutationResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { ok: false, message: "通信に失敗しました。接続を確認してください。" };
  }
  if (response.status === 401) throw redirect({ to: "/login" });
  try {
    return await response.json();
  } catch {
    return { ok: false, message: "処理結果を取得できませんでした。再読み込みして確認してください。" };
  }
}

export async function uploadImages({
  data,
}: {
  data: { itemId: string; files: File[] };
}): Promise<MutationResult<{ uploaded: number; errors: string[] }>> {
  let uploaded = 0;
  const errors: string[] = [];
  for (const file of data.files) {
    let prepared: File;
    try {
      prepared = await prepareImage(file);
    } catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "画像を処理できません。"}`);
      continue;
    }
    const body = new FormData();
    body.set("file", prepared);
    const result = await imageRequest<ItemAsset>(`/api/items/${data.itemId}/images`, { method: "POST", body });
    if (result.ok) uploaded++;
    else errors.push(`${file.name}: ${result.message}`);
  }
  return { ok: true, value: { uploaded, errors } };
}

export function deleteImage({ data }: { data: { assetId: string } }) {
  return imageRequest<null>(privateImageUrl(data.assetId), { method: "DELETE" });
}
