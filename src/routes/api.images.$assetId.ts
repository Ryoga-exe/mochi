import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { privateImageResponse } from "src/server/media-http";

export const Route = createFileRoute("/api/images/$assetId")({
  server: {
    handlers: {
      GET: ({ request, params }) => privateImageResponse(env, request, params.assetId),
      DELETE: ({ request, params }) => privateImageResponse(env, request, params.assetId),
    },
  },
});
