ALTER TABLE `items` ADD `registration_year` integer;--> statement-breakpoint
ALTER TABLE `items` ADD `is_container` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `items` ADD `tags` text DEFAULT '[]' NOT NULL;