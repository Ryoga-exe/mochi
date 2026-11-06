import { imageSize } from "image-size";
import { jpeg, png } from "picscrub";
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "src/lib/media";
import { InventoryError } from "src/lib/mutation";

function invalid(): never {
  throw new InventoryError("画像を読み取れません。JPEG または PNG を選んでください。");
}
export function sanitizeImage(data: Uint8Array) {
  if (data.length > MAX_IMAGE_BYTES) throw new InventoryError("画像は1枚5MB以下にしてください。");
  try {
    const { width, height, type } = imageSize(data);
    if (type !== "jpg" && type !== "png") invalid();
    if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE)
      throw new InventoryError(`画像の縦横は ${MAX_IMAGE_EDGE}px 以下にしてください。`);
    const cleaned = type === "jpg" ? jpeg.remove(data) : png.remove(data);
    // Metadata removal can succeed on truncated input; require the image's closing marker.
    const end = type === "jpg" ? [0xff, 0xd9] : [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
    if (!end.every((byte, index) => cleaned[cleaned.length - end.length + index] === byte)) invalid();
    return {
      width,
      height,
      contentType: type === "jpg" ? ("image/jpeg" as const) : ("image/png" as const),
      data: cleaned,
    };
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    return invalid();
  }
}
