import { createFileRoute, Link, type SearchSchemaInput, useNavigate, useRouterState } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { ItemTable } from "src/components/inventory";
import { getInventory } from "src/functions/inventory";
import { availableTags, filterItems, locationPath, statusLabels } from "src/lib/inventory";

export const Route = createFileRoute("/_app/")({
  validateSearch: (
    search: {
      q?: unknown;
      location?: unknown;
      status?: unknown;
      archived?: unknown;
      tag?: unknown;
    } & SearchSchemaInput,
  ) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 200) : "",
    tag: typeof search.tag === "string" ? search.tag.trim().normalize("NFC").slice(0, 40) : "",
    location: typeof search.location === "string" ? search.location : "",
    status: typeof search.status === "string" && Object.hasOwn(statusLabels, search.status) ? search.status : "",
    archived: search.archived === "archived" || search.archived === "all" ? search.archived : "active",
  }),
  loader: () => getInventory(),
  component: ItemList,
});

function ItemList() {
  const inventory = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const filtered = filterItems(inventory, search);
  const tags = availableTags(inventory);

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void navigate({
      to: "/",
      search: {
        q: String(data.get("q") ?? ""),
        tag: String(data.get("tag") ?? ""),
        location: String(data.get("location") ?? ""),
        status: String(data.get("status") ?? ""),
        archived: String(data.get("archived") ?? "active"),
      },
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
                    {locationPath(location, inventory.locations)
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
