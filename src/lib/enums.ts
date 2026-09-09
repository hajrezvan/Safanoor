/** نقش‌های مرکزی سامانه */
export const ROLE_KEYS = {
  ADMIN: "admin",
  MENTOR: "mentor",
  ASSISTANT_MENTOR: "assistant_mentor",
  STUDENT: "student",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const ROLE_TITLES_FA: Record<RoleKey, string> = {
  admin: "مدیر",
  mentor: "مربی",
  assistant_mentor: "کمک‌مربی",
  student: "دانش‌آموز",
};

/** وضعیت‌های استاندارد Action (فاز ۴) — از همین‌جا import شود */
export const ACTION_STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;

export type ActionStatus = (typeof ACTION_STATUS)[keyof typeof ACTION_STATUS];

export const ACTION_STATUS_TITLES_FA: Record<ActionStatus, string> = {
  TODO: "انجام‌نشده",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام‌شده",
  CANCELLED: "لغو‌شده",
};

/**
 * گذارهای مجاز چرخه حیات Action — داده خالص است تا هم سرویس و هم UI از یک مرجع
 * استفاده کنند و کامپوننت کلاینت نیازی به import سرویس نداشته باشد.
 */
export const ACTION_STATUS_TRANSITIONS: Record<ActionStatus, ActionStatus[]> = {
  TODO: [ACTION_STATUS.IN_PROGRESS, ACTION_STATUS.DONE, ACTION_STATUS.CANCELLED],
  IN_PROGRESS: [ACTION_STATUS.TODO, ACTION_STATUS.DONE, ACTION_STATUS.CANCELLED],
  DONE: [ACTION_STATUS.IN_PROGRESS],
  CANCELLED: [ACTION_STATUS.TODO],
};

/** وضعیت‌هایی که اکشن در آن‌ها بسته تلقی می‌شود (پیگیری/overdue محاسبه نمی‌شود) */
export const ACTION_CLOSED_STATUSES: ActionStatus[] = [
  ACTION_STATUS.DONE,
  ACTION_STATUS.CANCELLED,
];

export const ACTION_TYPE = {
  TASK: "task",
  STUDY: "study",
  PRACTICE: "practice",
  MEETING: "meeting",
  REPORT: "report",
  OTHER: "other",
} as const;

export type ActionType = (typeof ACTION_TYPE)[keyof typeof ACTION_TYPE];

export const ACTION_TYPE_TITLES_FA: Record<ActionType, string> = {
  task: "وظیفه",
  study: "مطالعه",
  practice: "تمرین",
  meeting: "جلسه",
  report: "گزارش",
  other: "سایر",
};

export const REFERRAL_STATUS = {
  OPEN: "OPEN",
  IN_REVIEW: "IN_REVIEW",
  RESOLVED: "RESOLVED",
  CANCELLED: "CANCELLED",
} as const;

export type ReferralStatus = (typeof REFERRAL_STATUS)[keyof typeof REFERRAL_STATUS];

export const REFERRAL_STATUS_TITLES_FA: Record<ReferralStatus, string> = {
  OPEN: "باز",
  IN_REVIEW: "در بررسی",
  RESOLVED: "حل‌شده",
  CANCELLED: "لغو‌شده",
};

export const NOTE_VISIBILITY = {
  PRIVATE_STAFF: "PRIVATE_STAFF",
  MENTOR_ONLY: "MENTOR_ONLY",
  STUDENT_VISIBLE: "STUDENT_VISIBLE",
} as const;

export type NoteVisibility = (typeof NOTE_VISIBILITY)[keyof typeof NOTE_VISIBILITY];

export const NOTE_VISIBILITY_TITLES_FA: Record<NoteVisibility, string> = {
  PRIVATE_STAFF: "خصوصی پشتیبان",
  MENTOR_ONLY: "فقط مربی",
  STUDENT_VISIBLE: "قابل مشاهده برای دانش‌آموز",
};

export const SESSION_CONFIDENTIALITY = {
  NORMAL: "NORMAL",
  SENSITIVE: "SENSITIVE",
  RESTRICTED: "RESTRICTED",
} as const;

export type SessionConfidentiality =
  (typeof SESSION_CONFIDENTIALITY)[keyof typeof SESSION_CONFIDENTIALITY];

export const SESSION_CONFIDENTIALITY_TITLES_FA: Record<SessionConfidentiality, string> = {
  NORMAL: "عادی",
  SENSITIVE: "حساس",
  RESTRICTED: "محدود",
};

export const ASSIGNMENT_ROLE = {
  MENTOR: "mentor",
  ASSISTANT_MENTOR: "assistant_mentor",
} as const;

export type AssignmentRole = (typeof ASSIGNMENT_ROLE)[keyof typeof ASSIGNMENT_ROLE];

export const ENTITY_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
} as const;

export type EntityStatus = (typeof ENTITY_STATUS)[keyof typeof ENTITY_STATUS];

export const STUDENT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  GRADUATED: "graduated",
} as const;

export type StudentStatus = (typeof STUDENT_STATUS)[keyof typeof STUDENT_STATUS];

export const STUDENT_STATUS_TITLES_FA: Record<string, string> = {
  [STUDENT_STATUS.ACTIVE]: "فعال",
  [STUDENT_STATUS.INACTIVE]: "غیرفعال",
  [STUDENT_STATUS.GRADUATED]: "فارغ‌التحصیل",
};

export const PATH_ENROLLMENT_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type PathEnrollmentStatus =
  (typeof PATH_ENROLLMENT_STATUS)[keyof typeof PATH_ENROLLMENT_STATUS];

export const PATH_ENROLLMENT_STATUS_TITLES_FA: Record<string, string> = {
  [PATH_ENROLLMENT_STATUS.ACTIVE]: "فعال",
  [PATH_ENROLLMENT_STATUS.COMPLETED]: "تکمیل‌شده",
  [PATH_ENROLLMENT_STATUS.ARCHIVED]: "آرشیو",
};

export const GROWTH_PATH_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type GrowthPathStatus = (typeof GROWTH_PATH_STATUS)[keyof typeof GROWTH_PATH_STATUS];

export const GROWTH_PATH_STATUS_TITLES_FA: Record<string, string> = {
  [GROWTH_PATH_STATUS.DRAFT]: "پیش‌نویس",
  [GROWTH_PATH_STATUS.ACTIVE]: "فعال",
  [GROWTH_PATH_STATUS.ARCHIVED]: "آرشیو",
};

export const GOAL_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ON_HOLD: "on_hold",
  CANCELLED: "cancelled",
} as const;

export type GoalStatus = (typeof GOAL_STATUS)[keyof typeof GOAL_STATUS];

export const GOAL_STATUS_TITLES_FA: Record<GoalStatus, string> = {
  active: "فعال",
  completed: "محقق‌شده",
  on_hold: "متوقف",
  cancelled: "لغو‌شده",
};

export const PLAN_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export const PLAN_STATUS_TITLES_FA: Record<PlanStatus, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  completed: "تمام‌شده",
  archived: "آرشیو",
};

export const CHAT_CONVERSATION_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;

export type ChatConversationStatus =
  (typeof CHAT_CONVERSATION_STATUS)[keyof typeof CHAT_CONVERSATION_STATUS];

export const LESSON_CONTENT_TYPE = {
  TEXT: "TEXT",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  FILE: "FILE",
  LINK: "LINK",
  PDF: "PDF",
  APARAT: "APARAT",
} as const;

export type LessonContentType = (typeof LESSON_CONTENT_TYPE)[keyof typeof LESSON_CONTENT_TYPE];

export const LESSON_CONTENT_TYPE_TITLES_FA: Record<string, string> = {
  [LESSON_CONTENT_TYPE.TEXT]: "متن",
  [LESSON_CONTENT_TYPE.VIDEO]: "ویدیو",
  [LESSON_CONTENT_TYPE.AUDIO]: "صوت",
  [LESSON_CONTENT_TYPE.FILE]: "فایل",
  [LESSON_CONTENT_TYPE.LINK]: "پیوند",
  [LESSON_CONTENT_TYPE.PDF]: "PDF",
  [LESSON_CONTENT_TYPE.APARAT]: "آپارات",
};

export const ANNOUNCEMENT_AUDIENCE = {
  ALL_STUDENTS: "all_students",
  GRADE: "grade",
  GROUP: "group",
} as const;

export type AnnouncementAudience =
  (typeof ANNOUNCEMENT_AUDIENCE)[keyof typeof ANNOUNCEMENT_AUDIENCE];

export const ANNOUNCEMENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type AnnouncementStatus =
  (typeof ANNOUNCEMENT_STATUS)[keyof typeof ANNOUNCEMENT_STATUS];

export const EXAM_RELATED_TYPE = {
  BOOK_CHAPTER: "book_chapter",
  LESSON: "lesson",
} as const;

export type ExamRelatedType = (typeof EXAM_RELATED_TYPE)[keyof typeof EXAM_RELATED_TYPE];

export const EXAM_SUBMISSION_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVIEWED: "reviewed",
} as const;

export type ExamSubmissionStatus =
  (typeof EXAM_SUBMISSION_STATUS)[keyof typeof EXAM_SUBMISSION_STATUS];

export const EXAM_ATTEMPT_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  EXPIRED: "expired",
} as const;

export type ExamAttemptStatus =
  (typeof EXAM_ATTEMPT_STATUS)[keyof typeof EXAM_ATTEMPT_STATUS];

export const EXAM_SECONDS_PER_QUESTION = 120;
export const EXAM_ALLOW_BACK_DEFAULT = false;

/** حداقل درصد برای قبولی در آزمون فصل (نمره ۰–۱۰۰) */
export const EXAM_PASS_SCORE = 70;

/** تعداد سوال تصادفی از بانک در هر تلاش (یا کمتر اگر بانک کوچک‌تر باشد) */
export const EXAM_QUESTIONS_PER_ATTEMPT = 3;

export const COURSE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const COURSE_STATUS_TITLES_FA: Record<string, string> = {
  [COURSE_STATUS.DRAFT]: "پیش‌نویس",
  [COURSE_STATUS.PUBLISHED]: "منتشرشده",
  [COURSE_STATUS.ARCHIVED]: "آرشیو",
};

export const READING_PLAN_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  OVERDUE: "overdue",
} as const;

export type ReadingPlanStatus = (typeof READING_PLAN_STATUS)[keyof typeof READING_PLAN_STATUS];

export const READING_PLAN_STATUS_TITLES_FA: Record<string, string> = {
  [READING_PLAN_STATUS.NOT_STARTED]: "شروع‌نشده",
  [READING_PLAN_STATUS.IN_PROGRESS]: "در حال مطالعه",
  [READING_PLAN_STATUS.COMPLETED]: "تمام‌شده",
  [READING_PLAN_STATUS.OVERDUE]: "عقب‌افتاده",
};

/** سطح دشواری کتاب — مقدار آزاد نیست تا فیلتر و نمایش یکدست بماند. */
export const BOOK_DIFFICULTY = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
} as const;

export type BookDifficulty = (typeof BOOK_DIFFICULTY)[keyof typeof BOOK_DIFFICULTY];

export const BOOK_DIFFICULTY_TITLES_FA: Record<string, string> = {
  [BOOK_DIFFICULTY.BEGINNER]: "مقدماتی",
  [BOOK_DIFFICULTY.INTERMEDIATE]: "متوسط",
  [BOOK_DIFFICULTY.ADVANCED]: "پیشرفته",
};

export const ACTIVITY_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];

export const ACTIVITY_STATUS_TITLES_FA: Record<ActivityStatus, string> = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "آرشیو",
};

/**
 * انواع فعالیت غیردیجیتال / پروژه‌ای — مقدار آزاد نیست تا فیلتر و گزارش یکدست بماند.
 * دوره‌های آنلاین جدا هستند (Phase 3).
 */
export const ACTIVITY_TYPE = {
  PROGRAMMING: "programming",
  WRITING: "writing",
  PHOTOGRAPHY: "photography",
  SPORTS: "sports",
  GROUP_PROJECT: "group_project",
  MEDIA: "media",
  STUDY: "study",
  PERSONAL_PRACTICE: "personal_practice",
} as const;

export type ActivityType = (typeof ACTIVITY_TYPE)[keyof typeof ACTIVITY_TYPE];

export const ACTIVITY_TYPE_TITLES_FA: Record<ActivityType, string> = {
  programming: "برنامه‌نویسی",
  writing: "نوشتن",
  photography: "عکاسی",
  sports: "ورزش",
  group_project: "پروژه گروهی",
  media: "رسانه",
  study: "مطالعه / تحقیق",
  personal_practice: "تمرین فردی",
};

export const ACTIVITY_ASSIGNMENT_STATUS = {
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  REVIEWED: "reviewed",
  OVERDUE: "overdue",
} as const;

export type ActivityAssignmentStatus =
  (typeof ACTIVITY_ASSIGNMENT_STATUS)[keyof typeof ACTIVITY_ASSIGNMENT_STATUS];

export const ACTIVITY_ASSIGNMENT_STATUS_TITLES_FA: Record<ActivityAssignmentStatus, string> = {
  assigned: "محول‌شده",
  in_progress: "در حال انجام",
  submitted: "ارسال‌شده",
  reviewed: "بازبینی‌شده",
  overdue: "عقب‌افتاده",
};

/** relatedType در progress_records */
export const PROGRESS_RELATED_TYPE = {
  ACTIVITY_ASSIGNMENT: "activity_assignment",
  LESSON: "lesson",
} as const;

export type ProgressRelatedType =
  (typeof PROGRESS_RELATED_TYPE)[keyof typeof PROGRESS_RELATED_TYPE];

export const PROGRESS_STATUS = {
  RECORDED: "recorded",
  SUBMITTED: "submitted",
  REVIEWED: "reviewed",
  DONE: "done",
} as const;

export type ProgressStatus = (typeof PROGRESS_STATUS)[keyof typeof PROGRESS_STATUS];

export const PROGRESS_STATUS_TITLES_FA: Record<ProgressStatus, string> = {
  recorded: "ثبت‌شده",
  submitted: "ارسال‌شده",
  reviewed: "بازبینی‌شده",
  done: "تکمیل‌شده",
};

export const KNOWLEDGE_ITEM_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type KnowledgeItemStatus =
  (typeof KNOWLEDGE_ITEM_STATUS)[keyof typeof KNOWLEDGE_ITEM_STATUS];

export const KNOWLEDGE_ITEM_STATUS_TITLES_FA: Record<KnowledgeItemStatus, string> = {
  [KNOWLEDGE_ITEM_STATUS.DRAFT]: "پیش‌نویس",
  [KNOWLEDGE_ITEM_STATUS.PUBLISHED]: "منتشرشده",
  [KNOWLEDGE_ITEM_STATUS.ARCHIVED]: "آرشیو",
};

/** دسته‌های پیشنهادی بانک دانش — مقدار آزاد هم پذیرفته می‌شود. */
export const KNOWLEDGE_CATEGORIES = {
  MOTIVATION: "انگیزه تحصیلی",
  FAMILY: "روابط خانوادگی",
  TIME: "مدیریت زمان",
  EXAM_ANXIETY: "اضطراب امتحان",
  PEERS: "دوستی و هم‌سالان",
  SELF_ESTEEM: "هویت و خودباوری",
  DIGITAL: "فضای مجازی",
  RESPONSIBILITY: "انضباط و مسئولیت",
} as const;

export type KnowledgeCategory =
  (typeof KNOWLEDGE_CATEGORIES)[keyof typeof KNOWLEDGE_CATEGORIES];

export const AI_ACCEPTED_STATUS = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  PENDING: "pending",
} as const;

export type AiAcceptedStatus = (typeof AI_ACCEPTED_STATUS)[keyof typeof AI_ACCEPTED_STATUS];

export const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const PRIORITY_TITLES_FA: Record<Priority, string> = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  urgent: "فوری",
};

export const GOAL_CATEGORY_KEYS = {
  MAAREFATI: "maarefati",
  TAHSILI: "tahsili",
  MAHARATI: "maharati",
  JESMANI: "jesmani",
  MOTALEATI: "motaleati",
  FARDI: "fardi",
  EJTEMAEI: "ejtemaee",
} as const;

export type GoalCategoryKey = (typeof GOAL_CATEGORY_KEYS)[keyof typeof GOAL_CATEGORY_KEYS];

export const GOAL_CATEGORY_TITLES_FA: Record<GoalCategoryKey, string> = {
  maarefati: "معرفتی",
  tahsili: "تحصیلی",
  maharati: "مهارتی",
  jesmani: "جسمانی",
  motaleati: "مطالعاتی",
  fardi: "فردی",
  ejtemaee: "اجتماعی",
};
