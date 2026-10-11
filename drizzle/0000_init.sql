CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`concept_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assets_concept_idx` ON `assets` (`concept_id`);--> statement-breakpoint
CREATE TABLE `blueprints` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`run_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `blueprints_run_idx` ON `blueprints` (`run_id`);--> statement-breakpoint
CREATE TABLE `brands` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`vertical` text NOT NULL,
	`countries` text NOT NULL,
	`languages` text NOT NULL,
	`rule_pack` text NOT NULL,
	`dossier` text NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_slug_unique` ON `brands` (`slug`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chat_run_idx` ON `chat_messages` (`run_id`);--> statement-breakpoint
CREATE TABLE `compliance_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`target_id` text NOT NULL,
	`status` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `compliance_target_idx` ON `compliance_checks` (`target_id`);--> statement-breakpoint
CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`status` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `concepts_run_idx` ON `concepts` (`run_id`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`config` text NOT NULL,
	`last_sync_at` text,
	`summary` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `connections_brand_idx` ON `connections` (`brand_id`);--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`run_id` text NOT NULL,
	`source` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`captured_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_run_idx` ON `evidence` (`run_id`);--> statement-breakpoint
CREATE INDEX `evidence_brand_idx` ON `evidence` (`brand_id`);--> statement-breakpoint
CREATE TABLE `learnings` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text,
	`insight` text NOT NULL,
	`evidence` text NOT NULL,
	`confidence` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`pack_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`views` real,
	`likes` real,
	`comments` real,
	`shares` real,
	`saves` real,
	`follows` real,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `metrics_pack_idx` ON `metric_snapshots` (`pack_id`);--> statement-breakpoint
CREATE TABLE `packs` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`run_id` text,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `packs_brand_idx` ON `packs` (`brand_id`);--> statement-breakpoint
CREATE INDEX `packs_run_idx` ON `packs` (`run_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`brand_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plans_run_idx` ON `plans` (`run_id`);--> statement-breakpoint
CREATE TABLE `provider_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`ord` integer NOT NULL,
	`body` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `questions_run_idx` ON `questions` (`run_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`round` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_concept_idx` ON `reviews` (`concept_id`);--> statement-breakpoint
CREATE TABLE `run_events` (
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`ts` text NOT NULL,
	`phase` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`ref_id` text,
	`cost_usd` real,
	`data` text,
	PRIMARY KEY(`run_id`, `seq`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`brand_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`started_at` text,
	`finished_at` text,
	`error` text,
	`demo` integer DEFAULT false NOT NULL,
	`dataset` text,
	`captured_at` text,
	`manus_task_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `runs_brand_idx` ON `runs` (`brand_id`);--> statement-breakpoint
CREATE TABLE `spend_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`run_id` text,
	`usd` real NOT NULL,
	`units` text,
	`note` text NOT NULL,
	`ts` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `spend_provider_idx` ON `spend_entries` (`provider`);