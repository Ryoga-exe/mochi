import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { archiveItem, deleteLocation, readInventory, saveItem, saveLocation } from "src/server/inventory";
import { validatedMutation, validateInput } from "src/server/mutation";
import { getAdministrator } from "src/server/session";
import { archiveInputSchema, itemInputSchema, locationInputSchema, targetSchema } from "src/server/validation";
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
  .validator(validateInput(itemInputSchema))
  .handler(({ data }) => validatedMutation(data, (input) => saveItem(env.DB, input)));

export const archiveItemAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator(validateInput(archiveInputSchema))
  .handler(({ data }) => validatedMutation(data, (input) => archiveItem(env.DB, input)));

export const saveLocationAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator(validateInput(locationInputSchema))
  .handler(({ data }) => validatedMutation(data, (input) => saveLocation(env.DB, input)));

export const deleteLocationAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator(validateInput(targetSchema))
  .handler(({ data }) => validatedMutation(data, (input) => deleteLocation(env.DB, input)));
