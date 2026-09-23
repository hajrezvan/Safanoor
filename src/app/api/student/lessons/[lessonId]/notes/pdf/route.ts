import { NextResponse } from "next/server";
import { ROLE_KEYS } from "@/lib/enums";
import { requireRole } from "@/server/auth/guards";
import { getLessonById } from "@/server/modules/courses/service";
import { buildLessonNotePdf } from "@/server/modules/lesson-notes/pdf";
import { getLessonNoteForStudent } from "@/server/modules/lesson-notes/service";
import { getStudentByUserId } from "@/server/modules/students/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const actor = await requireRole(ROLE_KEYS.STUDENT);
    const student = getStudentByUserId(actor.id);
    if (!student) {
      return new NextResponse("پرونده دانش‌آموزی یافت نشد.", { status: 403 });
    }

    const { lessonId } = await params;
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      return new NextResponse("درس یافت نشد.", { status: 404 });
    }

    const { lessonAccess } = await import("@/server/modules/school/service");
    lessonAccess(student.id, lessonId);
    const note = getLessonNoteForStudent(student.id, lessonId);
    const pdf = await buildLessonNotePdf({
      lessonTitle: lesson.title,
      body: note?.body ?? "",
    });

    const safeName = encodeURIComponent(`جزوه-${lesson.title}.pdf`);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
