import { Alert, Anchor, Button, Checkbox, Fieldset, Textarea, TextInput, Title } from "@mantine/core";
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
import classes from "src/styles/layout.module.css";
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
  onChanged: (message: string) => Promise<void>;
}) {
  const save = useMutation(saveUsesAction);
  const unpublish = useMutation(unpublishUsesAction);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [title, setTitle] = useState(entry?.title ?? "");
  const [source, setSource] = useState(entry?.descriptionMarkdown ?? "");
  const [images, setImages] = useState<UsesImage[]>(entry?.images ?? []);
  const [isPublished, setPublished] = useState(entry?.isPublished ?? false);
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
    const data = new FormData(event.currentTarget);
    await save.run(
      {
        itemId: item.id,
        version: entry?.version ?? null,
        title,
        descriptionMarkdown: source,
        images,
        isPublished,
        externalUrl: String(data.get("externalUrl") ?? ""),
        section: String(data.get("section") ?? ""),
        tags: String(data.get("tags") ?? ""),
        sortOrder: Number(data.get("sortOrder")),
      },
      () => onChanged("公開設定を保存しました。"),
    );
  }

  return (
    <section className={classes.fields}>
      {entry?.isPublished && (
        <div className={classes.actions}>
          <Anchor href={`/api/v1/uses/${entry.id}`}>公開 API を確認</Anchor>
          <Button
            type="button"
            variant="default"
            disabled={disabled}
            onClick={() =>
              unpublish.run({ id: entry.id, version: entry.version }, () => onChanged("非公開にしました。"))
            }
          >
            非公開にする
          </Button>
        </div>
      )}
      <form method="post" onSubmit={submit}>
        <Fieldset variant="unstyled" aria-label="uses の公開設定" disabled={disabled} className={classes.fields}>
          <TextInput
            name="title"
            label="公開タイトル"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required={isPublished}
          />
          <TextInput
            type="url"
            name="externalUrl"
            label="製品リンク"
            defaultValue={entry?.externalUrl ?? ""}
            maxLength={2000}
          />
          <TextInput
            name="section"
            label="セクション"
            defaultValue={entry?.section ?? ""}
            maxLength={100}
            placeholder="Desk setup"
          />
          <TextInput
            name="tags"
            label="公開用のタグ（カンマ区切り）"
            defaultValue={entry?.tags.join(", ") ?? ""}
            maxLength={1000}
          />
          <TextInput
            type="number"
            name="sortOrder"
            label="表示順（小さい順）"
            defaultValue={entry?.sortOrder ?? 0}
            min={-10000}
            max={10000}
            required
          />
          <Textarea
            ref={textarea}
            name="descriptionMarkdown"
            label="公開用の説明（Markdown）"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            rows={16}
            maxLength={MAX_MARKDOWN_LENGTH}
            description="HTML・外部画像は使用できません。"
          />
          <Title order={5} size="h4">
            公開する画像
          </Title>
          {assets
            .filter((asset) => asset.state === "ready")
            .map((asset) => (
              <div className={classes.actions} key={asset.id}>
                <Checkbox
                  label={asset.filename}
                  checked={images.some((image) => image.assetId === asset.id)}
                  onChange={(event) =>
                    event.target.checked
                      ? selectImage(asset.id, true)
                      : setImages((current) => current.filter((image) => image.assetId !== asset.id))
                  }
                />
                <Button type="button" variant="default" onClick={() => insertImage(asset.id)}>
                  本文に挿入
                </Button>
              </div>
            ))}
          {images.map((image, index) => (
            <Fieldset key={image.assetId} legend={`公開画像 ${index + 1}`} className={classes.fields}>
              <img
                className={classes.previewImage}
                src={privateImageUrl(image.assetId)}
                alt={image.alt}
                width={160}
                loading="lazy"
              />
              <TextInput
                label="代替テキスト"
                value={image.alt}
                maxLength={300}
                onChange={(event) => updateImage(image.assetId, { alt: event.target.value })}
              />
              <TextInput
                label="画像の説明"
                value={image.caption}
                maxLength={1000}
                onChange={(event) => updateImage(image.assetId, { caption: event.target.value })}
              />
              <Checkbox
                label="ギャラリーにも表示する"
                checked={image.inGallery}
                onChange={(event) => updateImage(image.assetId, { inGallery: event.target.checked })}
              />
              <div className={classes.actions}>
                <Button type="button" variant="default" disabled={index === 0} onClick={() => moveImage(index, -1)}>
                  前へ
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={index === images.length - 1}
                  onClick={() => moveImage(index, 1)}
                >
                  後へ
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={() =>
                    setImages((current) => current.filter((selected) => selected.assetId !== image.assetId))
                  }
                >
                  公開対象から外す
                </Button>
              </div>
            </Fieldset>
          ))}
          <p>画像の公開をやめるには、本文と画像の選択の両方から外して保存してください。</p>
          <details className={classes.details}>
            <summary>プレビュー</summary>
            <Title order={5} size="h4">
              {title}
            </Title>
            <Markdown source={source} assetUrls={assetUrls} />
            {images
              .filter((image) => image.inGallery)
              .map((image) => (
                <figure className={classes.image} key={image.assetId}>
                  <img src={privateImageUrl(image.assetId)} alt={image.alt} width={240} />
                  <figcaption>{image.caption}</figcaption>
                </figure>
              ))}
          </details>
          <Checkbox
            label="uses API で公開する"
            description="入力内容と、本文・ギャラリーの画像を公開します。"
            checked={isPublished}
            onChange={(event) => setPublished(event.target.checked)}
          />
          <div className={classes.actions}>
            <Button type="submit" loading={save.pending}>
              {save.pending ? "保存中…" : isPublished ? "保存して公開" : "非公開で保存"}
            </Button>
          </div>
        </Fieldset>
        {save.error && <Alert color="red">{save.error}</Alert>}
        {unpublish.error && <Alert color="red">{unpublish.error}</Alert>}
      </form>
    </section>
  );
}
