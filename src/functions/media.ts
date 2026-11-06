import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readItemMedia } from "src/server/media";
import { mutation } from "src/server/mutation";
import { parseUsesInput, saveUsesEntry, unpublishUse } from "src/server/uses";
import { InventoryError, id, object, parseTarget } from "src/server/validation";
import { administratorOnly } from "./middleware";

export const getItemMedia = createServerFn({ method: "GET" })
  .middleware([administratorOnly])
  .validator((data: unknown) => {
    const itemId = id(object(data).itemId);
    if (!itemId) throw new InventoryError("物品 ID が不正です。");
    return itemId;
  })
  .handler(({ data }) => readItemMedia(env.DB, data));

export const saveUsesAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => saveUsesEntry(env.DB, parseUsesInput(data), new URL(getRequest().url).origin)));

export const unpublishUsesAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator((data: unknown) => data)
  .handler(({ data }) => mutation(() => unpublishUse(env.DB, parseTarget(data))));
