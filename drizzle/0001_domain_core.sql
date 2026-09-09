CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title_fa` text NOT NULL,
	`ordering` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grades_key_unique` ON `grades` (`key`);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`grade_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `groups_grade_id_idx` ON `groups` (`grade_id`);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`grade_id` text,
	`group_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_user_id_unique` ON `students` (`user_id`);
--> statement-breakpoint
CREATE INDEX `students_grade_id_idx` ON `students` (`grade_id`);
--> statement-breakpoint
CREATE INDEX `students_group_id_idx` ON `students` (`group_id`);
--> statement-breakpoint
CREATE TABLE `growth_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`interests` text,
	`skills` text,
	`academic_status` text,
	`overall_note` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `growth_profiles_student_id_unique` ON `growth_profiles` (`student_id`);
--> statement-breakpoint
CREATE TABLE `mentor_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`staff_user_id` text NOT NULL,
	`assignment_role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mentor_assignments_student_id_idx` ON `mentor_assignments` (`student_id`);
--> statement-breakpoint
CREATE INDEX `mentor_assignments_staff_user_id_idx` ON `mentor_assignments` (`staff_user_id`);
--> statement-breakpoint
CREATE INDEX `mentor_assignments_active_idx` ON `mentor_assignments` (`student_id`,`is_active`);
--> statement-breakpoint
CREATE INDEX `mentor_assignments_role_active_idx` ON `mentor_assignments` (`student_id`,`assignment_role`,`is_active`);
--> statement-breakpoint
CREATE UNIQUE INDEX `mentor_assignments_one_active_per_role` ON `mentor_assignments` (`student_id`,`assignment_role`) WHERE `is_active` = 1;
--> statement-breakpoint
CREATE TABLE `growth_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`grade_id` text NOT NULL,
	`status` text NOT NULL,
	`ordering` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `growth_paths_grade_id_idx` ON `growth_paths` (`grade_id`);
--> statement-breakpoint
CREATE TABLE `path_objectives` (
	`id` text PRIMARY KEY NOT NULL,
	`path_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`ordering` integer NOT NULL,
	FOREIGN KEY (`path_id`) REFERENCES `growth_paths`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `path_objectives_path_id_idx` ON `path_objectives` (`path_id`);
--> statement-breakpoint
CREATE TABLE `path_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`path_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`path_id`) REFERENCES `growth_paths`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `path_enrollments_student_id_idx` ON `path_enrollments` (`student_id`);
--> statement-breakpoint
CREATE INDEX `path_enrollments_path_id_idx` ON `path_enrollments` (`path_id`);
--> statement-breakpoint
CREATE INDEX `path_enrollments_student_status_idx` ON `path_enrollments` (`student_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `path_enrollments_student_path_unique` ON `path_enrollments` (`student_id`,`path_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `path_enrollments_one_active_per_student` ON `path_enrollments` (`student_id`) WHERE `status` = 'active';
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_path` text,
	`status` text NOT NULL,
	`ordering` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`ordering` integer NOT NULL,
	`content_type` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lessons_course_id_idx` ON `lessons` (`course_id`);
--> statement-breakpoint
CREATE TABLE `lesson_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`body` text,
	`file_path` text,
	`url` text,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_contents_lesson_id_unique` ON `lesson_contents` (`lesson_id`);
--> statement-breakpoint
CREATE INDEX `lesson_contents_lesson_id_idx` ON `lesson_contents` (`lesson_id`);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`description` text,
	`cover_path` text,
	`difficulty` text,
	`estimated_minutes` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`book_id` text NOT NULL,
	`start_date` text NOT NULL,
	`deadline` text,
	`status` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`mentor_note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reading_plans_student_id_idx` ON `reading_plans` (`student_id`);
--> statement-breakpoint
CREATE INDEX `reading_plans_book_id_idx` ON `reading_plans` (`book_id`);
--> statement-breakpoint
CREATE TABLE `goal_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title_fa` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_categories_key_unique` ON `goal_categories` (`key`);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category_id` text NOT NULL,
	`priority` text NOT NULL,
	`start_date` text NOT NULL,
	`target_date` text,
	`status` text NOT NULL,
	`mentor_note` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `goal_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goals_student_id_idx` ON `goals` (`student_id`);
--> statement-breakpoint
CREATE INDEX `goals_category_id_idx` ON `goals` (`category_id`);
--> statement-breakpoint
CREATE INDEX `goals_status_idx` ON `goals` (`status`);
--> statement-breakpoint
CREATE TABLE `individual_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `individual_plans_student_id_idx` ON `individual_plans` (`student_id`);
--> statement-breakpoint
CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text,
	`goal_id` text,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`assignee_user_id` text NOT NULL,
	`start_date` text NOT NULL,
	`deadline` text,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`result` text,
	`mentor_feedback` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `individual_plans`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `actions_student_id_idx` ON `actions` (`student_id`);
--> statement-breakpoint
CREATE INDEX `actions_plan_id_idx` ON `actions` (`plan_id`);
--> statement-breakpoint
CREATE INDEX `actions_goal_id_idx` ON `actions` (`goal_id`);
--> statement-breakpoint
CREATE INDEX `actions_status_idx` ON `actions` (`status`);
--> statement-breakpoint
CREATE INDEX `actions_assignee_user_id_idx` ON `actions` (`assignee_user_id`);
--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`student_user_id` text NOT NULL,
	`staff_user_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`student_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_conversations_student_user_id_idx` ON `chat_conversations` (`student_user_id`);
--> statement-breakpoint
CREATE INDEX `chat_conversations_staff_user_id_idx` ON `chat_conversations` (`staff_user_id`);
--> statement-breakpoint
CREATE INDEX `chat_conversations_status_idx` ON `chat_conversations` (`student_user_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_conversations_one_active_per_pair` ON `chat_conversations` (`student_user_id`,`staff_user_id`) WHERE `status` = 'active';
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_id_idx` ON `chat_messages` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX `chat_messages_sender_user_id_idx` ON `chat_messages` (`sender_user_id`);
--> statement-breakpoint
CREATE TABLE `mentoring_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`staff_user_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`duration_minutes` integer,
	`topics` text,
	`raw_notes` text,
	`summary` text,
	`observations` text,
	`follow_up_date` text,
	`referral_required` integer DEFAULT false NOT NULL,
	`confidentiality` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`staff_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mentoring_sessions_student_id_idx` ON `mentoring_sessions` (`student_id`);
--> statement-breakpoint
CREATE INDEX `mentoring_sessions_staff_user_id_idx` ON `mentoring_sessions` (`staff_user_id`);
--> statement-breakpoint
CREATE INDEX `mentoring_sessions_date_idx` ON `mentoring_sessions` (`date`);
--> statement-breakpoint
CREATE TABLE `mentor_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`author_user_id` text NOT NULL,
	`student_id` text NOT NULL,
	`content` text NOT NULL,
	`visibility` text NOT NULL,
	`tags` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mentor_notes_student_id_idx` ON `mentor_notes` (`student_id`);
--> statement-breakpoint
CREATE INDEX `mentor_notes_author_user_id_idx` ON `mentor_notes` (`author_user_id`);
--> statement-breakpoint
CREATE INDEX `mentor_notes_visibility_idx` ON `mentor_notes` (`visibility`);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`created_by` text NOT NULL,
	`assigned_to` text,
	`subject` text NOT NULL,
	`description` text,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`response` text,
	`resolved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `referrals_student_id_idx` ON `referrals` (`student_id`);
--> statement-breakpoint
CREATE INDEX `referrals_status_idx` ON `referrals` (`status`);
--> statement-breakpoint
CREATE INDEX `referrals_assigned_to_idx` ON `referrals` (`assigned_to`);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`grade_id` text,
	`instructions` text,
	`expected_output` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grade_id`) REFERENCES `grades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activities_grade_id_idx` ON `activities` (`grade_id`);
--> statement-breakpoint
CREATE TABLE `activity_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`due_date` text,
	`result` text,
	`feedback` text,
	`submitted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_assignments_activity_id_idx` ON `activity_assignments` (`activity_id`);
--> statement-breakpoint
CREATE INDEX `activity_assignments_student_id_idx` ON `activity_assignments` (`student_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_assignments_unique` ON `activity_assignments` (`activity_id`,`student_id`);
--> statement-breakpoint
CREATE TABLE `progress_records` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`related_type` text NOT NULL,
	`related_id` text NOT NULL,
	`status` text NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`report_text` text,
	`evidence_url` text,
	`evidence_file_path` text,
	`mentor_feedback` text,
	`recorded_at` text NOT NULL,
	`reviewed_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `progress_records_student_id_idx` ON `progress_records` (`student_id`);
--> statement-breakpoint
CREATE INDEX `progress_records_related_idx` ON `progress_records` (`related_type`,`related_id`);
--> statement-breakpoint
CREATE INDEX `progress_records_status_idx` ON `progress_records` (`status`);
--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`question_scenario` text NOT NULL,
	`recommended_approach` text NOT NULL,
	`cautions` text,
	`tags` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `knowledge_items_category_idx` ON `knowledge_items` (`category`);
--> statement-breakpoint
CREATE INDEX `knowledge_items_status_idx` ON `knowledge_items` (`status`);
--> statement-breakpoint
CREATE TABLE `ai_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`feature` text NOT NULL,
	`model` text NOT NULL,
	`created_at` text NOT NULL,
	`context_meta` text,
	`output` text NOT NULL,
	`accepted` text,
	`created_by` text NOT NULL,
	`student_id` text,
	`related_type` text,
	`related_id` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_interactions_created_by_idx` ON `ai_interactions` (`created_by`);
--> statement-breakpoint
CREATE INDEX `ai_interactions_student_id_idx` ON `ai_interactions` (`student_id`);
--> statement-breakpoint
CREATE INDEX `ai_interactions_feature_idx` ON `ai_interactions` (`feature`);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_events_actor_user_id_idx` ON `audit_events` (`actor_user_id`);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `audit_events_created_at_idx` ON `audit_events` (`created_at`);
