import { MAX_IMAGE_BYTES } from "src/lib/media";
import { sanitizeImage } from "src/server/image-data";
import { expect, test } from "vitest";
import { png } from "./images";

test("preserves JPEG pixels while removing EXIF, comments and trailing bytes", () => {
  const photo = readFileSync(new URL("./fixtures/photo.jpg", import.meta.url));
  const metadata = Buffer.from("Exif GPS private location");
  const app = Buffer.alloc(metadata.length + 4);
  app[0] = 0xff;
  app[1] = 0xe1;
  app.writeUInt16BE(metadata.length + 2, 2);
  metadata.copy(app, 4);
  const result = sanitizeImage(Buffer.concat([photo.subarray(0, 2), app, photo.subarray(2), Buffer.from("trailing")]));
  expect(result).toMatchObject({ width: 4, height: 3, contentType: "image/jpeg" });
  expect(Buffer.from(result.data).includes(metadata)).toBe(false);
  expect(Buffer.from(result.data).subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  expect(() => sanitizeImage(photo.subarray(0, -2))).toThrow();
});

test("reads PNG dimensions and removes textual metadata and trailing data", () => {
  const metadata = Buffer.from("GPS private location");
  const chunk = Buffer.alloc(metadata.length + 12);
  chunk.writeUInt32BE(metadata.length);
  chunk.write("tEXt", 4);
  metadata.copy(chunk, 8);
  const input = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33), Buffer.from("private trailing data")]);
  const result = sanitizeImage(input);
  expect(result).toMatchObject({ width: 1, height: 1, contentType: "image/png" });
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
  expect(() => sanitizeImage(large)).toThrow("2400px");
});

import { readFileSync } from "node:fs";
