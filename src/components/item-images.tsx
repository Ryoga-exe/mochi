import { Alert, Anchor, Button, FileButton, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useHydrated, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
  const resetFiles = useRef<() => void>(null);
  const resetCamera = useRef<() => void>(null);
  const disabled = !hydrated || navigating || upload.pending || deletion.pending;
  const uploadDisabled = disabled || item.archivedAt !== null || assets.length >= MAX_IMAGES_PER_ITEM;

  async function addImages(files: File[]) {
    if (!files.length) return;
    setMessage("");
    setFailures([]);
    await upload.run({ itemId: item.id, files }, async (result) => {
      setMessage(`${result.uploaded} 枚追加しました。`);
      setFailures(result.errors);
      await onChanged();
    });
  }

  return (
    <section className={classes.fields}>
      <div className={classes.pageHeading}>
        <Title order={3}>画像（{assets.length}）</Title>
        <div className={classes.actions}>
          <FileButton
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={uploadDisabled}
            resetRef={resetFiles}
            onChange={(files) => {
              resetFiles.current?.();
              void addImages(files);
            }}
          >
            {(props) => (
              <Button {...props} variant="default" disabled={uploadDisabled} loading={upload.pending}>
                画像を追加
              </Button>
            )}
          </FileButton>
          <FileButton
            accept="image/*"
            capture="environment"
            disabled={uploadDisabled}
            resetRef={resetCamera}
            onChange={(file) => {
              resetCamera.current?.();
              if (file) void addImages([file]);
            }}
          >
            {(props) => (
              <Button {...props} variant="subtle" disabled={uploadDisabled}>
                撮影
              </Button>
            )}
          </FileButton>
        </div>
      </div>
      {assets.length >= MAX_IMAGES_PER_ITEM && (
        <Text size="sm" c="dimmed">
          画像は{MAX_IMAGES_PER_ITEM}枚まで追加できます。
        </Text>
      )}
      {message && <Alert role="status">{message}</Alert>}
      {[...new Set([upload.error, deletion.error, ...failures].filter(Boolean))].map((error) => (
        <Alert color="red" key={error}>
          {error}
        </Alert>
      ))}
      {assets.length > 0 && (
        <section className={classes.imageGrid} aria-label="物品の画像">
          {assets.map((asset) => (
            <figure className={classes.image} key={asset.id}>
              {asset.state === "ready" ? (
                <Anchor
                  href={privateImageUrl(asset.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`画像を開く：${asset.filename}`}
                >
                  <img
                    src={privateImageUrl(asset.id)}
                    alt={asset.filename}
                    width={asset.width ?? 200}
                    height={asset.height ?? 200}
                    loading="lazy"
                  />
                </Anchor>
              ) : (
                <p>処理が完了していません。削除して再度追加できます。</p>
              )}
              <Button
                type="button"
                variant="subtle"
                color="gray"
                size="compact-sm"
                aria-label={`画像を削除：${asset.filename}`}
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
        </section>
      )}
    </section>
  );
}
