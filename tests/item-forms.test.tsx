// @vitest-environment happy-dom

import { MantineProvider } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ItemForm } from "src/components/item-form";
import { ItemPublicForm } from "src/components/item-public-form";
import { saveItemAction } from "src/functions/inventory";
import { createInventoryIndex, type Item, type Location } from "src/lib/inventory";
import { itemInputSchema } from "src/server/validation";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("src/functions/inventory", () => ({ saveItemAction: vi.fn() }));

// Happy DOM lacks the font events used by Mantine's autosizing textarea.
Object.defineProperty(document, "fonts", { value: new EventTarget() });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const item: Item = {
  id: "11111111-1111-4111-8111-111111111111",
  number: 1,
  registrationYear: 2026,
  name: "カメラ",
  description: "管理用のメモ",
  isContainer: false,
  isPublic: true,
  publicDescription: "拾得時に見せる説明",
  tags: ["写真"],
  status: "lent",
  ownership: "borrowed",
  locationId: null,
  containerItemId: null,
  archivedAt: null,
  version: 3,
  createdAt: 0,
  updatedAt: 0,
};

const room: Location = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "作業部屋",
  parentId: null,
  version: 1,
  createdAt: 0,
  updatedAt: 0,
};
const pouch: Item = {
  ...item,
  id: "22222222-2222-4222-8222-222222222222",
  number: 2,
  name: "ガジェットポーチ",
  isContainer: true,
  locationId: room.id,
  tags: ["旅行"],
};

function setup() {
  const root = createRootRoute();
  const home = createRoute({ getParentRoute: () => root, path: "/" });
  const router = createRouter({
    routeTree: root.addChildren([home]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  vi.mocked(saveItemAction).mockResolvedValue({ ok: true, value: item });
  const onSaved = vi.fn(async () => {});
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MantineProvider env="test" forceColorScheme="light">
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    </MantineProvider>
  );
  return { onSaved, wrapper };
}

test("editing inventory information preserves QR publication and its description", async () => {
  const { onSaved, wrapper } = setup();
  render(
    <ItemForm item={item} inventory={createInventoryIndex({ items: [item], locations: [] })} onSaved={onSaved} />,
    {
      wrapper,
    },
  );
  fireEvent.change(screen.getByLabelText("品名", { exact: false }), { target: { value: "新しい品名" } });
  fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const input = vi.mocked(saveItemAction).mock.calls[0][0].data;
  expect(itemInputSchema.parse(input)).toEqual({ ...itemInputSchema.parse(item), name: "新しい品名" });
});

test("submits a searched location or container and allows clearing the destination", async () => {
  const { onSaved, wrapper } = setup();
  render(
    <ItemForm
      item={item}
      inventory={createInventoryIndex({ items: [item, pouch], locations: [room] })}
      onSaved={onSaved}
    />,
    { wrapper },
  );
  const storage = screen.getByRole("combobox", { name: "収納先" });
  let saves = 0;
  for (const [query, option, locationId, containerItemId] of [
    ["作業", /^作業部屋$/, room.id, null],
    ["ポーチ", /ガジェットポーチ/, null, pouch.id],
  ] as const) {
    act(() => storage.focus());
    fireEvent.change(storage, { target: { value: query } });
    fireEvent.click(await screen.findByRole("option", { name: option }));
    fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));
    saves += 1;
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(saves));
    expect(itemInputSchema.parse(vi.mocked(saveItemAction).mock.lastCall?.[0].data)).toMatchObject({
      locationId,
      containerItemId,
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "収納先を解除" }));
  fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(3));
  expect(itemInputSchema.parse(vi.mocked(saveItemAction).mock.lastCall?.[0].data)).toMatchObject({
    locationId: null,
    containerItemId: null,
  });
});

test("submits existing, suggested and unfinished tag input together", async () => {
  const { onSaved, wrapper } = setup();
  render(
    <ItemForm
      item={item}
      inventory={createInventoryIndex({ items: [item, pouch], locations: [room] })}
      onSaved={onSaved}
    />,
    { wrapper },
  );
  const tags = screen.getByRole("combobox", { name: "タグ" });
  act(() => tags.focus());
  fireEvent.change(tags, { target: { value: "旅" } });
  fireEvent.click(await screen.findByRole("option", { name: "旅行" }));
  fireEvent.change(tags, { target: { value: "予備" } });
  fireEvent.blur(tags);
  fireEvent.click(screen.getByRole("button", { name: "変更を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(itemInputSchema.parse(vi.mocked(saveItemAction).mock.lastCall?.[0].data).tags).toEqual([
    "写真",
    "旅行",
    "予備",
  ]);
});

test("editing QR publication preserves inventory information and its version", async () => {
  const { onSaved, wrapper } = setup();
  render(<ItemPublicForm item={item} onSaved={onSaved} onCancel={() => {}} />, { wrapper });
  fireEvent.click(screen.getByRole("checkbox", { name: "QR ページを公開する" }));
  fireEvent.change(screen.getByLabelText("短い説明"), { target: { value: "公開用の新しい説明" } });
  fireEvent.click(screen.getByRole("button", { name: "公開設定を保存" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const input = vi.mocked(saveItemAction).mock.calls[0][0].data;
  expect(itemInputSchema.parse(input)).toEqual({
    ...itemInputSchema.parse(item),
    isPublic: false,
    publicDescription: "公開用の新しい説明",
  });
});
