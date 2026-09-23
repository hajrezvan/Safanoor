CREATE TABLE `school_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `school_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`questions` text NOT NULL,
	`answers` text NOT NULL,
	`grades` text NOT NULL,
	`score` integer,
	`started_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`exam_id`) REFERENCES `school_exams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `school_attempt_student_idx` ON `school_attempts` (`student_id`,`exam_id`);--> statement-breakpoint
CREATE TABLE `school_banks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_banners` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`image` text NOT NULL,
	`href` text NOT NULL,
	`ordering` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`number` text NOT NULL,
	`student_name` text NOT NULL,
	`course_title` text NOT NULL,
	`issued_at` text NOT NULL,
	`revoked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `school_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_certificates_enrollment_id_unique` ON `school_certificates` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_certificates_number_unique` ON `school_certificates` (`number`);--> statement-breakpoint
CREATE TABLE `school_comment_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `school_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_like_unique` ON `school_comment_likes` (`comment_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `school_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`lesson_id` text,
	`author_id` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `school_comment_course_idx` ON `school_comments` (`course_id`);--> statement-breakpoint
CREATE TABLE `school_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_enrollment_unique` ON `school_enrollments` (`course_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `school_exams` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`scope` text DEFAULT 'course' NOT NULL,
	`scope_id` text,
	`title` text NOT NULL,
	`bank_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`duration_minutes` integer DEFAULT 20 NOT NULL,
	`passing_percent` integer DEFAULT 60 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`question_count` integer DEFAULT 10 NOT NULL,
	`shuffle_questions` integer DEFAULT true NOT NULL,
	`shuffle_options` integer DEFAULT true NOT NULL,
	`show_answers` integer DEFAULT false NOT NULL,
	`release_results` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_id`) REFERENCES `school_banks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `school_playlist_lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`ordering` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `school_playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_playlist_lesson_unique` ON `school_playlist_lessons` (`playlist_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `school_playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_path` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`ordering` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_presenters` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `school_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_id` text NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`answer` text NOT NULL,
	`points` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`bank_id`) REFERENCES `school_banks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `course_chapters` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `is_standalone_collection` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `is_public` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `issue_certificate` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `parent_course_id` text;--> statement-breakpoint
ALTER TABLE `courses` ADD `is_group` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `duration_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `audio_url` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `is_preview` integer DEFAULT false NOT NULL;