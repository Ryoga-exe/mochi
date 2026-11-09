import { Anchor, Button, Fieldset, NativeSelect, Text, TextInput, Title } from "@mantine/core";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useMemo } from "react";
import { ItemTable } from "src/components/inventory";
import { getInventory } from "src/functions/inventory";
import { availableTags, createInventoryIndex, filterItems, locationPath, statusLabels } from "src/lib/inventory";
import { itemStatuses } from "src/lib/item-attributes";
import classes from "src/styles/layout.module.css";
import { z } from "zod";

const searchSchema = z.object({
  q: z
    .string()
    .transform((value) => value.slice(0, 200))
    .catch("")
    .default(""),
  tag: z
    .string()
    .trim()
    .normalize("NFC")
    .transform((value) => value.slice(0, 40))
    .catch("")
    .default(""),
  location: z.string().catch("").default(""),
  status: z.enum(itemStatuses).or(z.literal("")).catch("").default(""),
  archived: z.enum(["active", "archived", "all"]).catch("active").default("active"),
});

export const Route = createFileRoute("/_app/")({
  validateSearch: searchSchema,
  loader: () => getInventory(),
  component: ItemList,
});

function ItemList() {
  const data = Route.useLoaderData();
  const inventory = useMemo(() => createInventoryIndex(data), [data]);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const filtered = filterItems(inventory, search);
  const tags = availableTags(inventory);
  const hasFilters = Boolean(search.tag || search.location || search.status || search.archived !== "active");

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void navigate({
      to: "/",
      search: searchSchema.parse(Object.fromEntries(new FormData(event.currentTarget))),
    });
  }

  return (
    <>
      <div className={classes.pageHeading}>
        <Title order={2}>物品一覧</Title>
        <Button renderRoot={(props) => <Link {...props} to="/items/new" />}>物品を登録</Button>
      </div>
      <form key={JSON.stringify(search)} onSubmit={filter}>
        <Fieldset legend="検索条件" disabled={navigating} className={classes.fields}>
          <div className={classes.search}>
            <TextInput
              name="q"
              type="search"
              label="物品を検索"
              maxLength={200}
              defaultValue={search.q}
              placeholder="品名・管理番号・メモ・収納先・タグ"
            />
            <Button type="submit">検索</Button>
          </div>
          <details className={classes.details} open={hasFilters}>
            <summary>絞り込み{hasFilters && "（条件あり）"}</summary>
            <div className={classes.fields}>
              <div className={classes.filterGrid}>
                <NativeSelect name="tag" label="タグ" defaultValue={search.tag}>
                  <option value="">すべて</option>
                  {search.tag && !tags.includes(search.tag) && (
                    <option value={search.tag}>{search.tag}（現在未使用）</option>
                  )}
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect name="location" label="場所（配下の物品も含む）" defaultValue={search.location}>
                  <option value="">すべて</option>
                  <option value="unset">場所未設定</option>
                  {inventory.locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {locationPath(location, inventory)
                        .map((entry) => entry.name)
                        .join(" › ")}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect name="status" label="状態" defaultValue={search.status}>
                  <option value="">すべて</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect name="archived" label="表示対象" defaultValue={search.archived}>
                  <option value="active">管理中</option>
                  <option value="archived">アーカイブ済み</option>
                  <option value="all">すべて</option>
                </NativeSelect>
              </div>
              <div className={classes.actions}>
                <Button type="submit">この条件で検索</Button>
              </div>
            </div>
          </details>
          <Anchor renderRoot={(props) => <Link {...props} to="/" search={{}} />}>条件をクリア</Anchor>
        </Fieldset>
      </form>
      <Text role="status">
        {filtered.length} 件{navigating && "・読み込み中…"}
      </Text>
      {filtered.length ? (
        <ItemTable items={filtered} inventory={inventory} />
      ) : (
        <Text>
          {inventory.items.length
            ? "条件に一致する物品がありません。検索条件を変更するか、条件をクリアしてください。"
            : "物品はまだ登録されていません。「物品を登録」から追加してください。"}
        </Text>
      )}
    </>
  );
}
