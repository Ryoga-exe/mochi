import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { publicHeaders } from "src/server/http";
import { publicImageResponse } from "src/server/media-http";

export const Route = createFileRoute("/api/v1/uses/$id/images/$assetId")({
  server: {
    handlers: {
      GET: ({ params }) => publicImageResponse(env, params.id, params.assetId),
      OPTIONS: () => new Response(null, { status: 204, headers: publicHeaders }),
    },
  },
});
