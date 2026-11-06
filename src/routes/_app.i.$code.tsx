import { createFileRoute, Link, notFound, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ItemTable, ItemTags, StoragePath } from "src/components/inventory";
import { ItemForm } from "src/components/item-form";
import { archiveItemAction, getInventory } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import { createInventoryIndex, itemCode, ownershipLabels, statusLabels, storagePath } from "src/lib/inventory";

export const Route = createFileRoute("/_app/i/$code")({
  loader: async ({ params }) => {
    const inventory = await getInventory();
    const item = inventory.items.find((entry) => itemCode(entry) === params.code);
    if (!item) throw notFound();
    return { inventory, item };
  },
  component: ItemDetail,
  notFoundComponent: () => (
    <>
      <h2>物品が見つかりません。</h2>
      <Link to="/">物品一覧に戻る</Link>
    </>
  ),
});

function ItemDetail() {
  const { inventory: data, item } = Route.useLoaderData();
  const inventory = useMemo(() => createInventoryIndex(data), [data]);
  const router = useRouter();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const { run, pending, error, clearError } = useMutation(archiveItemAction);
  const [message, setMessage] = useState("");
  const directChildren = inventory.items.filter((child) => child.containerItemId === item.id);
  const descendants = inventory.items.filter((child) =>
    storagePath(child, inventory).some((part) => part.kind === "item" && part.id === item.id),
  );

  async function archive() {
    const archived = item.archivedAt === null;
    if (
      !window.confirm(
        archived ? "この物品をアーカイブしますか？ 管理番号と記録は残ります。" : "この物品を管理中に戻しますか？",
      )
    )
      return;
    setMessage("");
    await run({ id: item.id, version: item.version, archived }, async () => {
      await router.invalidate({ sync: true });
      setMessage(archived ? "アーカイブしました。" : "管理中に戻しました。");
    });
  }

  return (
    <>
      <h2>{item.name}</h2>
      {item.archivedAt !== null && <p>アーカイブ済み</p>}
      <dl>
        <dt>管理番号</dt>
        <dd>{itemCode(item)}</dd>
        <dt>収納先として使う</dt>
        <dd>{item.isContainer ? "はい" : "いいえ"}</dd>
        <dt>タグ</dt>
        <dd>
          <ItemTags item={item} />
        </dd>
        <dt>収納先</dt>
        <dd>
          <StoragePath item={item} inventory={inventory} />
        </dd>
        <dt>状態</dt>
        <dd>{statusLabels[item.status]}</dd>
        <dt>所有関係</dt>
        <dd>{ownershipLabels[item.ownership]}</dd>
        <dt>説明・メモ</dt>
        <dd>
          <pre>{item.description || "未入力"}</pre>
        </dd>
      </dl>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {item.archivedAt === null && (
        <ItemForm
          key={`${item.id}:${item.version}`}
          item={item}
          inventory={inventory}
          onSaved={async () => {
            clearError();
            await router.invalidate({ sync: true });
            setMessage("保存しました。");
          }}
        />
      )}
      <p>
        <button
          type="button"
          onClick={archive}
          disabled={pending || navigating || (item.archivedAt === null && directChildren.length > 0)}
        >
          {pending ? "更新中…" : item.archivedAt === null ? "アーカイブ" : "管理中に戻す"}
        </button>
      </p>
      {item.archivedAt === null && directChildren.length > 0 && (
        <p>アーカイブするには、先に中身を別の収納先へ移してください。</p>
      )}
      {item.isContainer && (
        <>
          <h3>直接入っている物品（{directChildren.length} 件）</h3>
          {directChildren.length ? (
            <ItemTable items={directChildren} inventory={inventory} />
          ) : (
            <p>中身はありません。</p>
          )}
          {descendants.length > directChildren.length && (
            <details>
              <summary>入れ子の中身を含むすべての物品（{descendants.length} 件）</summary>
              <ItemTable items={descendants} inventory={inventory} />
            </details>
          )}
        </>
      )}
    </>
  );
}
