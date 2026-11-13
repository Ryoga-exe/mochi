import { Anchor, Button, Fieldset, Modal, Pill, SegmentedControl, Select, Text, TextInput, Title } from "@mantine/core";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
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

const defaultFilters = { tag: "", location: "", status: "", archived: "active" };
const archiveOptions = [
  { value: "active", label: "管理中" },
  { value: "archived", label: "アーカイブ" },
  { value: "all", label: "すべて" },
];

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
  const [filtersOpened, setFiltersOpened] = useState(false);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const tags = availableTags(inventory).map((tag) => ({ value: tag, label: tag }));
  if (search.tag && !tags.some((tag) => tag.value === search.tag)) {
    tags.unshift({ value: search.tag, label: `${search.tag}（現在未使用）` });
  }
  const locations = [
    { value: "unset", label: "場所未設定" },
    ...inventory.locations.map((location) => ({
      value: location.id,
      label: locationPath(location, inventory)
        .map((part) => part.name)
        .join(" › "),
    })),
  ];
  if (search.location && !locations.some((location) => location.value === search.location)) {
    locations.push({ value: search.location, label: "見つからない場所" });
  }
  const activeFilters = (
    [
      { key: "tag", label: `タグ：${search.tag}` },
      {
        key: "location",
        label: `場所：${locations.find((location) => location.value === search.location)?.label ?? ""}`,
      },
      {
        key: "status",
        label: `状態：${search.status && statusLabels[search.status]}`,
      },
      {
        key: "archived",
        label: `表示：${archiveOptions.find((option) => option.value === search.archived)?.label}`,
      },
    ] as const
  ).filter(({ key }) => search[key] !== defaultFilters[key]);

  function updateSearch(values: Record<string, unknown>) {
    return navigate({
      to: "/",
      search: searchSchema.parse({ ...search, ...values }),
    });
  }

  function searchItems(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void updateSearch(Object.fromEntries(new FormData(event.currentTarget)));
  }

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateSearch(draftFilters);
    setFiltersOpened(false);
  }

  return (
    <>
      <div className={classes.pageHeading}>
        <Title order={2}>物品一覧</Title>
        <Button renderRoot={(props) => <Link {...props} to="/items/new" />}>物品を登録</Button>
      </div>
      <search>
        <form key={JSON.stringify(search)} onSubmit={searchItems}>
          <Fieldset variant="unstyled" aria-label="検索条件" disabled={navigating} className={classes.fields}>
            <div className={classes.search}>
              <TextInput
                name="q"
                type="search"
                aria-label="物品を検索"
                maxLength={200}
                defaultValue={search.q}
                placeholder="品名・管理番号・タグなど"
              />
              <Button type="submit" variant="default">
                検索
              </Button>
            </div>
          </Fieldset>
        </form>
      </search>
      <div className={classes.filterToolbar}>
        <div className={classes.actions}>
          <Text size="sm" c="dimmed" role="status">
            {filtered.length} 件{navigating && "・読み込み中…"}
          </Text>
          {(search.q || activeFilters.length > 0) && (
            <Anchor size="sm" renderRoot={(props) => <Link {...props} to="/" search={{}} />}>
              条件をクリア
            </Anchor>
          )}
        </div>
        <Button
          type="button"
          variant={activeFilters.length ? "light" : "default"}
          disabled={navigating}
          onClick={() => {
            setDraftFilters({
              tag: search.tag,
              location: search.location,
              status: search.status,
              archived: search.archived,
            });
            setFiltersOpened(true);
          }}
        >
          絞り込み{activeFilters.length > 0 && `（${activeFilters.length}）`}
        </Button>
      </div>
      {activeFilters.length > 0 && (
        <Pill.Group role="group" aria-label="適用中の絞り込み条件">
          {activeFilters.map((condition) => (
            <Pill
              key={condition.key}
              size="lg"
              title={condition.label}
              withRemoveButton
              disabled={navigating}
              removeButtonProps={{ "aria-label": `${condition.label}の条件を解除` }}
              onRemove={() => void updateSearch({ [condition.key]: defaultFilters[condition.key] })}
            >
              {condition.label}
            </Pill>
          ))}
        </Pill.Group>
      )}
      <Modal
        opened={filtersOpened}
        onClose={() => setFiltersOpened(false)}
        title="絞り込み"
        size="sm"
        centered
        closeButtonProps={{ "aria-label": "閉じる" }}
      >
        <form onSubmit={applyFilters}>
          <Fieldset variant="unstyled" disabled={navigating} className={classes.fields}>
            <Select
              label="タグ"
              placeholder="すべて"
              data={tags}
              searchable
              clearable
              nothingFoundMessage="一致するタグがありません"
              clearButtonProps={{ "aria-label": "タグの条件を解除" }}
              value={draftFilters.tag || null}
              onChange={(tag) => setDraftFilters((current) => ({ ...current, tag: tag ?? "" }))}
            />
            <Select
              label="場所（配下の物品も含む）"
              placeholder="すべて"
              data={locations}
              searchable
              clearable
              nothingFoundMessage="一致する場所がありません"
              clearButtonProps={{ "aria-label": "場所の条件を解除" }}
              value={draftFilters.location || null}
              onChange={(location) => setDraftFilters((current) => ({ ...current, location: location ?? "" }))}
            />
            <Select
              label="状態"
              data={[
                { value: "", label: "すべて" },
                ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
              ]}
              allowDeselect={false}
              value={draftFilters.status}
              onChange={(status) => setDraftFilters((current) => ({ ...current, status: status ?? "" }))}
            />
            <Fieldset variant="unstyled" legend="表示対象">
              <SegmentedControl
                fullWidth
                data={archiveOptions}
                value={draftFilters.archived}
                onChange={(archived) => setDraftFilters((current) => ({ ...current, archived }))}
              />
            </Fieldset>
            <div className={classes.filterToolbar}>
              <Button type="button" variant="subtle" size="compact-sm" onClick={() => setDraftFilters(defaultFilters)}>
                クリア
              </Button>
              <div className={classes.actions}>
                <Button type="button" variant="default" onClick={() => setFiltersOpened(false)}>
                  キャンセル
                </Button>
                <Button type="submit" loading={navigating}>
                  適用
                </Button>
              </div>
            </div>
          </Fieldset>
        </form>
      </Modal>
      {filtered.length ? (
        <ItemTable items={filtered} inventory={inventory} />
      ) : (
        <Text>{inventory.items.length ? "条件に一致する物品がありません。" : "物品はまだ登録されていません。"}</Text>
      )}
    </>
  );
}
