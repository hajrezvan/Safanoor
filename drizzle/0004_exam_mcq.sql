ALTER TABLE `exams` ADD `options_json` text;
--> statement-breakpoint
ALTER TABLE `exams` ADD `correct_option_key` text;
--> statement-breakpoint
ALTER TABLE `exam_submissions` ADD `selected_option` text;
