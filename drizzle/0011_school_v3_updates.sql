CREATE TABLE `school_exam_point_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`student_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`points` integer NOT NULL,
	`awarded_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `school_exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_exam_point_award_unique` ON `school_exam_point_awards` (`exam_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `school_exam_point_award_student_idx` ON `school_exam_point_awards` (`student_id`);--> statement-breakpoint
CREATE TABLE `school_lesson_views` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`viewer_user_id` text,
	`session_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_lesson_view_session_unique` ON `school_lesson_views` (`lesson_id`,`session_key`);--> statement-breakpoint
CREATE INDEX `school_lesson_view_lesson_idx` ON `school_lesson_views` (`lesson_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `school_exams` ADD `pass_bonus_points` integer DEFAULT 10 NOT NULL;