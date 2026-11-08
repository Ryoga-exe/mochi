import { InventoryError, type MutationResult } from "src/lib/mutation";
import type { z } from "zod";
import { databaseError } from "./db/errors";

export function validateInput<T extends z.ZodType>(schema: T) {
  return (data: z.input<T>): MutationResult<z.output<T>> => {
    const parsed = schema.safeParse(data);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, message: parsed.error.issues[0]?.message ?? "入力が不正です。" };
  };
}

export async function validatedMutation<TInput, TValue>(
  input: MutationResult<TInput>,
  action: (data: TInput) => Promise<TValue>,
): Promise<MutationResult<TValue>> {
  return input.ok ? mutation(() => action(input.value)) : input;
}

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
