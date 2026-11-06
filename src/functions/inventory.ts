import { env } from "cloudflare:workers";
import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import type { MutationResult } from "src/lib/mutation";
import { archiveItem, deleteLocation, readInventory, saveItem, saveLocation } from "src/server/inventory";
import { getAdministrator } from "src/server/session";
import {
  InventoryError,
  parseArchiveInput,
  parseItemInput,
  parseLocationInput,
  parseTarget,
} from "src/server/validation";

export const getViewer = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  return getAdministrator(env, getRequestHeaders());
});

const administratorOnly = createMiddleware({ type: "function" }).server(async ({ next }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  const administrator = await getAdministrator(env, getRequestHeaders());
  if (!administrator) throw redirect({ to: "/login" });
  return next();
});

export const getInventory = createServerFn({ method: "GET" })
  .middleware([administratorOnly])
  .handler(() => readInventory(env.DB));

async function mutation<T>(action: () => Promise<T>): Promise<MutationResult<T>> {
  try {
    return { ok: true as const, value: await action() };
  } catch (error) {
    if (error instanceof InventoryError) return { ok: false as const, message: error.message };
    console.error("Inventory mutation failed", error);
    return { ok: false as const, message: "保存できませんでした。時間をおいてやり直してください。" };
  }
}

export const saveItemAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => saveItem(env.DB, parseItemInput(data))));

export const archiveItemAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => archiveItem(env.DB, parseArchiveInput(data))));

export const saveLocationAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => saveLocation(env.DB, parseLocationInput(data))));

export const deleteLocationAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => deleteLocation(env.DB, parseTarget(data))));
