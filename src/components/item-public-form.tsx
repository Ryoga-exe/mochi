import { Alert, Button, Checkbox, Fieldset, Textarea } from "@mantine/core";
import { useHydrated, useRouterState } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { saveItemAction } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import type { Item } from "src/lib/inventory";
import { MAX_PUBLIC_DESCRIPTION_LENGTH } from "src/lib/public-item";
import classes from "src/styles/layout.module.css";

export function ItemPublicForm({
  item,
  onSaved,
  onCancel,
}: {
  item: Item;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { run, pending, error } = useMutation(saveItemAction);
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(
      { ...item, isPublic: data.has("isPublic"), publicDescription: String(data.get("publicDescription") ?? "") },
      onSaved,
    );
  }

  return (
    <form method="post" onSubmit={submit}>
      <Fieldset
        variant="unstyled"
        aria-label="QR ページの公開設定"
        disabled={!hydrated || pending || navigating}
        className={classes.fields}
      >
        <Checkbox
          autoFocus
          name="isPublic"
          label="QR ページを公開する"
          description="公開内容：持ち主の表示名・品名・状態・短い説明"
          defaultChecked={item.isPublic}
        />
        <Textarea
          name="publicDescription"
          label="短い説明"
          description={`${MAX_PUBLIC_DESCRIPTION_LENGTH}文字まで`}
          rows={3}
          maxLength={MAX_PUBLIC_DESCRIPTION_LENGTH}
          defaultValue={item.publicDescription}
        />
        {error && <Alert color="red">{error}</Alert>}
        <div className={classes.actions}>
          <Button type="submit" loading={pending}>
            {pending ? "保存中…" : "公開設定を保存"}
          </Button>
          <Button type="button" variant="default" onClick={onCancel}>
            キャンセル
          </Button>
        </div>
      </Fieldset>
    </form>
  );
}
