CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`question_count` integer NOT NULL,
	`seconds_per_question` integer NOT NULL,
	`allow_back` integer NOT NULL DEFAULT 0,
	`current_index` integer NOT NULL DEFAULT 0,
	`answers_json` text NOT NULL DEFAULT '{}',
	`score` integer,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `exam_attempts_exam_id_idx` ON `exam_attempts` (`exam_id`);
--> statement-breakpoint
CREATE INDEX `exam_attempts_student_id_idx` ON `exam_attempts` (`student_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_attempts_exam_student_unique` ON `exam_attempts` (`exam_id`,`student_id`);
