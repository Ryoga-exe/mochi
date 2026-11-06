import { useHydrated, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import { saveUsesAction, unpublishUsesAction } from "src/functions/media";
import { useMutation } from "src/hooks/use-mutation";
import type { Item } from "src/lib/inventory";
import {
  assetReference,
  type ItemAsset,
  MAX_MARKDOWN_LENGTH,
  privateImageUrl,
  type UsesEntry,
  type UsesImage,
} from "src/lib/media";
import { Markdown } from "./markdown";

export function UsesForm({
  item,
  assets,
  entry,
  onChanged,
}: {
  item: Item;
  assets: ItemAsset[];
  entry: UsesEntry | null;
  onChanged: () => Promise<void>;
}) {
  const save = useMutation(saveUsesAction);
  const unpublish = useMutation(unpublishUsesAction);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [title, setTitle] = useState(entry?.title ?? "");
  const [source, setSource] = useState(entry?.descriptionMarkdown ?? "");
  const [images, setImages] = useState<UsesImage[]>(entry?.images ?? []);
  const [isPublished, setPublished] = useState(entry?.isPublished ?? false);
  const [message, setMessage] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const disabled = !hydrated || navigating || save.pending || unpublish.pending || item.archivedAt !== null;
  const assetUrls = Object.fromEntries(images.map((image) => [image.assetId, privateImageUrl(image.assetId)]));

  function selectImage(assetId: string, inGallery: boolean) {
    setImages((current) =>
      current.some((image) => image.assetId === assetId)
        ? current
        : [...current, { assetId, alt: "", caption: "", inGallery }],
    );
  }
  function updateImage(assetId: string, values: Partial<UsesImage>) {
    setImages((current) => current.map((image) => (image.assetId === assetId ? { ...image, ...values } : image)));
  }
  function moveImage(index: number, offset: number) {
    setImages((current) => {
      const next = [...current];
      const target = index + offset;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function insertImage(assetId: string) {
    const start = textarea.current?.selectionStart ?? source.length;
    const end = textarea.current?.selectionEnd ?? start;
    const insertion = `\n\n![画像の説明](${assetReference(assetId)})\n\n`;
    if (source.length - (end - start) + insertion.length > MAX_MARKDOWN_LENGTH) return;
    selectImage(assetId, false);
    setSource(source.slice(0, start) + insertion + source.slice(end));
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const data = new FormData(event.currentTarget);
    await save.run(
      {
        itemId: item.id,
        version: entry?.version ?? null,
        title,
        descriptionMarkdown: source,
        images,
        isPublished,
        externalUrl: data.get("externalUrl"),
        section: data.get("section"),
        tags: data.get("tags"),
        sortOrder: Number(data.get("sortOrder")),
      },
      async () => {
        await onChanged();
        setMessage("公開設定を保存しました。");
      },
    );
  }

  return (
    <section>
      <h3>uses の公開設定</h3>
      <p>
        {entry?.isPublished ? "公開中" : "非公開"}
        。管理メモ・保管場所・管理用のタグは公開されません。公開用に入力した内容と選択した画像を API で公開します。
      </p>
      {entry?.isPublished && (
        <p>
          <a href={`/api/v1/uses/${entry.id}`}>公開 API を確認</a>{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => unpublish.run({ id: entry.id, version: entry.version }, onChanged)}
          >
            今すぐ非公開にする
          </button>
        </p>
      )}
      <form method="post" onSubmit={submit}>
        <fieldset disabled={disabled}>
          <legend>公開する内容</legend>
          <p>
            <label>
              公開タイトル
              <br />
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required={isPublished}
              />
            </label>
          </p>
          <p>
            <label>
              製品リンク
              <br />
              <input type="url" name="externalUrl" defaultValue={entry?.externalUrl ?? ""} maxLength={2000} />
            </label>
          </p>
          <p>
            <label>
              セクション
              <br />
              <input name="section" defaultValue={entry?.section ?? ""} maxLength={100} placeholder="Desk setup" />
            </label>
          </p>
          <p>
            <label>
              公開用のタグ（カンマ区切り）
              <br />
              <input name="tags" defaultValue={entry?.tags.join(", ") ?? ""} maxLength={1000} />
            </label>
          </p>
          <p>
            <label>
              表示順（小さい順）
              <br />
              <input
                type="number"
                name="sortOrder"
                defaultValue={entry?.sortOrder ?? 0}
                min={-10000}
                max={10000}
                required
              />
            </label>
          </p>
          <p>
            <label>
              公開用の説明（Markdown）
              <br />
              <textarea
                ref={textarea}
                name="descriptionMarkdown"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                rows={16}
                cols={70}
                maxLength={MAX_MARKDOWN_LENGTH}
              />
            </label>
          </p>
          <p>
            2万文字まで。見出し・箇条書き・表・コード・リンクに対応します。画像は下の「本文に挿入」から追加できます。HTML
            と外部画像の埋め込みには対応していません。
          </p>
          <h4>公開する画像</h4>
          {assets
            .filter((asset) => asset.state === "ready")
            .map((asset) => (
              <p key={asset.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={images.some((image) => image.assetId === asset.id)}
                    onChange={(event) =>
                      event.target.checked
                        ? selectImage(asset.id, true)
                        : setImages((current) => current.filter((image) => image.assetId !== asset.id))
                    }
                  />{" "}
                  {asset.filename}
                </label>{" "}
                <button type="button" onClick={() => insertImage(asset.id)}>
                  本文に挿入
                </button>
              </p>
            ))}
          {images.map((image, index) => (
            <fieldset key={image.assetId}>
              <legend>公開画像 {index + 1}</legend>
              <img src={privateImageUrl(image.assetId)} alt={image.alt} width={160} loading="lazy" />
              <p>
                <label>
                  代替テキスト{" "}
                  <input
                    value={image.alt}
                    maxLength={300}
                    onChange={(event) => updateImage(image.assetId, { alt: event.target.value })}
                  />
                </label>
              </p>
              <p>
                <label>
                  画像の説明{" "}
                  <input
                    value={image.caption}
                    maxLength={1000}
                    onChange={(event) => updateImage(image.assetId, { caption: event.target.value })}
                  />
                </label>
              </p>
              <p>
                <label>
                  <input
                    type="checkbox"
                    checked={image.inGallery}
                    onChange={(event) => updateImage(image.assetId, { inGallery: event.target.checked })}
                  />
                  ギャラリーにも表示する
                </label>
              </p>
              <button type="button" disabled={index === 0} onClick={() => moveImage(index, -1)}>
                前へ
              </button>{" "}
              <button type="button" disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}>
                後へ
              </button>{" "}
              <button
                type="button"
                onClick={() => setImages((current) => current.filter((selected) => selected.assetId !== image.assetId))}
              >
                公開対象から外す
              </button>
            </fieldset>
          ))}
          <p>本文に挿入した画像を非公開にするには、本文中の画像記法と画像の選択を両方外して保存してください。</p>
          <details>
            <summary>プレビュー</summary>
            <h4>{title}</h4>
            <Markdown source={source} assetUrls={assetUrls} />
            {images
              .filter((image) => image.inGallery)
              .map((image) => (
                <figure key={image.assetId}>
                  <img src={privateImageUrl(image.assetId)} alt={image.alt} width={240} />
                  <figcaption>{image.caption}</figcaption>
                </figure>
              ))}
          </details>
          <p>
            <label>
              <input type="checkbox" checked={isPublished} onChange={(event) => setPublished(event.target.checked)} />
              保存した内容を uses API で公開する
            </label>
          </p>
          <button type="submit">
            {save.pending ? "保存中…" : isPublished ? "公開内容を保存して公開" : "下書きを保存（非公開）"}
          </button>
        </fieldset>
        {save.error && <p role="alert">{save.error}</p>}
        {unpublish.error && <p role="alert">{unpublish.error}</p>}
        {message && <p role="status">{message}</p>}
      </form>
    </section>
  );
}
