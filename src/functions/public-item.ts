import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { readPublicItem } from "src/server/public-item";

export const getPublicItem = createServerFn({ method: "GET" })
  .validator((code: unknown) => (typeof code === "string" ? code : ""))
  .handler(({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    return readPublicItem(env.DB, data, env.PUBLIC_OWNER_NAME);
  });
