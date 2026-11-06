export class InventoryError extends Error {}

export type MutationResult<T> = { ok: true; value: T } | { ok: false; message: string };
