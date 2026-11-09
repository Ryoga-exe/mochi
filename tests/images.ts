import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";

export const jpeg = readFileSync(new URL("./fixtures/photo.jpg", import.meta.url));
export const progressiveJpeg = readFileSync(new URL("./fixtures/progressive.jpg", import.meta.url));
export const png = readFileSync(new URL("./fixtures/photo.png", import.meta.url));

export function jpegSegment(marker: number, data: Uint8Array) {
  const segment = Buffer.alloc(data.length + 4);
  segment[0] = 0xff;
  segment[1] = marker;
  segment.writeUInt16BE(data.length + 2, 2);
  segment.set(data, 4);
  return segment;
}

export function pngChunk(type: string, data: Uint8Array) {
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  chunk.write(type, 4);
  chunk.set(data, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return chunk;
}
