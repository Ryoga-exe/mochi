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
CREATE INDEX `uses_entries_published_order_idx` ON `uses_entries` (`is_published`,`sort_order`,`id`);