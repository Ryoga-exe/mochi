import { itemCode } from "./inventory";
import type { ItemStatus } from "./item-attributes";

export const MAX_PUBLIC_DESCRIPTION_LENGTH = 300;

export type PublicItem = {
  ownerName: string;
  name: string;
  status: ItemStatus;
  description: string;
};

export function parseItemCode(code: unknown) {
  if (typeof code !== "string") return null;
  const match = /^M-(?:(\d{4})-)?(\d{6,})$/.exec(code);
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const registrationYear = match[1] ? Number(match[1]) : null;
  if (registrationYear !== null && registrationYear < 1) return null;
  // Only accept the exact, stable code printed on the label.
  const identity = { number, registrationYear };
  return itemCode(identity) === code ? identity : null;
}
