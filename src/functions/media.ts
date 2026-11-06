import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readItemMedia } from "src/server/media";
import { mutation } from "src/server/mutation";
import { saveUsesEntry, unpublishUse } from "src/server/uses";
import { itemMediaInputSchema, targetSchema, usesInputSchema } from "src/server/validation";
import { z } from "zod";
import { administratorOnly } from "./middleware";

export const getItemMedia = createServerFn({ method: "GET" })
  .middleware([administratorOnly])
  .validator(itemMediaInputSchema)
  .handler(({ data }) => readItemMedia(env.DB, data.itemId));

export const saveUsesAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator(z.unknown())
  .handler(({ data }) =>
    mutation(() => saveUsesEntry(env.DB, usesInputSchema.parse(data), new URL(getRequest().url).origin)),
  );

export const unpublishUsesAction = createServerFn({ method: "POST" })
  .middleware([administratorOnly])
  .validator(z.unknown())
  .handler(({ data }) => mutation(() => unpublishUse(env.DB, targetSchema.parse(data))));
