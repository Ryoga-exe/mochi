import { redirect } from "@tanstack/react-router";
import { type ItemAsset, MAX_IMAGE_BYTES, MAX_ORIGINAL_BYTES, privateImageUrl } from "./media";
import type { MutationResult } from "./mutation";

async function prepareImage(file: File) {
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("元の画像は20MB以下にしてください。");
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml")
    throw new Error("写真または PNG・JPEG・WebP 画像を選んでください。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像を処理できません。");
    let scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const type = ["image/png", "image/webp"].includes(file.type) ? "image/png" : "image/jpeg";
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
      if (!blob) throw new Error("画像を変換できません。");
      if (blob.size <= MAX_IMAGE_BYTES) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${type === "image/png" ? "png" : "jpg"}`, {
          type,
        });
      }
      scale *= 0.75;
    }
    throw new Error("画像を5MB以下に変換できませんでした。");
  } catch (error) {
    if (error instanceof Error && error.name === "EncodingError")
      throw new Error("読み込めない画像です。JPEG または PNG に変換してください。");
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
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
