CREATE TABLE `render_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `render_versions_concept_idx` ON `render_versions` (`concept_id`);