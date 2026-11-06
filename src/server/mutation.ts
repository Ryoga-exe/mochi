import type { MutationResult } from "src/lib/mutation";
import { databaseError } from "./db/errors";
import { InventoryError } from "./validation";

export async function mutation<T>(action: () => Promise<T>): Promise<MutationResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    const cause = databaseError(error);
    if (cause instanceof InventoryError) return { ok: false, message: cause.message };
    console.error("Mutation failed", cause);
    return { ok: false, message: "保存できませんでした。時間をおいてやり直してください。" };
  }
}
