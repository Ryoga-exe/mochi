import { InventoryError, type MutationResult } from "src/lib/mutation";
import { ZodError } from "zod";
import { databaseError } from "./db/errors";

// Parse inputs inside the action so validation failures use the same result as business errors.
export async function mutation<T>(action: () => Promise<T>): Promise<MutationResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    const cause = databaseError(error);
    if (cause instanceof ZodError) return { ok: false, message: cause.issues[0]?.message ?? "入力が不正です。" };
    if (cause instanceof InventoryError) return { ok: false, message: cause.message };
    console.error("Mutation failed", cause);
    return { ok: false, message: "保存できませんでした。時間をおいてやり直してください。" };
  }
}
