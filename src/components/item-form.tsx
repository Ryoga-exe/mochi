import { useHydrated, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { saveItemAction } from "src/functions/inventory";
import {
  containerChoices,
  type Inventory,
  type Item,
  itemCode,
  locationPath,
  ownershipLabels,
  statusLabels,
  storageLabel,
} from "src/lib/inventory";

export function ItemForm({
  item,
  inventory,
  onSaved,
}: {
  item?: Item;
  inventory: Inventory;
  onSaved: (item: Item) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [error, setError] = useState("");
  const storage = item?.containerItemId
    ? `item:${item.containerItemId}`
    : item?.locationId
      ? `location:${item.locationId}`
      : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const destination = String(data.get("storage") ?? "");
    setPending(true);
    setError("");
    try {
      const result = await saveItemAction({
        data: {
          id: item?.id ?? null,
          version: item?.version ?? null,
          name: data.get("name"),
          description: data.get("description"),
          isContainer: data.has("isContainer"),
          tags: data.get("tags"),
          status: data.get("status"),
          ownership: data.get("ownership"),
          locationId: destination.startsWith("location:") ? destination.slice(9) : null,
          containerItemId: destination.startsWith("item:") ? destination.slice(5) : null,
        },
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await onSaved(result.value);
    } catch {
      setError("保存できませんでした。ログイン状態と接続を確認してください。");
    } finally {
      setPending(false);
    }
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
                    {locationPath(location, inventory.locations)
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
        <button type="submit">{pending ? "保存中…" : "保存"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
