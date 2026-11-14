// @vitest-environment happy-dom

import { MantineProvider } from "@mantine/core";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { ItemForm } from "src/components/item-form";
import { ItemPublicForm } from "src/components/item-public-form";
import { UsesForm } from "src/components/uses-form";
import { saveItemAction } from "src/functions/inventory";
import { saveUsesAction } from "src/functions/media";
import { createInventoryIndex, type Item, type Location } from "src/lib/inventory";
import { assetReference, type ItemAsset, type UsesEntry } from "src/lib/media";
import { itemInputSchema, usesInputSchema } from "src/server/validation";
import { afterEach, expect, test, vi } from "vitest";

vi.mock("src/functions/inventory", () => ({ saveItemAction: vi.fn() }));
vi.mock("src/functions/media", () => ({ saveUsesAction: vi.fn(), unpublishUsesAction: vi.fn() }));

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

const photo: ItemAsset = {
  id: "55555555-5555-4555-8555-555555555555",
  itemId: item.id,
  objectKey: "private/photo.png",
  filename: "正面.png",
  contentType: "image/png",
  bytes: 100,
  width: 4,
  height: 3,
  state: "ready",
  createdAt: 0,
};
const sidePhoto: ItemAsset = { ...photo, id: "66666666-6666-4666-8666-666666666666", filename: "横から.png" };
const usesEntry: UsesEntry = {
  id: "44444444-4444-4444-8444-444444444444",
  itemId: item.id,
  title: "使っているカメラ",
  descriptionMarkdown: "前の文\n\n後の文",
  externalUrl: "https://example.com/camera",
  section: "Camera",
  tags: ["撮影"],
  images: [],
  sortOrder: 2,
  isPublished: false,
  publicContent: null,
  version: 4,
  createdAt: 0,
  updatedAt: 0,
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

test("uses saves selected ready images in order while preserving their settings and publication fields", async () => {
  const { wrapper, onSaved: onChanged } = setup();
  const originalImage = { assetId: photo.id, alt: "カメラの正面", caption: "元の説明", inGallery: false };
  const entry = { ...usesEntry, images: [originalImage] };
  vi.mocked(saveUsesAction).mockResolvedValue({ ok: true, value: entry });
  render(
    <UsesForm
      item={item}
      entry={entry}
      assets={[
        photo,
        sidePhoto,
        { ...photo, id: "77777777-7777-4777-8777-777777777777", filename: "処理中.png", state: "uploading" },
      ]}
      onChanged={onChanged}
    />,
    { wrapper },
  );
  expect(screen.getByRole("checkbox", { name: "公開する画像：正面.png" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("checkbox", { name: "公開する画像：処理中.png" })).toBeNull();
  fireEvent.click(screen.getByRole("checkbox", { name: "公開する画像：横から.png" }));
  const settings = screen.getByText("画像 1 の設定").closest("details") as HTMLDetailsElement;
  fireEvent.click(settings.querySelector("summary") as HTMLElement);
  expect(settings.open).toBe(true);
  fireEvent.change(within(settings).getByRole("textbox", { name: "画像の説明" }), {
    target: { value: "更新した説明" },
  });
  fireEvent.click(within(settings).getByRole("button", { name: "後へ" }));
  expect(saveUsesAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "非公開で保存" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(usesInputSchema.parse(vi.mocked(saveUsesAction).mock.lastCall?.[0].data)).toEqual(
    usesInputSchema.parse({
      ...entry,
      images: [
        { assetId: sidePhoto.id, alt: "", caption: "", inGallery: true },
        { ...originalImage, caption: "更新した説明" },
      ],
    }),
  );
});

test("inserting an image adds it at the cursor as a body-only image and keeps the draft private", async () => {
  const { wrapper, onSaved: onChanged } = setup();
  vi.mocked(saveUsesAction).mockResolvedValue({ ok: true, value: usesEntry });
  render(<UsesForm item={item} entry={usesEntry} assets={[photo, sidePhoto]} onChanged={onChanged} />, { wrapper });
  const textarea = screen.getByRole("textbox", { name: "公開用の説明（Markdown）" }) as HTMLTextAreaElement;
  textarea.setSelectionRange(3, 3);
  fireEvent.click(screen.getByRole("button", { name: "本文に挿入：正面.png" }));
  expect(screen.getByRole("checkbox", { name: "公開する画像：正面.png" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: "公開する画像：横から.png" }).getAttribute("aria-checked")).toBe("false");
  expect(saveUsesAction).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "非公開で保存" }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  expect(usesInputSchema.parse(vi.mocked(saveUsesAction).mock.lastCall?.[0].data)).toEqual(
    usesInputSchema.parse({
      ...usesEntry,
      descriptionMarkdown: `前の文\n\n![画像の説明](${assetReference(photo.id)})\n\n\n\n後の文`,
      images: [{ assetId: photo.id, alt: "", caption: "", inGallery: false }],
    }),
  );
});
