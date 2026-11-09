import { Alert, Anchor, Badge, Button, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { createFileRoute, Link, notFound, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ItemTable, ItemTags, StoragePath } from "src/components/inventory";
import { ItemForm } from "src/components/item-form";
import { ItemImages } from "src/components/item-images";
import { UsesForm } from "src/components/uses-form";
import { archiveItemAction, getInventory } from "src/functions/inventory";
import { getItemMedia } from "src/functions/media";
import { useMutation } from "src/hooks/use-mutation";
import { createInventoryIndex, itemCode, ownershipLabels, statusLabels, storagePath } from "src/lib/inventory";
import classes from "src/styles/layout.module.css";

export const Route = createFileRoute("/_app/items/$code")({
  remountDeps: ({ params }) => params.code,
  loader: async ({ params }) => {
    const inventory = await getInventory();
    const item = inventory.items.find((entry) => itemCode(entry) === params.code);
    if (!item) throw notFound();
    const media = await getItemMedia({ data: { itemId: item.id } });
    return { inventory, item, media };
  },
  component: ItemDetail,
  notFoundComponent: () => (
    <>
      <Title order={2}>物品が見つかりません。</Title>
      <Anchor renderRoot={(props) => <Link {...props} to="/" />}>物品一覧に戻る</Anchor>
    </>
  ),
});

function ItemDetail() {
  const { inventory: data, item, media } = Route.useLoaderData();
  const inventory = useMemo(() => createInventoryIndex(data), [data]);
  const router = useRouter();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const { run, pending, error, clearError } = useMutation(archiveItemAction);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const directChildren = inventory.items.filter((child) => child.containerItemId === item.id);
  const descendants = inventory.items.filter((child) =>
    storagePath(child, inventory).some((part) => part.kind === "item" && part.id === item.id),
  );

  function archive() {
    const archived = item.archivedAt === null;
    modals.openConfirmModal({
      title: archived ? "物品をアーカイブ" : "物品を管理中に戻す",
      children: archived
        ? "この物品をアーカイブしますか？ 管理番号と記録は残ります。"
        : "この物品を管理中に戻しますか？",
      labels: { confirm: archived ? "アーカイブ" : "管理中に戻す", cancel: "キャンセル" },
      onConfirm: async () => {
        setMessage("");
        await run({ id: item.id, version: item.version, archived }, async () => {
          await router.invalidate({ sync: true });
          setEditing(false);
          setMessage(archived ? "アーカイブしました。" : "管理中に戻しました。");
        });
      },
    });
  }

  return (
    <>
      <Anchor renderRoot={(props) => <Link {...props} to="/" />}>物品一覧に戻る</Anchor>
      <div className={classes.pageHeading}>
        <Title order={2} ref={heading} tabIndex={-1}>
          {item.name}
        </Title>
        {!editing && item.archivedAt === null && (
          <Button
            type="button"
            disabled={pending || navigating}
            onClick={() => {
              clearError();
              setMessage("");
              setEditing(true);
            }}
          >
            物品を編集
          </Button>
        )}
      </div>
      {item.archivedAt !== null && <Badge color="gray">アーカイブ済み</Badge>}
      <Text>QR ページ：{item.isPublic && item.archivedAt === null ? "基本情報を公開中" : "非公開"}</Text>
      <p>
        <Anchor href={`/i/${itemCode(item)}`}>QR コード用のリンク</Anchor>
        {" | "}
        <Anchor
          renderRoot={(props) => (
            <Link {...props} to="/i/$code" params={{ code: itemCode(item) }} search={{ preview: true }} />
          )}
        >
          未ログイン時の表示を確認
        </Anchor>
      </p>
      {!editing && (
        <dl className={classes.metadata}>
          <dt>管理番号</dt>
          <dd>{itemCode(item)}</dd>
          <dt>収納できる</dt>
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
          <dd className={classes.description}>{item.description || "未入力"}</dd>
        </dl>
      )}
      {message && <Alert role="status">{message}</Alert>}
      {error && <Alert color="red">{error}</Alert>}
      {editing && item.archivedAt === null && (
        <ItemForm
          key={`item:${item.id}:${item.version}`}
          item={item}
          inventory={inventory}
          onCancel={() => {
            setEditing(false);
            heading.current?.focus();
          }}
          onSaved={async () => {
            clearError();
            await router.invalidate({ sync: true });
            setEditing(false);
            setMessage("保存しました。");
            heading.current?.focus();
          }}
        />
      )}
      <ItemImages item={item} assets={media.assets} onChanged={() => router.invalidate({ sync: true })} />
      <details className={classes.details}>
        <summary>uses の公開設定（{media.entry?.isPublished ? "公開中" : "非公開"}）</summary>
        <UsesForm
          key={`uses:${item.id}:${media.entry?.version ?? "new"}`}
          item={item}
          assets={media.assets}
          entry={media.entry}
          onChanged={async (message) => {
            clearError();
            await router.invalidate({ sync: true });
            setMessage(message);
          }}
        />
      </details>
      <p>
        <Button
          type="button"
          onClick={archive}
          disabled={pending || navigating || editing || (item.archivedAt === null && directChildren.length > 0)}
        >
          {pending ? "更新中…" : item.archivedAt === null ? "アーカイブ" : "管理中に戻す"}
        </Button>
      </p>
      {item.archivedAt === null && directChildren.length > 0 && (
        <p>アーカイブするには、先に中身を別の収納先へ移してください。</p>
      )}
      {item.isContainer && (
        <>
          <Title order={3}>直接入っている物品（{directChildren.length} 件）</Title>
          {directChildren.length ? (
            <ItemTable items={directChildren} inventory={inventory} />
          ) : (
            <p>中身はありません。</p>
          )}
          {descendants.length > directChildren.length && (
            <details className={classes.details}>
              <summary>入れ子の中身を含むすべての物品（{descendants.length} 件）</summary>
              <ItemTable items={descendants} inventory={inventory} />
            </details>
          )}
        </>
      )}
    </>
  );
}
