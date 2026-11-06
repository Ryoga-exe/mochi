ALTER TABLE `items` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `public_description` text DEFAULT '' NOT NULL;