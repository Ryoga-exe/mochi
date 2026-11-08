CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `item_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_assets_object_key_unique` ON `item_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `item_assets_item_id_idx` ON `item_assets` (`item_id`);--> statement-breakpoint
CREATE TABLE `items` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`registration_year` integer NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`public_description` text DEFAULT '' NOT NULL,
	`is_container` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`ownership` text DEFAULT 'owned' NOT NULL,
	`location_id` text,
	`container_item_id` text,
	`archived_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`container_item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "items_one_storage" CHECK("items"."location_id" IS NULL OR "items"."container_item_id" IS NULL),
	CONSTRAINT "items_name_required" CHECK(length(trim("items"."name")) BETWEEN 1 AND 200),
	CONSTRAINT "items_valid_status" CHECK("items"."status" IN ('available', 'lent', 'lost', 'retired')),
	CONSTRAINT "items_valid_ownership" CHECK("items"."ownership" IN ('owned', 'borrowed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_id_unique` ON `items` (`id`);--> statement-breakpoint
CREATE INDEX `items_location_id_idx` ON `items` (`location_id`);--> statement-breakpoint
CREATE INDEX `items_container_item_id_idx` ON `items` (`container_item_id`);--> statement-breakpoint
CREATE INDEX `items_archived_at_idx` ON `items` (`archived_at`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "locations_name_required" CHECK(length(trim("locations"."name")) BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE INDEX `locations_parent_id_idx` ON `locations` (`parent_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `uses_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description_markdown` text DEFAULT '' NOT NULL,
	`external_url` text,
	`section` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`public_content` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uses_entries_item_id_unique` ON `uses_entries` (`item_id`);--> statement-breakpoint
CREATE INDEX `uses_entries_published_order_idx` ON `uses_entries` (`is_published`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
--> statement-breakpoint
-- Keep hierarchy validation in the same atomic statement as each write.
CREATE TRIGGER locations_storage_insert
BEFORE INSERT ON locations
BEGIN
  SELECT RAISE(ABORT, 'location_cycle')
  WHERE NEW.parent_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM locations WHERE id = NEW.parent_id
      UNION
      SELECT l.id, l.parent_id FROM locations l JOIN ancestors a ON l.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER locations_storage_update
BEFORE UPDATE OF parent_id ON locations
BEGIN
  SELECT RAISE(ABORT, 'location_cycle')
  WHERE NEW.parent_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, parent_id) AS (
      SELECT id, parent_id FROM locations WHERE id = NEW.parent_id
      UNION
      SELECT l.id, l.parent_id FROM locations l JOIN ancestors a ON l.id = a.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_storage_insert
BEFORE INSERT ON items
BEGIN
  SELECT RAISE(ABORT, 'archived_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'item_cycle')
  WHERE NEW.container_item_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, container_item_id) AS (
      SELECT id, container_item_id FROM items WHERE id = NEW.container_item_id
      UNION
      SELECT i.id, i.container_item_id FROM items i JOIN ancestors a ON i.id = a.container_item_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_storage_update
BEFORE UPDATE OF container_item_id ON items
BEGIN
  SELECT RAISE(ABORT, 'archived_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'item_cycle')
  WHERE NEW.container_item_id = NEW.id OR EXISTS (
    WITH RECURSIVE ancestors(id, container_item_id) AS (
      SELECT id, container_item_id FROM items WHERE id = NEW.container_item_id
      UNION
      SELECT i.id, i.container_item_id FROM items i JOIN ancestors a ON i.id = a.container_item_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_archive_nonempty
BEFORE UPDATE OF archived_at ON items
WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
BEGIN
  SELECT RAISE(ABORT, 'container_not_empty')
  WHERE EXISTS (SELECT 1 FROM items WHERE container_item_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER items_require_container_insert
BEFORE INSERT ON items
BEGIN
  SELECT RAISE(ABORT, 'not_a_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND is_container <> 1);
END;
--> statement-breakpoint
CREATE TRIGGER items_require_container_update
BEFORE UPDATE OF container_item_id ON items
BEGIN
  SELECT RAISE(ABORT, 'not_a_container')
  WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.container_item_id AND is_container <> 1);
END;
--> statement-breakpoint
CREATE TRIGGER items_container_flag_update
BEFORE UPDATE OF is_container ON items
WHEN NEW.is_container <> 1
BEGIN
  SELECT RAISE(ABORT, 'container_flag_in_use')
  WHERE EXISTS (SELECT 1 FROM items WHERE container_item_id = NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER items_number_immutable
BEFORE UPDATE OF number, registration_year ON items
WHEN NEW.number <> OLD.number OR NEW.registration_year IS NOT OLD.registration_year
BEGIN
  SELECT RAISE(ABORT, 'item_number_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_insert_guard
BEFORE INSERT ON item_assets
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'too_many_images') WHERE (SELECT count(*) FROM item_assets WHERE item_id = NEW.item_id) >= 20;
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_ready_guard
BEFORE UPDATE OF state ON item_assets WHEN NEW.state = 'ready'
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_delete_guard
BEFORE DELETE ON item_assets
BEGIN
  SELECT RAISE(ABORT, 'asset_in_use') WHERE EXISTS (
    SELECT 1 FROM uses_entries u, json_each(u.images) image WHERE json_extract(image.value, '$.assetId') = OLD.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER item_assets_deleting_guard
BEFORE UPDATE OF state ON item_assets WHEN NEW.state = 'deleting'
BEGIN
  SELECT RAISE(ABORT, 'asset_in_use') WHERE EXISTS (
    SELECT 1 FROM uses_entries u, json_each(u.images) image WHERE json_extract(image.value, '$.assetId') = NEW.id
  );
END;
--> statement-breakpoint
CREATE TRIGGER uses_entries_insert_guard
BEFORE INSERT ON uses_entries
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE NEW.is_published = 1 AND EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'invalid_public_image') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.images) image LEFT JOIN item_assets a ON a.id = json_extract(image.value, '$.assetId')
    WHERE a.id IS NULL OR a.item_id <> NEW.item_id OR a.state <> 'ready'
  );
END;
--> statement-breakpoint
CREATE TRIGGER uses_entries_update_guard
BEFORE UPDATE OF images, item_id, is_published ON uses_entries
BEGIN
  SELECT RAISE(ABORT, 'archived_item') WHERE NEW.is_published = 1 AND EXISTS (SELECT 1 FROM items WHERE id = NEW.item_id AND archived_at IS NOT NULL);
  SELECT RAISE(ABORT, 'invalid_public_image') WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.images) image LEFT JOIN item_assets a ON a.id = json_extract(image.value, '$.assetId')
    WHERE a.id IS NULL OR a.item_id <> NEW.item_id OR a.state <> 'ready'
  );
END;
--> statement-breakpoint
CREATE TRIGGER items_archive_unpublish
AFTER UPDATE OF archived_at ON items WHEN NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL
BEGIN
  UPDATE uses_entries SET is_published = 0, public_content = NULL, version = version + 1, updated_at = NEW.updated_at WHERE item_id = NEW.id;
END;
