import { and, eq, isNull } from "drizzle-orm";
import { type PublicItem, parseItemCode } from "src/lib/public-item";
import { getDb } from "./db";
import { items } from "./db/schema";

export async function readPublicItem(
  database: D1Database,
  code: string,
  ownerName: string,
): Promise<PublicItem | null> {
  const identity = parseItemCode(code);
  if (!identity) return null;
  // Select only the fields permitted on QR pages, including in server-function responses and SSR data.
  const [item] = await getDb(database)
    .select({ name: items.name, status: items.status, description: items.publicDescription })
    .from(items)
    .where(
      and(
        eq(items.number, identity.number),
        identity.registrationYear === null
          ? isNull(items.registrationYear)
          : eq(items.registrationYear, identity.registrationYear),
        eq(items.isPublic, true),
        isNull(items.archivedAt),
      ),
    )
    .limit(1);
  return item ? { ownerName, ...item } : null;
}
