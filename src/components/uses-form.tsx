import { Alert, Anchor, Button, Checkbox, Fieldset, TagsInput, Text, Textarea, TextInput, Title } from "@mantine/core";
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
  const readyAssets = assets.filter((asset) => asset.state === "ready");

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
      {unpublish.error && (
        <Alert color="red" role="alert">
          {unpublish.error}
        </Alert>
      )}
      <form method="post" onSubmit={submit} className={classes.form}>
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
          <div className={classes.formRow}>
            <TextInput
              name="section"
              label="セクション"
              defaultValue={entry?.section ?? ""}
              maxLength={100}
              placeholder="Desk setup"
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
          </div>
          <TagsInput
            name="tags"
            label="公開用のタグ"
            placeholder="入力して Enter"
            defaultValue={entry?.tags ?? []}
            data={item.tags}
            splitChars={[",", "、", "\n"]}
            maxLength={40}
          />
          <Textarea
            ref={textarea}
            name="descriptionMarkdown"
            label="公開用の説明（Markdown）"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            autosize
            minRows={6}
            maxRows={14}
            maxLength={MAX_MARKDOWN_LENGTH}
            description="HTML・外部画像は使用できません。"
          />
          <Fieldset variant="unstyled" legend={`公開する画像（${images.length}）`} className={classes.fields}>
            {readyAssets.length ? (
              <div className={classes.imageChoices}>
                {readyAssets.map((asset) => (
                  <div className={classes.image} key={asset.id}>
                    <Checkbox.Card
                      type="button"
                      className={classes.imageChoice}
                      aria-label={`公開する画像：${asset.filename}`}
                      checked={images.some((image) => image.assetId === asset.id)}
                      disabled={disabled}
                      onChange={(checked) =>
                        checked
                          ? selectImage(asset.id, true)
                          : setImages((current) => current.filter((image) => image.assetId !== asset.id))
                      }
                    >
                      <img
                        src={privateImageUrl(asset.id)}
                        alt=""
                        width={asset.width}
                        height={asset.height}
                        loading="lazy"
                      />
                      <span className={classes.imageChoiceLabel}>
                        <Checkbox.Indicator />
                        <Text component="span" size="xs" truncate title={asset.filename}>
                          {asset.filename}
                        </Text>
                      </span>
                    </Checkbox.Card>
                    <Button
                      type="button"
                      variant="subtle"
                      size="compact-sm"
                      aria-label={`本文に挿入：${asset.filename}`}
                      onClick={() => insertImage(asset.id)}
                    >
                      本文に挿入
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                画像がありません。
              </Text>
            )}
            {images.length > 0 && (
              <div className={classes.fields}>
                {images.map((image, index) => (
                  <details key={image.assetId} className={classes.details}>
                    <summary>
                      <img
                        className={classes.previewImage}
                        src={privateImageUrl(image.assetId)}
                        alt=""
                        width={48}
                        loading="lazy"
                      />
                      <span>画像 {index + 1} の設定</span>
                    </summary>
                    <div className={classes.fields}>
                      <div className={classes.formRow}>
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
                      </div>
                      <Checkbox
                        label="ギャラリーにも表示する"
                        checked={image.inGallery}
                        onChange={(event) => updateImage(image.assetId, { inGallery: event.target.checked })}
                      />
                      <div className={classes.actions}>
                        <Button
                          type="button"
                          variant="default"
                          disabled={index === 0}
                          onClick={() => moveImage(index, -1)}
                        >
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
                    </div>
                  </details>
                ))}
              </div>
            )}
            {readyAssets.length > 0 && (
              <Text size="sm" c="dimmed">
                本文の画像を公開対象から外すときは、本文からも削除してください。
              </Text>
            )}
          </Fieldset>
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
          {save.error && (
            <Alert color="red" role="alert">
              {save.error}
            </Alert>
          )}
          <div className={classes.actions}>
            <Button type="submit" loading={save.pending}>
              {save.pending ? "保存中…" : isPublished ? "保存して公開" : "非公開で保存"}
            </Button>
          </div>
        </Fieldset>
      </form>
    </section>
  );
}
