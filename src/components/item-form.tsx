import { Alert, Button, Checkbox, Fieldset, NativeSelect, Textarea, TextInput } from "@mantine/core";
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
import classes from "src/styles/layout.module.css";

export function ItemForm({
  item,
  inventory,
  onSaved,
  onCancel,
}: {
  item?: Item;
  inventory: InventoryIndex;
  onSaved: (item: Item) => Promise<void>;
  onCancel?: () => void;
}) {
  const { run, pending, error } = useMutation(saveItemAction);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const hasDetails = Boolean(
    item && (item.description || item.tags.length || item.status !== "available" || item.ownership !== "owned"),
  );
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
      <Fieldset
        legend={item ? "物品を編集" : "物品を登録"}
        disabled={!hydrated || pending || navigating}
        className={classes.fields}
      >
        <TextInput
          autoFocus={Boolean(item)}
          name="name"
          label="品名"
          required
          maxLength={200}
          defaultValue={item?.name ?? ""}
        />
        <NativeSelect name="storage" label="収納先" defaultValue={storage}>
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
        </NativeSelect>
        <Checkbox
          name="isContainer"
          label="ほかの物品を収納できる"
          description="バッグや箱など"
          defaultChecked={item?.isContainer ?? false}
        />
        <details className={classes.details} open={hasDetails}>
          <summary>メモ・タグ・状態など</summary>
          <div className={classes.fields}>
            <Textarea
              name="description"
              label="説明・メモ"
              rows={6}
              maxLength={10000}
              defaultValue={item?.description ?? ""}
            />
            <TextInput
              name="tags"
              label="タグ（カンマ区切り）"
              maxLength={1000}
              placeholder="ガジェット, USB-C, 予備"
              defaultValue={item?.tags.join(", ") ?? ""}
            />
            <NativeSelect name="status" label="状態" defaultValue={item?.status ?? "available"}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect name="ownership" label="所有関係" defaultValue={item?.ownership ?? "owned"}>
              {Object.entries(ownershipLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </details>
        <details className={classes.details}>
          <summary>QR ページの公開設定</summary>
          <div className={classes.fields}>
            <Checkbox
              name="isPublic"
              label="QR ページを公開する"
              description="公開内容：持ち主の表示名・品名・状態・短い説明"
              defaultChecked={item?.isPublic ?? false}
            />
            <Textarea
              name="publicDescription"
              label="短い説明（QR 公開用）"
              description={`${MAX_PUBLIC_DESCRIPTION_LENGTH}文字まで`}
              rows={3}
              maxLength={MAX_PUBLIC_DESCRIPTION_LENGTH}
              defaultValue={item?.publicDescription ?? ""}
            />
          </div>
        </details>
        {error && <Alert color="red">{error}</Alert>}
        <div className={classes.actions}>
          <Button type="submit" loading={pending}>
            {pending ? "保存中…" : item ? "変更を保存" : "登録して詳細へ"}
          </Button>
          {onCancel && (
            <Button type="button" variant="default" onClick={onCancel}>
              キャンセル
            </Button>
          )}
        </div>
      </Fieldset>
    </form>
  );
}
