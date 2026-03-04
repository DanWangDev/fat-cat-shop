CREATE TABLE `recommendation_code_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`code_id` text NOT NULL,
	`used_by_email` text NOT NULL,
	`order_id` text NOT NULL,
	`used_at` text NOT NULL,
	FOREIGN KEY (`code_id`) REFERENCES `recommendation_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recommendation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`order_id` text NOT NULL,
	`customer_email` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_codes_code_unique` ON `recommendation_codes` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_recommendation_codes_code` ON `recommendation_codes` (`code`);--> statement-breakpoint
ALTER TABLE `orders` ADD `recommendation_code` text;