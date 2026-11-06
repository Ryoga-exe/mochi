import { readFileSync } from "node:fs";

export const jpeg = readFileSync(new URL("./fixtures/photo.jpg", import.meta.url));
export const png = readFileSync(new URL("./fixtures/photo.png", import.meta.url));
