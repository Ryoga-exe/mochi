import type { itemAssets, usesEntries } from "src/server/db/schema";

export const MAX_IMAGES_PER_ITEM = 20;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 2400;
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const MAX_MARKDOWN_LENGTH = 20000;

export type ItemAsset = typeof itemAssets.$inferSelect;
export type UsesEntry = typeof usesEntries.$inferSelect;

export type UsesImage = { assetId: string; alt: string; caption: string; inGallery: boolean };
export type PublicImage = UsesImage & { url: string; width: number; height: number };
export type PublicUse = {
  id: string;
  title: string;
  descriptionMarkdown: string;
  descriptionHtml: string;
  externalUrl: string | null;
  section: string;
  tags: string[];
  images: PublicImage[];
  updatedAt: string;
};

export function assetReference(id: string) {
  return `mochi-asset:${id}`;
}
export function referencedAsset(url: string) {
  return /^mochi-asset:([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})$/i.exec(url)?.[1];
}
export function privateImageUrl(id: string) {
  return `/api/images/${id}`;
}
export function publicImageUrl(baseUrl: string, entryId: string, assetId: string) {
  return new URL(`/api/v1/uses/${entryId}/images/${assetId}`, baseUrl).href;
}
