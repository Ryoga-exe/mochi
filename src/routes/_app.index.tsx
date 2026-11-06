import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useMemo } from "react";
import { ItemTable } from "src/components/inventory";
import { getInventory } from "src/functions/inventory";
import { availableTags, createInventoryIndex, filterItems, locationPath, statusLabels } from "src/lib/inventory";
import { itemStatuses } from "src/lib/item-attributes";
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

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void navigate({
      to: "/",
      search: searchSchema.parse(Object.fromEntries(new FormData(event.currentTarget))),
    });
  }

  return (
    <>
      <h2>物品一覧</h2>
      <form key={JSON.stringify(search)} onSubmit={filter}>
        <fieldset disabled={navigating}>
          <legend>検索条件</legend>
          <p>
            <label>
              検索（品名・管理番号・メモ・収納先・タグ）
              <br />
              <input name="q" type="search" maxLength={200} defaultValue={search.q} />
            </label>
          </p>
          <p>
            <label>
              タグ
              <br />
              <select name="tag" defaultValue={search.tag}>
                <option value="">すべて</option>
                {search.tag && !tags.includes(search.tag) && (
                  <option value={search.tag}>{search.tag}（現在未使用）</option>
                )}
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              場所（配下の物品も含む）
              <br />
              <select name="location" defaultValue={search.location}>
                <option value="">すべて</option>
                <option value="unset">場所未設定</option>
                {inventory.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationPath(location, inventory)
                      .map((entry) => entry.name)
                      .join(" › ")}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              状態
              <br />
              <select name="status" defaultValue={search.status}>
                <option value="">すべて</option>
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
              表示対象
              <br />
              <select name="archived" defaultValue={search.archived}>
                <option value="active">管理中</option>
                <option value="archived">アーカイブ済み</option>
                <option value="all">すべて</option>
              </select>
            </label>
          </p>
          <button type="submit">検索</button>{" "}
          <Link to="/" search={{}}>
            条件をクリア
          </Link>
        </fieldset>
      </form>
      <p>{filtered.length} 件</p>
      {filtered.length ? (
        <ItemTable items={filtered} inventory={inventory} />
      ) : (
        <p>物品がありません。登録するか検索条件を変更してください。</p>
      )}
    </>
  );
}
