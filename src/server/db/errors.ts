import { InventoryError } from "src/lib/mutation";

function causeMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("message" in error) || typeof error.message !== "string") return;
  return ("cause" in error ? causeMessage(error.cause) : undefined) ?? error.message;
}

export function databaseError(error: unknown): unknown {
  // Drizzle's wrapper includes SQL and parameter values. Only inspect the SQLite cause.
  const code =
    causeMessage(error)
      ?.replace(/^D1_ERROR: /, "")
      .split(": SQLITE_CONSTRAINT")[0] ?? "";
  const messages: Record<string, string> = {
    asset_in_use: "uses の画像選択と本文から画像を外して保存してから削除してください。",
    too_many_images: "画像は1物品につき20枚までです。",
    invalid_public_image: "公開画像はこの物品に追加済みの画像から選んでください。",
    archived_item: "アーカイブ済みの物品は管理中に戻してから編集してください。",
    item_cycle: "自分自身や、自分の配下には移動できません。",
    location_cycle: "自分自身や、自分の配下には移動できません。",
    container_not_empty: "中身がある物品はアーカイブできません。先に中身を移動してください。",
    container_flag_in_use: "中身がある間は収納先の設定をオフにできません。先に中身を移動してください。",
    not_a_container: "収納先として使える物品を選んでください。入れ物側の「収納先として使う」をオンにできます。",
    archived_container: "アーカイブ済みの物品には収納できません。",
    "FOREIGN KEY constraint failed": "収納先が存在しないか、この場所に物品・子の場所が残っています。",
  };
  return Object.hasOwn(messages, code) ? new InventoryError(messages[code]) : error;
}
