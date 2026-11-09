import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import { imageSize } from "image-size";
import { jpeg, png } from "picscrub";
import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "src/lib/media";
import { InventoryError } from "src/lib/mutation";

function invalid(): never {
  throw new InventoryError("画像を読み取れません。JPEG または PNG を選んでください。");
}

function validateJpegScans(data: Uint8Array) {
  const scan = jpeg.parseSegments(data).find((segment) => segment.marker === 0xffda);
  if (!scan) invalid();
  let offset = scan.offset;
  let inScan = false;
  while (offset < data.length) {
    if (data[offset++] !== 0xff) {
      if (!inScan) invalid();
      continue;
    }
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (inScan && (marker === 0 || (marker >= 0xd0 && marker <= 0xd7))) continue;
    if (marker === 0xd9 && offset === data.length) return;
    // shortcut: Reject post-scan metadata until picscrub can remove it without touching scan data.
    if (marker === 0xfe || (marker >= 0xe0 && marker <= 0xef)) invalid();
    const length = (data[offset] << 8) | data[offset + 1];
    if (length < 2 || offset + length > data.length) invalid();
    offset += length;
    inScan = marker === 0xda;
  }
  invalid();
}

export function sanitizeImage(data: Uint8Array) {
  if (data.length > MAX_IMAGE_BYTES) throw new InventoryError("画像は1枚5MB以下にしてください。");
  try {
    const { width, height, type } = imageSize(data);
    if (type !== "jpg" && type !== "png") invalid();
    if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE)
      throw new InventoryError(`画像の縦横は ${MAX_IMAGE_EDGE}px 以下にしてください。`);
    const cleaned = type === "jpg" ? jpeg.remove(data) : png.remove(data);
    if (type === "jpg") {
      validateJpegScans(cleaned);
    } else {
      const chunks = png.parseChunks(cleaned);
      const first = chunks[0];
      const last = chunks.at(-1);
      if (first?.type !== "IHDR" || first.data.length !== 13 || last?.type !== "IEND" || last.data.length !== 0)
        invalid();
      const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
      // 16-bit RGBA needs 8 bytes per pixel; seven passes bound interlaced row overhead.
      const maxOutputLength = (width * 8 + 7) * height;
      // shortcut: Check chunks and deflate data; use a decoder if pixel-level validation is needed.
      if (!inflateSync(compressed, { maxOutputLength }).length) invalid();
    }
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
