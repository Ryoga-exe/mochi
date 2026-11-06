import { useHydrated, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useMutation } from "src/hooks/use-mutation";
import type { Item } from "src/lib/inventory";
import { type ItemAsset, MAX_IMAGES_PER_ITEM, privateImageUrl } from "src/lib/media";
import { deleteImage, uploadImages } from "src/lib/media-client";

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
    <section>
      <h3>
        画像（{assets.length} / {MAX_IMAGES_PER_ITEM} 枚）
      </h3>
      <p>画像は追加した時点では非公開です。長辺2000px以下に縮小し、位置情報などのメタデータを除いて保存します。</p>
      <form method="post" onSubmit={submit}>
        <fieldset disabled={disabled || item.archivedAt !== null || assets.length >= MAX_IMAGES_PER_ITEM}>
          <legend>画像を追加</legend>
          <p>
            <label>
              ファイルを選択{" "}
              <input type="file" name="files" accept="image/jpeg,image/png,image/webp" multiple required />
            </label>
          </p>
          <button type="submit">{upload.pending ? "追加中…" : "アップロード"}</button>
        </fieldset>
      </form>
      <form method="post" onSubmit={submit}>
        <fieldset disabled={disabled || item.archivedAt !== null || assets.length >= MAX_IMAGES_PER_ITEM}>
          <legend>カメラから追加</legend>
          <p>
            <label>
              写真を撮影 <input type="file" name="files" accept="image/*" capture="environment" required />
            </label>
          </p>
          <button type="submit">撮影した写真を追加</button>
        </fieldset>
      </form>
      <p>元画像は1枚20MBまで。カメラの起動はブラウザー・端末の対応状況によります。</p>
      {message && <p role="status">{message}</p>}
      {[...new Set([upload.error, deletion.error, ...failures].filter(Boolean))].map((error) => (
        <p role="alert" key={error}>
          {error}
        </p>
      ))}
      {assets.map((asset) => (
        <figure key={asset.id}>
          {asset.state === "ready" ? (
            <img src={privateImageUrl(asset.id)} alt={asset.filename} width={200} loading="lazy" />
          ) : (
            <p>処理が完了していません。削除して再度追加できます。</p>
          )}
          <figcaption>
            {asset.filename}（{asset.width} × {asset.height}）
          </figcaption>
          <button
            type="button"
            disabled={disabled}
            onClick={async () => {
              if (window.confirm("この画像を削除しますか？")) await deletion.run({ assetId: asset.id }, onChanged);
            }}
          >
            削除
          </button>
        </figure>
      ))}
    </section>
  );
}
