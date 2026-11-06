import { MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "src/lib/media";
import { InventoryError } from "./validation";

function invalid(): never {
  throw new InventoryError("画像を読み取れません。JPEG または PNG を選んでください。");
}
function dimensions(width: number, height: number) {
  if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE) {
    throw new InventoryError(`画像の縦横は ${MAX_IMAGE_EDGE}px 以下にしてください。`);
  }
  return { width, height };
}
function join(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// Keep the encoded image data; remove EXIF, comments and other metadata without decoding pixels on Workers.
function jpeg(data: Uint8Array) {
  const chunks = [data.subarray(0, 2)];
  let offset = 2;
  let size: { width: number; height: number } | undefined;
  let scanned = false;
  while (offset < data.length) {
    const start = offset;
    if (data[offset++] !== 0xff) invalid();
    while (data[offset] === 0xff) offset++;
    const marker = data[offset++];
    if (marker === 0xd9) {
      if (!size || !scanned) invalid();
      chunks.push(data.subarray(start, offset));
      return { ...size, contentType: "image/jpeg" as const, data: join(chunks) };
    }
    if (marker === undefined || marker === 0xd8 || marker === 0 || (marker >= 0xd0 && marker <= 0xd7)) invalid();
    if (offset + 2 > data.length) invalid();
    const length = data[offset] * 256 + data[offset + 1];
    const end = offset + length;
    if (length < 2 || end > data.length) invalid();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8 || data[offset + 2] !== 8 || ![1, 3].includes(data[offset + 7])) invalid();
      size = dimensions(data[offset + 5] * 256 + data[offset + 6], data[offset + 3] * 256 + data[offset + 4]);
    }
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) chunks.push(data.subarray(start, end));
    offset = end;
    if (marker === 0xda) {
      if (!size) invalid();
      scanned = true;
      const scanStart = offset;
      while (offset < data.length) {
        if (data[offset] !== 0xff) {
          offset++;
          continue;
        }
        let next = offset + 1;
        while (data[next] === 0xff) next++;
        const code = data[next];
        if (code === 0 || (code >= 0xd0 && code <= 0xd7)) {
          offset = next + 1;
          continue;
        }
        break;
      }
      chunks.push(data.subarray(scanStart, offset));
    }
  }
  return invalid();
}

function png(data: Uint8Array) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => data[index] === byte)) invalid();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const chunks = [data.subarray(0, 8)];
  const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "sRGB", "gAMA", "cHRM"]);
  let offset = 8;
  let size: { width: number; height: number } | undefined;
  let imageData = false;
  while (offset + 12 <= data.length) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > data.length) invalid();
    const type = String.fromCharCode(...data.subarray(offset + 4, offset + 8));
    if (!size && type !== "IHDR") invalid();
    if (["acTL", "fcTL", "fdAT"].includes(type)) throw new InventoryError("アニメーション画像は追加できません。");
    if (type === "IHDR") {
      if (size || length !== 13) invalid();
      size = dimensions(view.getUint32(offset + 8), view.getUint32(offset + 12));
    }
    if (type === "IDAT") imageData = true;
    if (!keep.has(type) && /^[A-Z]/.test(type)) invalid();
    if (keep.has(type)) chunks.push(data.subarray(offset, end));
    if (type === "IEND") {
      if (!size || !imageData || length !== 0) invalid();
      return { ...size, contentType: "image/png" as const, data: join(chunks) };
    }
    offset = end;
  }
  return invalid();
}

export function sanitizeImage(data: Uint8Array) {
  if (data.length > MAX_IMAGE_BYTES) throw new InventoryError("画像は1枚5MB以下にしてください。");
  return data[0] === 0xff && data[1] === 0xd8 ? jpeg(data) : png(data);
}
