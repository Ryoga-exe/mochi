import { useHydrated, useRouterState } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { saveItemAction } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import {
  containerChoices,
  type InventoryIndex,
  type Item,
  itemCode,
  locationPath,
  ownershipLabels,
  statusLabels,
  storageLabel,
} from "src/lib/inventory";
import { MAX_PUBLIC_DESCRIPTION_LENGTH } from "src/lib/public-item";

export function ItemForm({
  item,
  inventory,
  onSaved,
}: {
  item?: Item;
  inventory: InventoryIndex;
  onSaved: (item: Item) => Promise<void>;
}) {
  const { run, pending, error } = useMutation(saveItemAction);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const storage = item?.containerItemId
    ? `item:${item.containerItemId}`
    : item?.locationId
      ? `location:${item.locationId}`
      : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const destination = String(data.get("storage") ?? "");
    await run(
      {
        id: item?.id ?? null,
        version: item?.version ?? null,
        name: String(data.get("name") ?? ""),
        description: String(data.get("description") ?? ""),
        isContainer: data.has("isContainer"),
        isPublic: data.has("isPublic"),
        publicDescription: String(data.get("publicDescription") ?? ""),
        tags: String(data.get("tags") ?? ""),
        status: String(data.get("status") ?? ""),
        ownership: String(data.get("ownership") ?? ""),
        locationId: destination.startsWith("location:") ? destination.slice(9) : null,
        containerItemId: destination.startsWith("item:") ? destination.slice(5) : null,
      },
      onSaved,
    );
  }

  return (
    <form method="post" onSubmit={submit}>
      <fieldset disabled={!hydrated || pending || navigating}>
        <legend>{item ? "物品を編集" : "物品を登録"}</legend>
        <p>
          <label>
            品名（必須）
            <br />
            <input name="name" required maxLength={200} defaultValue={item?.name ?? ""} />
          </label>
        </p>
        <p>
          <label>
            説明・メモ
            <br />
            <textarea name="description" rows={6} cols={50} maxLength={10000} defaultValue={item?.description ?? ""} />
          </label>
        </p>
        <p>
          <label>
            <input type="checkbox" name="isContainer" defaultChecked={item?.isContainer ?? false} />
            この物品を収納先として使う（バッグ・箱など）
          </label>
        </p>
        <p>収納先の候補には、この設定をオンにした物品だけが表示されます。中身がある間はオフにできません。</p>
        <p>
          <label>
            タグ（カンマ区切り）
            <br />
            <input
              name="tags"
              maxLength={1000}
              placeholder="ガジェット, USB-C, 予備"
              defaultValue={item?.tags.join(", ") ?? ""}
            />
          </label>
        </p>
        <p>タグは1つ40文字、20個まで設定できます。</p>
        <p>
          <label>
            収納先
            <br />
            <select name="storage" defaultValue={storage}>
              <option value="">未設定</option>
              <optgroup label="場所">
                {inventory.locations.map((location) => (
                  <option key={location.id} value={`location:${location.id}`}>
                    {locationPath(location, inventory)
                      .map((entry) => entry.name)
                      .join(" › ")}
                  </option>
                ))}
              </optgroup>
              <optgroup label="物品の中">
                {containerChoices(inventory, item?.id).map((container) => (
                  <option key={container.id} value={`item:${container.id}`}>
                    {container.name} [{itemCode(container)}] — {storageLabel(container, inventory)}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        </p>
        <p>
          <label>
            状態
            <br />
            <select name="status" defaultValue={item?.status ?? "available"}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p>
          <label>
            所有関係
            <br />
            <select name="ownership" defaultValue={item?.ownership ?? "owned"}>
              {Object.entries(ownershipLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </p>
        <fieldset>
          <legend>QR ページの公開範囲</legend>
          <p>
            <label>
              <input type="checkbox" name="isPublic" defaultChecked={item?.isPublic ?? false} />
              未ログインでも物品の基本情報を表示する
            </label>
          </p>
          <p>
            オンにすると、持ち主の表示名・品名・状態と、以下の短い説明を公開します。管理メモ・収納先・タグ・画像は表示しません。uses
            API の公開設定とは別です。
          </p>
          <p>
            <label>
              短い説明（QR 公開用）
              <br />
              <textarea
                name="publicDescription"
                rows={3}
                cols={50}
                maxLength={MAX_PUBLIC_DESCRIPTION_LENGTH}
                defaultValue={item?.publicDescription ?? ""}
              />
            </label>
          </p>
          <p>{MAX_PUBLIC_DESCRIPTION_LENGTH}文字まで。管理メモからは自動転記しません。</p>
        </fieldset>
        <button type="submit">{pending ? "保存中…" : "保存"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
