import type { AuthEnv } from "./auth";
import { databaseError } from "./db/errors";
import { getAdministrator } from "./session";
import { InventoryError } from "./validation";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const publicHeaders = {
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "X-Content-Type-Options": "nosniff",
};
export const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export function errorResponse(error: unknown, headers: HeadersInit) {
  error = databaseError(error);
  if (error instanceof Response) return error;
  const status = error instanceof HttpError ? error.status : error instanceof InventoryError ? 400 : 500;
  if (status === 500) console.error("HTTP operation failed", error);
  const message =
    error instanceof HttpError || error instanceof InventoryError
      ? error.message
      : "処理に失敗しました。もう一度お試しください。";
  return Response.json({ ok: false, message }, { status, headers });
}

export async function adminResponse(env: AuthEnv, request: Request, action: () => Promise<Response>) {
  try {
    if (!(await getAdministrator(env, request.headers))) throw new HttpError(401, "ログインしてください。");
    if (!["GET", "HEAD"].includes(request.method)) {
      const origin = request.headers.get("Origin");
      if (origin ? origin !== new URL(request.url).origin : request.headers.get("Sec-Fetch-Site") !== "same-origin") {
        throw new HttpError(403, "同じサイトから操作してください。");
      }
    }
    return await action();
  } catch (error) {
    return errorResponse(error, privateHeaders);
  }
}

export async function limitedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("Content-Length")) > maxBytes)
    throw new HttpError(413, "アップロードが大きすぎます。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "画像を選んでください。");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "アップロードが大きすぎます。");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
