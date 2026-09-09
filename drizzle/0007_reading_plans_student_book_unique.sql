-- Keep one reading plan per student+book (oldest row), then enforce uniqueness.
DELETE FROM `reading_plans`
WHERE `rowid` NOT IN (
	SELECT MIN(`rowid`)
	FROM `reading_plans`
	GROUP BY `student_id`, `book_id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reading_plans_student_book_unique` ON `reading_plans` (`student_id`,`book_id`);
