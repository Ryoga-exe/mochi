import { createFileRoute, Link, useHydrated, useRouter, useRouterState } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { deleteLocationAction, getInventory, saveLocationAction } from "src/functions/inventory";
import { useMutation } from "src/hooks/use-mutation";
import { createInventoryIndex, type Location, locationPath } from "src/lib/inventory";

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
        name: data.get("name"),
        parentId: data.get("parentId") || null,
      },
      async () => {
        await router.invalidate({ sync: true });
        form.reset();
        setEditing(null);
        setMessage("保存しました。");
      },
    );
  }

  async function remove(location: Location) {
    if (!window.confirm(`「${location.name}」を削除しますか？`)) return;
    clearFeedback();
    await deletion.run({ id: location.id, version: location.version }, async () => {
      await router.invalidate({ sync: true });
      if (editing?.id === location.id) setEditing(null);
      setMessage("削除しました。");
    });
  }

  return (
    <>
      <h2>場所を管理</h2>
      <p>「自宅 › 作業部屋 › 棚」のように、場所を入れ子にできます。バッグやポーチは物品として登録してください。</p>
      <form key={editing?.id ?? "new"} method="post" onSubmit={submit}>
        <fieldset disabled={!hydrated || pending || navigating}>
          <legend>{editing ? "場所を編集" : "場所を追加"}</legend>
          <p>
            <label>
              場所名（必須）
              <br />
              <input name="name" required maxLength={100} defaultValue={editing?.name ?? ""} />
            </label>
          </p>
          <p>
            <label>
              親の場所
              <br />
              <select name="parentId" defaultValue={editing?.parentId ?? ""}>
                <option value="">なし</option>
                {parents.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationPath(location, inventory)
                      .map((part) => part.name)
                      .join(" › ")}
                  </option>
                ))}
              </select>
            </label>
          </p>
          <button type="submit">{pending ? "保存中…" : "保存"}</button>
          {editing && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  clearFeedback();
                }}
              >
                キャンセル
              </button>
            </>
          )}
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {!inventory.locations.length && <p>場所はまだ登録されていません。</p>}
      <ul>
        {inventory.locations.map((location) => {
          const occupied =
            inventory.locations.some((child) => child.parentId === location.id) ||
            inventory.items.some((item) => item.locationId === location.id);
          return (
            <li key={location.id}>
              <Link to="/" search={{ location: location.id }}>
                {locationPath(location, inventory)
                  .map((part) => part.name)
                  .join(" › ")}
              </Link>{" "}
              <button
                type="button"
                disabled={pending || navigating}
                onClick={() => {
                  setEditing(location);
                  clearFeedback();
                }}
              >
                編集
              </button>{" "}
              <button type="button" disabled={pending || navigating || occupied} onClick={() => remove(location)}>
                削除
              </button>
              {occupied && "（物品または子の場所があるため削除不可）"}
            </li>
          );
        })}
      </ul>
    </>
  );
}
