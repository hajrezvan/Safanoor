CREATE TABLE `lesson_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lesson_notes_student_id_idx` ON `lesson_notes` (`student_id`);
--> statement-breakpoint
CREATE INDEX `lesson_notes_lesson_id_idx` ON `lesson_notes` (`lesson_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_notes_student_lesson_unique` ON `lesson_notes` (`student_id`,`lesson_id`);
