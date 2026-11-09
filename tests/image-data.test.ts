import { crc32, deflateSync } from "node:zlib";
import { MAX_IMAGE_BYTES } from "src/lib/media";
import { sanitizeImage } from "src/server/image-data";
import { expect, test } from "vitest";
import { jpeg, jpegSegment, png, pngChunk, progressiveJpeg } from "./images";

test.each([
  { format: "baseline", image: jpeg },
  { format: "progressive", image: progressiveJpeg },
])("preserves $format JPEG scans while removing metadata and trailing bytes", ({ image }) => {
  const metadata = Buffer.from("Exif GPS private location");
  const app = jpegSegment(0xe1, metadata);
  const result = sanitizeImage(Buffer.concat([image.subarray(0, 2), app, image.subarray(2), Buffer.from("trailing")]));
  expect(result).toMatchObject({ width: 4, height: 3, contentType: "image/jpeg" });
  expect(Buffer.from(result.data).includes(metadata)).toBe(false);
  const scan = image.subarray(image.indexOf(Buffer.from([0xff, 0xda])));
  expect(Buffer.from(result.data).subarray(-scan.length)).toEqual(scan);
  expect(() => sanitizeImage(image.subarray(0, -2))).toThrow();
});

test("rejects JPEG comments and APP metadata after or between scans", () => {
  for (const image of [jpeg, progressiveJpeg]) {
    const firstScan = image.indexOf(Buffer.from([0xff, 0xda]));
    const nextTable = image.indexOf(Buffer.from([0xff, 0xc4]), firstScan);
    const positions = nextTable < 0 ? [image.length - 2] : [nextTable, image.length - 2];
    for (const position of positions) {
      for (const marker of [0xfe, 0xe0, 0xe1, 0xef]) {
        const segment = jpegSegment(marker, Buffer.from("private location"));
        const input = Buffer.concat([image.subarray(0, position), segment, image.subarray(position)]);
        expect(() => sanitizeImage(input)).toThrow();
      }
    }
  }
});

test("reads PNG dimensions and removes textual metadata and trailing data", () => {
  const metadata = Buffer.from("Description\0GPS private location");
  const chunk = pngChunk("tEXt", metadata);
  const input = Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33), Buffer.from("private trailing data")]);
  const result = sanitizeImage(input);
  expect(result).toMatchObject({ width: 4, height: 3, contentType: "image/png" });
  expect(Buffer.from(result.data)).toEqual(png);
});

test("rejects PNG files with missing, empty, corrupt or excessive image data and invalid endings", () => {
  const header = png.subarray(0, 33);
  const end = png.subarray(-12);
  expect(() => sanitizeImage(Buffer.concat([header, end]))).toThrow();
  for (const data of [
    Buffer.alloc(0),
    Buffer.from("not a deflate stream"),
    deflateSync(Buffer.alloc(0)),
    deflateSync(Buffer.alloc(1000)),
    deflateSync(Buffer.alloc(51)).subarray(0, -1),
  ]) {
    expect(() => sanitizeImage(Buffer.concat([header, pngChunk("IDAT", data), end]))).toThrow();
  }
  expect(() => sanitizeImage(png.subarray(0, -12))).toThrow();
  expect(() => sanitizeImage(Buffer.concat([png.subarray(0, -12), pngChunk("IEND", Buffer.from([0]))]))).toThrow();
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
