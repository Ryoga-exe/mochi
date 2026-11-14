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
  const [message, setMessage] = useState("");

  function clearFeedback() {
    save.clearError();
    deletion.clearError();
    setMessage("");
  }

  function finishEditing() {
    const id = editing?.id;
    setEditing(null);
    if (id) requestAnimationFrame(() => document.getElementById(`location-${id}`)?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>, location?: Location) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    clearFeedback();
    await save.run(
      {
        id: location?.id ?? null,
        version: location?.version ?? null,
        name: String(data.get("name") ?? ""),
        parentId: String(data.get("parentId") ?? "") || null,
      },
      async () => {
        await router.invalidate({ sync: true });
        if (location) finishEditing();
        else form.reset();
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
          setMessage("削除しました。");
        });
      },
    });
  }

  function renderForm(location?: Location) {
    const active = !editing || editing.id === location?.id;
    const parents = inventory.locations.filter(
      (candidate) => !locationPath(candidate, inventory).some((part) => part.id === location?.id),
    );
    return (
      <form method="post" onSubmit={(event) => submit(event, location)} className={classes.form}>
        <Fieldset
          variant="unstyled"
          legend={location ? undefined : "場所を追加"}
          aria-label={location ? `${location.name}を編集` : "場所を追加"}
          disabled={!hydrated || pending || navigating || !active}
          className={classes.fields}
        >
          <div className={classes.formRow}>
            <TextInput
              autoFocus={Boolean(location)}
              name="name"
              label="場所名"
              required
              maxLength={100}
              defaultValue={location?.name ?? ""}
            />
            <NativeSelect name="parentId" label="親の場所" defaultValue={location?.parentId ?? ""}>
              <option value="">なし</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {locationPath(parent, inventory)
                    .map((part) => part.name)
                    .join(" › ")}
                </option>
              ))}
            </NativeSelect>
          </div>
          {active && save.error && (
            <Alert color="red" role="alert">
              {save.error}
            </Alert>
          )}
          <div className={classes.actions}>
            <Button type="submit" loading={active && save.pending}>
              {location ? "変更を保存" : "追加"}
            </Button>
            {location && (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  finishEditing();
                  clearFeedback();
                }}
              >
                キャンセル
              </Button>
            )}
          </div>
        </Fieldset>
      </form>
    );
  }

  return (
    <>
      <Title order={2}>場所を管理</Title>
      {renderForm()}
      {message && <Alert role="status">{message}</Alert>}
      {deletion.error && (
        <Alert color="red" role="alert">
          {deletion.error}
        </Alert>
      )}
      {!inventory.locations.length && <Text>場所はまだ登録されていません。</Text>}
      <ul className={classes.locations}>
        {inventory.locations.map((location) => {
          const occupied =
            inventory.locations.some((child) => child.parentId === location.id) ||
            inventory.items.some((item) => item.locationId === location.id);
          return (
            <li key={location.id} className={classes.fields}>
              <div className={classes.filterToolbar}>
                <Anchor
                  id={`location-${location.id}`}
                  renderRoot={(props) => <Link {...props} to="/" search={{ location: location.id }} />}
                >
                  {locationPath(location, inventory)
                    .map((part) => part.name)
                    .join(" › ")}
                </Anchor>
                {editing?.id !== location.id && (
                  <div className={classes.actions}>
                    <Button
                      type="button"
                      variant="default"
                      disabled={!hydrated || pending || navigating || editing !== null}
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
                      disabled={!hydrated || pending || navigating || editing !== null || occupied}
                      onClick={() => remove(location)}
                    >
                      削除
                    </Button>
                  </div>
                )}
              </div>
              {editing?.id === location.id
                ? renderForm(editing)
                : occupied && (
                    <Text size="sm" c="dimmed">
                      物品または子の場所があるため削除できません。
                    </Text>
                  )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
