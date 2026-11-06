import { isItemStatus, isOwnership } from "src/lib/item-attributes";

export class InventoryError extends Error {}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InventoryError("入力が不正です。");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== "string") throw new InventoryError(`${label}を入力してください。`);
  const result = value.trim();
  if ((required && !result) || result.length > max) {
    throw new InventoryError(`${label}は${required ? "1〜" : ""}${max}文字で入力してください。`);
  }
  return result;
}

function id(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) {
    throw new InventoryError("対象の ID が不正です。");
  }
  return value;
}

function version(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new InventoryError("更新情報が不正です。ページを再読み込みしてください。");
  }
  return value;
}

function identity(data: Record<string, unknown>) {
  const result = { id: id(data.id), version: version(data.version) };
  if ((result.id === null) !== (result.version === null)) throw new InventoryError("更新情報が不正です。");
  return result;
}

function parseTags(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string" && value.length > 1000) throw new InventoryError("タグの入力が長すぎます。");
  const values = typeof value === "string" ? value.split(/[,、\n]/) : value;
  if (!Array.isArray(values) || values.length > 100) throw new InventoryError("タグは20個まで設定できます。");
  const tags = values.map((value) => {
    const tag = text(value, "タグ", 40, false).normalize("NFC");
    if (/[,、\r\n]/.test(tag)) throw new InventoryError("タグにカンマ・読点・改行は使えません。");
    return tag;
  });
  const unique = [...new Set(tags.filter(Boolean))];
  if (unique.length > 20) throw new InventoryError("タグは20個まで設定できます。");
  return unique;
}

export function parseItemInput(value: unknown) {
  const data = object(value);
  const isContainer = data.isContainer ?? false;
  if (typeof isContainer !== "boolean") throw new InventoryError("収納可否の設定が不正です。");
  const status = data.status ?? "available";
  const ownership = data.ownership ?? "owned";
  if (!isItemStatus(status)) throw new InventoryError("状態が不正です。");
  if (!isOwnership(ownership)) throw new InventoryError("所有関係が不正です。");
  const result = {
    ...identity(data),
    name: text(data.name, "品名", 200),
    description: text(data.description ?? "", "説明", 10000, false),
    isContainer,
    tags: parseTags(data.tags),
    status,
    ownership,
    locationId: id(data.locationId),
    containerItemId: id(data.containerItemId),
  };
  if (result.locationId && result.containerItemId) throw new InventoryError("収納先は一つだけ指定してください。");
  return result;
}

export function parseLocationInput(value: unknown) {
  const data = object(value);
  return { ...identity(data), name: text(data.name, "場所名", 100), parentId: id(data.parentId) };
}

export function parseTarget(value: unknown) {
  const data = object(value);
  const targetId = id(data.id);
  const targetVersion = version(data.version);
  if (!targetId || !targetVersion) throw new InventoryError("対象が不正です。");
  return { id: targetId, version: targetVersion };
}

export function parseArchiveInput(value: unknown) {
  const data = object(value);
  if (typeof data.archived !== "boolean") throw new InventoryError("操作が不正です。");
  return { ...parseTarget(value), archived: data.archived };
}

export type ItemInput = ReturnType<typeof parseItemInput>;
export type LocationInput = ReturnType<typeof parseLocationInput>;
