import { Accordion, Alert, Anchor, Badge, Button, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { createFileRoute, Link, notFound, useRouter, useRouterState } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ItemTable, ItemTags, StoragePath } from "src/components/inventory";
import { ItemForm } from "src/components/item-form";
import { ItemImages } from "src/components/item-images";
import { ItemPublicForm } from "src/components/item-public-form";
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
  const [editing, setEditing] = useState<"item" | "qr" | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const publicationHeading = useRef<HTMLHeadingElement>(null);
  const code = itemCode(item);
  const directChildren = inventory.items.filter((child) => child.containerItemId === item.id);
  const descendants = item.isContainer
    ? inventory.items.filter((child) =>
        storagePath(child, inventory).some((part) => part.kind === "item" && part.id === item.id),
      )
    : [];

  function finishEditing() {
    setEditing(null);
    (editing === "qr" ? publicationHeading : heading).current?.focus();
  }

  async function saved() {
    clearError();
    await router.invalidate({ sync: true });
    setMessage("保存しました。");
    finishEditing();
  }

  function archive() {
    const archived = item.archivedAt === null;
    modals.openConfirmModal({
      title: archived ? "物品をアーカイブ" : "物品を管理中に戻す",
      children: archived
        ? "この物品をアーカイブしますか？ 公開を停止し、管理中の一覧から外します。管理番号と記録は残ります。"
        : "この物品を管理中に戻しますか？",
      labels: { confirm: archived ? "アーカイブ" : "管理中に戻す", cancel: "キャンセル" },
      onConfirm: async () => {
        setMessage("");
        await run({ id: item.id, version: item.version, archived }, async () => {
          await router.invalidate({ sync: true });
          setEditing(null);
          setMessage(archived ? "アーカイブしました。" : "管理中に戻しました。");
        });
      },
    });
  }

  return (
    <>
      <Anchor renderRoot={(props) => <Link {...props} to="/" />}>物品一覧に戻る</Anchor>
      <div className={classes.pageHeading}>
        <div>
          <Title order={2} ref={heading} tabIndex={-1}>
            {item.name}
          </Title>
          <div className={classes.itemMeta}>
            <small className={classes.code}>{code}</small>
            {item.isContainer && <Badge variant="light">収納可</Badge>}
            {item.archivedAt !== null && <Badge color="gray">アーカイブ済み</Badge>}
          </div>
        </div>
        {editing !== "item" && item.archivedAt === null && (
          <Button
            type="button"
            disabled={pending || navigating || editing !== null}
            onClick={() => {
              clearError();
              setMessage("");
              setEditing("item");
            }}
          >
            物品を編集
          </Button>
        )}
      </div>
      {message && <Alert role="status">{message}</Alert>}
      {error && <Alert color="red">{error}</Alert>}
      <div className={classes.itemOverview}>
        <section className={classes.fields} aria-labelledby="item-information">
          <Title order={3} id="item-information">
            基本情報
          </Title>
          {editing === "item" ? (
            <ItemForm
              key={`item:${item.id}:${item.version}`}
              item={item}
              inventory={inventory}
              onCancel={finishEditing}
              onSaved={saved}
            />
          ) : (
            <dl className={classes.metadata}>
              <dt>収納先</dt>
              <dd>
                <StoragePath item={item} inventory={inventory} />
              </dd>
              <dt>状態</dt>
              <dd>{statusLabels[item.status]}</dd>
              <dt>所有関係</dt>
              <dd>{ownershipLabels[item.ownership]}</dd>
              {item.tags.length > 0 && (
                <>
                  <dt>タグ</dt>
                  <dd>
                    <ItemTags item={item} />
                  </dd>
                </>
              )}
              {item.description && (
                <>
                  <dt>説明・メモ</dt>
                  <dd className={classes.description}>{item.description}</dd>
                </>
              )}
            </dl>
          )}
        </section>
        <ItemImages item={item} assets={media.assets} onChanged={() => router.invalidate({ sync: true })} />
      </div>
      {item.isContainer && (
        <section className={classes.fields} aria-labelledby="item-contents">
          <Title order={3} id="item-contents">
            直接入っている物品（{directChildren.length} 件）
          </Title>
          {directChildren.length ? (
            <ItemTable items={directChildren} inventory={inventory} />
          ) : (
            <p>中身はありません。</p>
          )}
          {descendants.length > directChildren.length && (
            <details className={classes.details}>
              <summary>入れ子も含めて見る（{descendants.length} 件）</summary>
              <ItemTable items={descendants} inventory={inventory} />
            </details>
          )}
        </section>
      )}
      <section className={classes.fields} aria-labelledby="item-publication">
        <Title order={3} id="item-publication" ref={publicationHeading} tabIndex={-1}>
          公開設定
        </Title>
        <Accordion multiple order={4}>
          <Accordion.Item value="qr">
            <Accordion.Control disabled={editing === "qr"}>
              <span className={classes.publicationLabel}>
                QR ページ
                <Badge
                  component="span"
                  color={item.isPublic && item.archivedAt === null ? "blue" : "gray"}
                  variant="light"
                >
                  {item.isPublic && item.archivedAt === null ? "公開中" : "非公開"}
                </Badge>
              </span>
            </Accordion.Control>
            <Accordion.Panel>
              <div className={classes.fields}>
                <div className={classes.actions}>
                  <Anchor href={`/i/${code}`}>QR コード用のリンク</Anchor>
                  <Anchor
                    renderRoot={(props) => (
                      <Link {...props} to="/i/$code" params={{ code }} search={{ preview: true }} />
                    )}
                  >
                    未ログイン時の表示を確認
                  </Anchor>
                </div>
                {editing === "qr" ? (
                  <ItemPublicForm
                    key={`public:${item.id}:${item.version}`}
                    item={item}
                    onSaved={saved}
                    onCancel={finishEditing}
                  />
                ) : (
                  <>
                    {item.publicDescription && (
                      <dl className={classes.metadata}>
                        <dt>短い説明</dt>
                        <dd className={classes.description}>{item.publicDescription}</dd>
                      </dl>
                    )}
                    {item.archivedAt === null && (
                      <div className={classes.actions}>
                        <Button
                          type="button"
                          variant="default"
                          disabled={pending || navigating || editing !== null}
                          onClick={() => {
                            clearError();
                            setMessage("");
                            setEditing("qr");
                          }}
                        >
                          QR の公開設定を編集
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Accordion.Panel>
          </Accordion.Item>
          <Accordion.Item value="uses">
            <Accordion.Control>
              <span className={classes.publicationLabel}>
                uses API
                <Badge component="span" color={media.entry?.isPublished ? "blue" : "gray"} variant="light">
                  {media.entry?.isPublished ? "公開中" : "非公開"}
                </Badge>
              </span>
            </Accordion.Control>
            <Accordion.Panel>
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
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </section>
      <div className={classes.actions}>
        <Button
          type="button"
          variant="subtle"
          color="gray"
          onClick={archive}
          disabled={
            pending || navigating || editing !== null || (item.archivedAt === null && directChildren.length > 0)
          }
        >
          {pending ? "更新中…" : item.archivedAt === null ? "アーカイブ" : "管理中に戻す"}
        </Button>
        {item.archivedAt === null && directChildren.length > 0 && (
          <span>中身を別の収納先へ移すとアーカイブできます。</span>
        )}
      </div>
    </>
  );
}
