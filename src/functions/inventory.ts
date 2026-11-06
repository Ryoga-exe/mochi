import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { archiveItem, deleteLocation, readInventory, saveItem, saveLocation } from "src/server/inventory";
import { mutation } from "src/server/mutation";
import { getAdministrator } from "src/server/session";
import { parseArchiveInput, parseItemInput, parseLocationInput, parseTarget } from "src/server/validation";
import { administratorOnly } from "./middleware";

export const getViewer = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  return getAdministrator(env, getRequestHeaders());
});

export const getInventory = createServerFn({ method: "GET" })
  .middleware([administratorOnly])
  .handler(() => readInventory(env.DB));

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
