import { crc32 } from "node:zlib";
import { MAX_IMAGE_BYTES } from "src/lib/media";
import { sanitizeImage } from "src/server/image-data";
import { expect, test } from "vitest";
import { jpeg, png } from "./images";

test("preserves JPEG image data while removing metadata and trailing bytes", () => {
  const metadata = Buffer.from("Exif GPS private location");
  const app = Buffer.alloc(metadata.length + 4);
  app[0] = 0xff;
  app[1] = 0xe1;
  app.writeUInt16BE(metadata.length + 2, 2);
  metadata.copy(app, 4);
  const result = sanitizeImage(Buffer.concat([jpeg.subarray(0, 2), app, jpeg.subarray(2), Buffer.from("trailing")]));
  expect(result).toMatchObject({ width: 4, height: 3, contentType: "image/jpeg" });
  expect(Buffer.from(result.data).includes(metadata)).toBe(false);
  const scan = jpeg.subarray(jpeg.indexOf(Buffer.from([0xff, 0xda])));
  expect(Buffer.from(result.data).subarray(-scan.length)).toEqual(scan);
  expect(() => sanitizeImage(jpeg.subarray(0, -2))).toThrow();
});

test("reads PNG dimensions and removes textual metadata and trailing data", () => {
  const metadata = Buffer.from("Description\0GPS private location");
  const chunk = Buffer.alloc(metadata.length + 12);
  chunk.writeUInt32BE(metadata.length);
  chunk.write("tEXt", 4);
  metadata.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  const input = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33), Buffer.from("private trailing data")]);
  const result = sanitizeImage(input);
  expect(result).toMatchObject({ width: 4, height: 3, contentType: "image/png" });
  expect(Buffer.from(result.data)).toEqual(png);
});

test("rejects executable formats, truncated files, oversized files and dimensions", () => {
  for (const input of [
    Buffer.from('<svg onload="alert(1)"/>'),
    png.subarray(0, -5),
    Buffer.alloc(MAX_IMAGE_BYTES + 1),
  ]) {
    expect(() => sanitizeImage(input)).toThrow();
  }
  const large = Buffer.from(png);
  large.writeUInt32BE(100000, 16);
  large.writeUInt32BE(crc32(large.subarray(12, 29)), 29);
  expect(() => sanitizeImage(large)).toThrow("2400px");
});
