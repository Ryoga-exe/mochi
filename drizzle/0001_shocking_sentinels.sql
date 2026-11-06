CREATE TABLE `items` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
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
CREATE INDEX `locations_parent_id_idx` ON `locations` (`parent_id`);