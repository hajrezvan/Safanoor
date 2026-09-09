CREATE TABLE `exam_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`prompt` text NOT NULL,
	`options_json` text NOT NULL,
	`correct_option_key` text NOT NULL,
	`ordering` integer NOT NULL DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exam_questions_exam_id_idx` ON `exam_questions` (`exam_id`);
--> statement-breakpoint
INSERT INTO `exam_questions` (`id`, `exam_id`, `prompt`, `options_json`, `correct_option_key`, `ordering`, `created_at`, `updated_at`)
SELECT
	'eq_mig_' || `id`,
	`id`,
	`prompt`,
	COALESCE(`options_json`, '[]'),
	COALESCE(`correct_option_key`, 'A'),
	0,
	`created_at`,
	`updated_at`
FROM `exams`
WHERE `options_json` IS NOT NULL AND length(trim(`options_json`)) > 2;
--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `question_ids_json` text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE `exam_attempts` ADD `seen_question_ids_json` text NOT NULL DEFAULT '[]';
