import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { uploadImageResponse } from "src/server/media-http";

export const Route = createFileRoute("/api/items/$itemId/images")({
  server: { handlers: { POST: ({ request, params }) => uploadImageResponse(env, request, params.itemId) } },
});
