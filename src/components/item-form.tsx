import { Alert, Button, Checkbox, Fieldset, NativeSelect, Select, TagsInput, Textarea, TextInput } from "@mantine/core";
import { useHydrated, useRouterState } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { saveItemAction } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import {
  availableTags,
  containerChoices,
  type InventoryIndex,
  type Item,
  itemCode,
  locationPath,
  ownershipLabels,
  statusLabels,
  storageLabel,
} from "src/lib/inventory";
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
        isPublic: item?.isPublic ?? false,
        publicDescription: item?.publicDescription ?? "",
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
    <form method="post" onSubmit={submit} className={classes.form}>
      <Fieldset
        variant="unstyled"
        aria-label={item ? "物品を編集" : "物品を登録"}
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
        <Select
          name="storage"
          label="収納先"
          placeholder="未設定"
          defaultValue={storage || null}
          searchable
          clearable
          nothingFoundMessage="一致する収納先がありません"
          clearButtonProps={{ "aria-label": "収納先を解除", "aria-hidden": false, tabIndex: 0 }}
          data={[
            {
              group: "場所",
              items: inventory.locations.map((location) => ({
                value: `location:${location.id}`,
                label: locationPath(location, inventory)
                  .map((entry) => entry.name)
                  .join(" › "),
              })),
            },
            {
              group: "物品の中",
              items: containerChoices(inventory, item?.id).map((container) => ({
                value: `item:${container.id}`,
                label: `${container.name} [${itemCode(container)}] — ${storageLabel(container, inventory)}`,
              })),
            },
          ]}
        />
        <Checkbox
          name="isContainer"
          label="ほかの物品を収納できる"
          description="バッグや箱など"
          defaultChecked={item?.isContainer ?? false}
        />
        <TagsInput
          name="tags"
          label="タグ"
          placeholder="入力して Enter"
          defaultValue={item?.tags ?? []}
          data={availableTags(inventory)}
          splitChars={[",", "、", "\n"]}
          maxLength={40}
        />
        <div className={classes.formRow}>
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
        <Textarea
          name="description"
          label="説明・メモ"
          autosize
          minRows={3}
          maxRows={8}
          maxLength={10000}
          defaultValue={item?.description ?? ""}
        />
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
