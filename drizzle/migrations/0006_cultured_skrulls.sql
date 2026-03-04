ALTER TABLE `analytics_events` ADD `metadata` text;--> statement-breakpoint
CREATE INDEX `idx_analytics_events_created_at` ON `analytics_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_event` ON `analytics_events` (`event`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_visitor_id` ON `analytics_events` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_path` ON `analytics_events` (`path`);--> statement-breakpoint
CREATE INDEX `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_payment_status` ON `orders` (`payment_status`);