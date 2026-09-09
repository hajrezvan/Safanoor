import { COURSE_STATUS } from "@/lib/enums";
import { listReadingPlansForStudent } from "@/server/modules/books/service";
import { getCourseProgressForStudent, listCourses } from "@/server/modules/courses/service";
import { listSubmissionsForStudent } from "@/server/modules/exams/service";
import {
  getGrowthProfile,
  getStudentById,
  listAssignmentHistory,
  type StudentListItem,
} from "@/server/modules/students/service";

/**
 * تجمیع پرونده نیرو (دانش‌آموز) برای صفحه جزئیات staff/forces/[id]
 */
export function getForceDetail(studentId: string) {
  const student = getStudentById(studentId);
  if (!student) return undefined;

  const profile = getGrowthProfile(studentId);
  const history = listAssignmentHistory(studentId);
  const readingPlans = listReadingPlansForStudent(studentId);
  const examSubmissions = listSubmissionsForStudent(studentId);
  const courses = listCourses({ status: COURSE_STATUS.PUBLISHED }).map((c) => {
    const progress = getCourseProgressForStudent(studentId, c.id);
    return {
      id: c.id,
      title: c.title,
      lessonCount: c.lessonCount,
      progressPercent: progress?.progressPercent ?? 0,
    };
  });

  return {
    student,
    profile,
    history,
    readingPlans,
    examSubmissions,
    courses,
  };
}

export type ForceDetail = NonNullable<ReturnType<typeof getForceDetail>>;
export type { StudentListItem };
