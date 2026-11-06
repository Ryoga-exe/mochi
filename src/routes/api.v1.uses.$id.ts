import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { publicHeaders } from "src/server/http";
import { publicUsesResponse } from "src/server/media-http";

export const Route = createFileRoute("/api/v1/uses/$id")({
  server: {
    handlers: {
      GET: ({ request, params }) => publicUsesResponse(env, request, params.id),
      OPTIONS: () => new Response(null, { status: 204, headers: publicHeaders }),
    },
  },
});
