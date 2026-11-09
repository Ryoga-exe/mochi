import { Alert, Button, Fieldset, TextInput, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useHydrated, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useMutation } from "src/hooks/use-mutation";
import type { Item } from "src/lib/inventory";
import { type ItemAsset, MAX_IMAGES_PER_ITEM, privateImageUrl } from "src/lib/media";
import { deleteImage, uploadImages } from "src/lib/media-client";
import classes from "src/styles/layout.module.css";

export function ItemImages({
  item,
  assets,
  onChanged,
}: {
  item: Item;
  assets: ItemAsset[];
  onChanged: () => Promise<void>;
}) {
  const upload = useMutation(uploadImages);
  const deletion = useMutation(deleteImage);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [message, setMessage] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const disabled = !hydrated || navigating || upload.pending || deletion.pending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const files = new FormData(form)
      .getAll("files")
      .filter((file): file is File => typeof file !== "string" && file.size > 0);
    setMessage("");
    setFailures([]);
    await upload.run({ itemId: item.id, files }, async (result) => {
      setMessage(`${result.uploaded} 枚追加しました。`);
      setFailures(result.errors);
      form.reset();
      await onChanged();
    });
  }

  return (
    <section className={classes.fields}>
      <Title order={3}>
        画像（{assets.length} / {MAX_IMAGES_PER_ITEM} 枚）
      </Title>
      <details className={classes.details} open={assets.length === 0}>
        <summary>画像を追加・撮影する</summary>
        <div className={classes.fields}>
          <p>
            追加した画像は uses API
            の公開対象には自動で追加されません。長辺2000px以下に縮小し、位置情報などのメタデータを除いて保存します。
          </p>
          <form method="post" onSubmit={submit}>
            <Fieldset
              legend="画像を追加"
              disabled={disabled || item.archivedAt !== null || assets.length >= MAX_IMAGES_PER_ITEM}
              className={classes.fields}
            >
              <TextInput
                type="file"
                name="files"
                label="ファイルを選択"
                accept="image/jpeg,image/png,image/webp"
                multiple
                required
              />
              <div className={classes.actions}>
                <Button type="submit" loading={upload.pending}>
                  {upload.pending ? "追加中…" : "アップロード"}
                </Button>
              </div>
            </Fieldset>
          </form>
          <form method="post" onSubmit={submit}>
            <Fieldset
              legend="カメラから追加"
              disabled={disabled || item.archivedAt !== null || assets.length >= MAX_IMAGES_PER_ITEM}
              className={classes.fields}
            >
              <TextInput type="file" name="files" label="写真を撮影" accept="image/*" capture="environment" required />
              <div className={classes.actions}>
                <Button type="submit">撮影した写真を追加</Button>
              </div>
            </Fieldset>
          </form>
          <p>元画像は1枚20MBまで。カメラの起動はブラウザー・端末の対応状況によります。</p>
        </div>
      </details>
      {message && <Alert role="status">{message}</Alert>}
      {[...new Set([upload.error, deletion.error, ...failures].filter(Boolean))].map((error) => (
        <Alert color="red" key={error}>
          {error}
        </Alert>
      ))}
      <div className={classes.imageGrid}>
        {assets.map((asset) => (
          <figure className={classes.image} key={asset.id}>
            {asset.state === "ready" ? (
              <img src={privateImageUrl(asset.id)} alt={asset.filename} width={200} loading="lazy" />
            ) : (
              <p>処理が完了していません。削除して再度追加できます。</p>
            )}
            <figcaption>
              {asset.filename}（{asset.width} × {asset.height}）
            </figcaption>
            <Button
              type="button"
              variant="light"
              color="red"
              disabled={disabled}
              onClick={() =>
                modals.openConfirmModal({
                  title: "画像を削除",
                  children: `「${asset.filename}」を削除しますか？`,
                  labels: { confirm: "削除", cancel: "キャンセル" },
                  confirmProps: { color: "red" },
                  onConfirm: () => deletion.run({ assetId: asset.id }, onChanged),
                })
              }
            >
              削除
            </Button>
          </figure>
        ))}
      </div>
    </section>
  );
}
