import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { itemStatuses, ownerships } from "src/lib/item-attributes";
import type { PublicUse, UsesImage } from "src/lib/media";

// SQLite CHECK expressions require literals, not bind parameters.
const sqliteEnum = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", "));

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => locations.id),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("locations_parent_id_idx").on(table.parentId),
    check("locations_name_required", sql`length(trim(${table.name})) BETWEEN 1 AND 100`),
  ],
);

export const items = sqliteTable(
  "items",
  {
    number: integer("number").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    registrationYear: integer("registration_year"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isContainer: integer("is_container", { mode: "boolean" }).notNull().default(false),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    status: text("status", { enum: itemStatuses }).notNull().default("available"),
    ownership: text("ownership", { enum: ownerships }).notNull().default("owned"),
    locationId: text("location_id").references(() => locations.id),
    containerItemId: text("container_item_id").references((): AnySQLiteColumn => items.id),
    archivedAt: integer("archived_at"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("items_location_id_idx").on(table.locationId),
    index("items_container_item_id_idx").on(table.containerItemId),
    index("items_archived_at_idx").on(table.archivedAt),
    check("items_one_storage", sql`${table.locationId} IS NULL OR ${table.containerItemId} IS NULL`),
    check("items_name_required", sql`length(trim(${table.name})) BETWEEN 1 AND 200`),
    check("items_valid_status", sql`${table.status} IN (${sqliteEnum(itemStatuses)})`),
    check("items_valid_ownership", sql`${table.ownership} IN (${sqliteEnum(ownerships)})`),
  ],
);

export const itemAssets = sqliteTable(
  "item_assets",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id),
    objectKey: text("object_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type", { enum: ["image/jpeg", "image/png"] }).notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    state: text("state", { enum: ["uploading", "ready", "deleting"] }).notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("item_assets_item_id_idx").on(table.itemId)],
);

export const usesEntries = sqliteTable(
  "uses_entries",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .unique()
      .references(() => items.id),
    title: text("title").notNull().default(""),
    descriptionMarkdown: text("description_markdown").notNull().default(""),
    externalUrl: text("external_url"),
    section: text("section").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    images: text("images", { mode: "json" }).$type<UsesImage[]>().notNull().default(sql`'[]'`),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    publicContent: text("public_content", { mode: "json" }).$type<PublicUse>(),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("uses_entries_published_order_idx").on(table.isPublished, table.sortOrder, table.id)],
);
