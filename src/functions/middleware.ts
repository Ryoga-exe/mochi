import { env } from "cloudflare:workers";
import { redirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { getAdministrator } from "src/server/session";

export const administratorOnly = createMiddleware({ type: "function" }).server(async ({ next }) => {
  setResponseHeader("Cache-Control", "private, no-store");
  if (!(await getAdministrator(env, getRequestHeaders()))) throw redirect({ to: "/login" });
  return next();
});
