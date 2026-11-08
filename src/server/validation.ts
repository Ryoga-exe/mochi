import { itemStatuses, ownerships } from "src/lib/item-attributes";
import { MAX_IMAGES_PER_ITEM, MAX_MARKDOWN_LENGTH } from "src/lib/media";
import { MAX_PUBLIC_DESCRIPTION_LENGTH } from "src/lib/public-item";
import { z } from "zod";

function textInput(label: string, max: number, { required = true, trim = true } = {}) {
  const schema = z.string({ error: `${label}を入力してください。` });
  const message = `${label}は${required ? "1〜" : ""}${max}文字で入力してください。`;
  return (trim ? schema.trim() : schema).min(required ? 1 : 0, message).max(max, message);
}

export const idSchema = z.guid({ error: "対象の ID が不正です。" });
const optionalIdSchema = z
  .union([idSchema, z.literal("")], { error: "対象の ID が不正です。" })
  .nullish()
  .transform((value) => value || null);
const versionSchema = z
  .int({ error: "更新情報が不正です。ページを再読み込みしてください。" })
  .min(1, "更新情報が不正です。ページを再読み込みしてください。");

const identitySchema = z
  .object(
    {
      id: optionalIdSchema,
      version: versionSchema.nullish().transform((value) => value ?? null),
    },
    { error: "入力が不正です。" },
  )
  .refine(({ id, version }) => (id === null) === (version === null), {
    error: "更新情報が不正です。",
  });

const tagSchema = textInput("タグ", 40, { required: false })
  .normalize("NFC")
  .regex(/^[^,、\r\n]*$/, "タグにカンマ・読点・改行は使えません。");
const tagLimitMessage = "タグは20個まで設定できます。";
export const tagsSchema = z
  .union(
    [
      z
        .string()
        .max(1000, "タグの入力が長すぎます。")
        .transform((value) => value.split(/[,、\n]/)),
      z.array(z.unknown()),
    ],
    { error: tagLimitMessage },
  )
  .nullish()
  .transform((value) => value ?? [])
  .pipe(z.array(tagSchema).max(100, tagLimitMessage))
  .transform((tags) => [...new Set(tags.filter(Boolean))])
  .pipe(z.array(z.string()).max(20, tagLimitMessage));

export const itemInputSchema = identitySchema
  .safeExtend({
    name: textInput("品名", 200),
    description: textInput("説明", 10000, { required: false })
      .nullish()
      .transform((value) => value ?? ""),
    isContainer: z
      .boolean({ error: "収納可否の設定が不正です。" })
      .nullish()
      .transform((value) => value ?? false),
    isPublic: z
      .boolean({ error: "公開範囲の設定が不正です。" })
      .nullish()
      .transform((value) => value ?? false),
    publicDescription: textInput("QR 公開用の説明", MAX_PUBLIC_DESCRIPTION_LENGTH, { required: false })
      .nullish()
      .transform((value) => value ?? ""),
    tags: tagsSchema,
    status: z
      .string({ error: "状態が不正です。" })
      .pipe(z.enum(itemStatuses, { error: "状態が不正です。" }))
      .nullish()
      .transform((value) => value ?? "available"),
    ownership: z
      .string({ error: "所有関係が不正です。" })
      .pipe(z.enum(ownerships, { error: "所有関係が不正です。" }))
      .nullish()
      .transform((value) => value ?? "owned"),
    locationId: optionalIdSchema,
    containerItemId: optionalIdSchema,
  })
  .refine(({ locationId, containerItemId }) => !locationId || !containerItemId, {
    error: "収納先は一つだけ指定してください。",
  });

export const locationInputSchema = identitySchema.safeExtend({
  name: textInput("場所名", 100),
  parentId: optionalIdSchema,
});

export const targetSchema = z.object({ id: idSchema, version: versionSchema }, { error: "対象が不正です。" });
export const archiveInputSchema = targetSchema.extend({ archived: z.boolean({ error: "操作が不正です。" }) });
export const itemMediaInputSchema = z.object(
  {
    itemId: z.guid({ error: "物品 ID が不正です。" }),
  },
  { error: "入力が不正です。" },
);

const usesImageSchema = z.object(
  {
    assetId: z.guid({ error: "公開画像の指定が不正です。" }),
    inGallery: z.boolean({ error: "公開画像の指定が不正です。" }),
    alt: textInput("画像の代替テキスト", 300, { required: false }),
    caption: textInput("画像の説明", 1000, { required: false }),
  },
  { error: "公開画像の指定が不正です。" },
);

const externalUrlMessage = "製品リンクは http または https の URL にしてください。";
const externalUrlSchema = textInput("製品リンク", 2000, { required: false })
  .nullish()
  .transform((value) => value ?? "")
  .pipe(
    z.union([z.literal(""), z.url({ protocol: /^https?$/, error: externalUrlMessage })], {
      error: externalUrlMessage,
    }),
  )
  .transform((value) => value || null);
const sortOrderMessage = "表示順は -10000〜10000 の整数にしてください。";

export const usesInputSchema = itemMediaInputSchema
  .extend({
    version: versionSchema.nullable(),
    isPublished: z.boolean({ error: "公開設定が不正です。" }),
    sortOrder: z.int({ error: sortOrderMessage }).min(-10000, sortOrderMessage).max(10000, sortOrderMessage),
    title: textInput("公開タイトル", 200, { required: false }),
    descriptionMarkdown: textInput("公開用の説明", MAX_MARKDOWN_LENGTH, { required: false, trim: false }),
    externalUrl: externalUrlSchema,
    section: textInput("セクション", 100, { required: false })
      .nullish()
      .transform((value) => value ?? ""),
    tags: tagsSchema,
    images: z
      .array(usesImageSchema, { error: "公開画像の指定が不正です。" })
      .max(MAX_IMAGES_PER_ITEM, "公開画像の指定が不正です。")
      .refine((images) => new Set(images.map((image) => image.assetId)).size === images.length, {
        error: "画像を重複して指定できません。",
      }),
  })
  .refine(({ isPublished, title }) => !isPublished || title.length > 0, {
    path: ["title"],
    error: "公開タイトルは1〜200文字で入力してください。",
  });

const paginationMessage = "limit は1〜50、offset は0以上の整数にしてください。";
export const usesPaginationSchema = z.object({
  limit: z.coerce
    .number({ error: paginationMessage })
    .pipe(z.int({ error: paginationMessage }).min(1, paginationMessage).max(50, paginationMessage))
    .default(20),
  offset: z.coerce
    .number({ error: paginationMessage })
    .pipe(z.int({ error: paginationMessage }).min(0, paginationMessage))
    .default(0),
});

export type ItemInput = z.output<typeof itemInputSchema>;
export type LocationInput = z.output<typeof locationInputSchema>;
export type TargetInput = z.output<typeof targetSchema>;
export type ArchiveInput = z.output<typeof archiveInputSchema>;
export type UsesInput = z.output<typeof usesInputSchema>;
