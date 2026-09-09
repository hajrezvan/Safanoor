CREATE TABLE `course_prerequisites` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`prerequisite_course_id` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prerequisite_course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_prerequisites_course_id_idx` ON `course_prerequisites` (`course_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_prerequisites_unique` ON `course_prerequisites` (`course_id`,`prerequisite_course_id`);
--> statement-breakpoint
CREATE TABLE `course_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`ordering` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `course_chapters_course_id_idx` ON `course_chapters` (`course_id`);
--> statement-breakpoint
CREATE TABLE `book_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`title` text NOT NULL,
	`ordering` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `book_chapters_book_id_idx` ON `book_chapters` (`book_id`);
--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`author_user_id` text NOT NULL,
	`audience` text NOT NULL,
	`grade_id` text,
	`group_id` text,
	`status` text NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_status_idx` ON `announcements` (`status`);
--> statement-breakpoint
CREATE INDEX `announcements_audience_idx` ON `announcements` (`audience`);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` text PRIMARY KEY NOT NULL,
	`related_type` text NOT NULL,
	`related_id` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exams_related_idx` ON `exams` (`related_type`,`related_id`);
--> statement-breakpoint
CREATE TABLE `exam_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`student_id` text NOT NULL,
	`answer_text` text NOT NULL,
	`status` text NOT NULL,
	`score` integer,
	`feedback` text,
	`reviewed_by` text,
	`submitted_at` text,
	`reviewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exam_submissions_exam_id_idx` ON `exam_submissions` (`exam_id`);
--> statement-breakpoint
CREATE INDEX `exam_submissions_student_id_idx` ON `exam_submissions` (`student_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_submissions_exam_student_unique` ON `exam_submissions` (`exam_id`,`student_id`);
--> statement-breakpoint
ALTER TABLE `lessons` ADD `chapter_id` text REFERENCES `course_chapters`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE INDEX `lessons_chapter_id_idx` ON `lessons` (`chapter_id`);
