import { Alert, Anchor, Button, Fieldset, NativeSelect, Text, TextInput, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { createFileRoute, Link, useHydrated, useRouter, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { deleteLocationAction, getInventory, saveLocationAction } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import { createInventoryIndex, type Location, locationPath } from "src/lib/inventory";
import classes from "src/styles/layout.module.css";

export const Route = createFileRoute("/_app/locations")({
  loader: () => getInventory(),
  component: Locations,
});

function Locations() {
  const data = Route.useLoaderData();
  const inventory = useMemo(() => createInventoryIndex(data), [data]);
  const router = useRouter();
  const hydrated = useHydrated();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
  const [editing, setEditing] = useState<Location | null>(null);
  const save = useMutation(saveLocationAction);
  const deletion = useMutation(deleteLocationAction);
  const pending = save.pending || deletion.pending;
  const error = save.error || deletion.error;
  const [message, setMessage] = useState("");
  const parents = inventory.locations.filter(
    (location) => !locationPath(location, inventory).some((part) => part.id === editing?.id),
  );

  function clearFeedback() {
    save.clearError();
    deletion.clearError();
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    clearFeedback();
    await save.run(
      {
        id: editing?.id ?? null,
        version: editing?.version ?? null,
        name: String(data.get("name") ?? ""),
        parentId: String(data.get("parentId") ?? "") || null,
      },
      async () => {
        await router.invalidate({ sync: true });
        form.reset();
        setEditing(null);
        setMessage("保存しました。");
      },
    );
  }

  function remove(location: Location) {
    modals.openConfirmModal({
      title: "場所を削除",
      children: `「${location.name}」を削除しますか？`,
      labels: { confirm: "削除", cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        clearFeedback();
        await deletion.run({ id: location.id, version: location.version }, async () => {
          await router.invalidate({ sync: true });
          if (editing?.id === location.id) setEditing(null);
          setMessage("削除しました。");
        });
      },
    });
  }

  return (
    <>
      <Title order={2}>場所を管理</Title>
      <form key={editing?.id ?? "new"} method="post" onSubmit={submit}>
        <Fieldset
          legend={editing ? "場所を編集" : "場所を追加"}
          disabled={!hydrated || pending || navigating}
          className={classes.fields}
        >
          <TextInput name="name" label="場所名" required maxLength={100} defaultValue={editing?.name ?? ""} />
          <NativeSelect name="parentId" label="親の場所" defaultValue={editing?.parentId ?? ""}>
            <option value="">なし</option>
            {parents.map((location) => (
              <option key={location.id} value={location.id}>
                {locationPath(location, inventory)
                  .map((part) => part.name)
                  .join(" › ")}
              </option>
            ))}
          </NativeSelect>
          <div className={classes.actions}>
            <Button type="submit" loading={save.pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  setEditing(null);
                  clearFeedback();
                }}
              >
                キャンセル
              </Button>
            )}
          </div>
        </Fieldset>
      </form>
      {message && <Alert role="status">{message}</Alert>}
      {error && <Alert color="red">{error}</Alert>}
      {!inventory.locations.length && <Text>場所はまだ登録されていません。</Text>}
      <ul className={classes.locations}>
        {inventory.locations.map((location) => {
          const occupied =
            inventory.locations.some((child) => child.parentId === location.id) ||
            inventory.items.some((item) => item.locationId === location.id);
          return (
            <li key={location.id} className={classes.fields}>
              <div className={classes.actions}>
                <Anchor renderRoot={(props) => <Link {...props} to="/" search={{ location: location.id }} />}>
                  {locationPath(location, inventory)
                    .map((part) => part.name)
                    .join(" › ")}
                </Anchor>
                <Button
                  type="button"
                  variant="default"
                  disabled={pending || navigating}
                  onClick={() => {
                    setEditing(location);
                    clearFeedback();
                  }}
                >
                  編集
                </Button>
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  disabled={pending || navigating || occupied}
                  onClick={() => remove(location)}
                >
                  削除
                </Button>
              </div>
              {occupied && <Text>物品または子の場所があるため削除できません。</Text>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
