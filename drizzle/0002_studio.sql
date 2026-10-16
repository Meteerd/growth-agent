CREATE TABLE `studio_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`step` text,
	`progress` real DEFAULT 0 NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`log` text NOT NULL,
	`error` text,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_jobs_brand_idx` ON `studio_jobs` (`brand_id`);
--> statement-breakpoint
CREATE TABLE `ad_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`advertiser` text NOT NULL,
	`media_type` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ad_refs_brand_idx` ON `ad_refs` (`brand_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `ad_refs_brand_ext_idx` ON `ad_refs` (`brand_id`,`source`,`external_id`);
--> statement-breakpoint
CREATE TABLE `ads` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`format` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ads_brand_idx` ON `ads` (`brand_id`);
--> statement-breakpoint
CREATE INDEX `ads_batch_idx` ON `ads` (`batch_id`);
--> statement-breakpoint
CREATE TABLE `studio_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`seq` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_messages_thread_idx` ON `studio_messages` (`thread_id`,`seq`);
--> statement-breakpoint
CREATE TABLE `studio_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
