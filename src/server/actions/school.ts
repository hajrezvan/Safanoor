"use server";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { recordAudit } from "@/server/modules/audit/service";
import { requireUser } from "@/server/auth/guards";
import { saveUpload, UPLOAD_FOLDERS } from "@/server/uploads";
import { createId, nowIso } from "@/lib/id";
import * as school from "@/server/modules/school/service";
import {
  createChapter,
  createLesson,
  upsertLessonContent,
} from "@/server/modules/courses/service";

export type SchoolState = { error?: string; success?: string; id?: string };
export async function schoolAction(
  _previous: SchoolState,
  form: FormData,
): Promise<SchoolState> {
  const actor = await requireUser();
  const text = (key: string) => String(form.get(key) ?? "").trim();
  const bool = (key: string) =>
    form.get(key) === "on" || form.get(key) === "true";
  const num = (key: string) => Number(text(key));
  const operation = text("operation");
  const title = () => z.string().min(2).max(255).parse(text("title"));
  const status = () => z.enum(["draft", "published"]).parse(text("status"));
  let resultId: string | undefined;
  try {
    switch (operation) {
      case "enroll":
        resultId = school.enroll(actor, text("courseId"), text("studentId"));
        break;
      case "complete":
        school.completeLesson(actor, text("lessonId"));
        break;
      case "lesson-view":
        school.trackLessonView(actor, text("lessonId"), text("sessionKey"));
        break;
      case "comment":
        school.addComment(actor, {
          courseId: text("courseId"),
          lessonId: text("lessonId"),
          parentId: text("parentId"),
          body: text("body"),
        });
        break;
      case "like":
        school.likeComment(actor, text("id"));
        break;
      case "start":
        resultId = school.startAttempt(actor, text("examId"));
        break;
      case "answers":
      case "finish": {
        const answers: Record<string, string> = {};
        for (const [key, value] of form.entries())
          if (key.startsWith("answer:")) answers[key.slice(7)] = String(value);
        school.saveAnswers(actor, text("attemptId"), answers);
        if (operation === "finish")
          school.finishAttempt(actor, text("attemptId"));
        break;
      }
      default: {
        school.manager(actor);
        const upload = async (
          name: string,
          target: string,
          kind: "image" | "audio" | "file",
        ) => {
          const file = form.get(name);
          if (!(file instanceof File) || !file.size) return;
          const allowed =
            kind === "image"
              ? /\.(png|jpe?g|webp|gif)$/i
              : kind === "audio"
                ? /\.(mp3|m4a|ogg)$/i
                : /\.(pdf|mp4|webm|mp3|m4a|ogg|txt|md|png|jpe?g|webp)$/i;
          if (!allowed.test(file.name))
            throw new Error("فرمت فایل برای این بخش مجاز نیست.");
          const uploaded = await saveUpload(
            file,
            kind === "image" ? UPLOAD_FOLDERS.COVERS : UPLOAD_FOLDERS.LESSONS,
          );
          if (uploaded) form.set(target, uploaded);
        };
        switch (operation) {
          case "enrollment-status":
            school.setEnrollmentStatus(actor, text("id"), text("status"));
            break;
          case "bank": {
            resultId = text("id") || createId("bank");
            db.insert(s.schoolBanks)
              .values({ id: resultId, title: title() })
              .onConflictDoUpdate({
                target: s.schoolBanks.id,
                set: { title: title() },
              })
              .run();
            break;
          }
          case "question":
            resultId = school.saveQuestion(actor, {
              id: text("id") || undefined,
              bankId: text("bankId"),
              prompt: text("prompt"),
              type: text("type"),
              options: ["A", "B", "C", "D"]
                .filter((k) => text(`option${k}`))
                .map((k) => ({ key: k, text: text(`option${k}`) })),
              answer: text("answer"),
              points: num("points"),
            });
            break;
          case "exam":
            resultId = school.saveExam(actor, {
              ...Object.fromEntries(form),
              shuffleQuestions: bool("shuffleQuestions"),
              shuffleOptions: bool("shuffleOptions"),
              showAnswers: bool("showAnswers"),
              releaseResults: bool("releaseResults"),
            });
            break;
          case "moderate": {
            const comment = db
              .select()
              .from(s.schoolComments)
              .where(eq(s.schoolComments.id, text("id")))
              .get();
            if (!comment) throw new Error("نظر یافت نشد.");
            db.update(s.schoolComments)
              .set({
                status: z
                  .enum(["approved", "rejected", "pending"])
                  .parse(text("status")),
              })
              .where(eq(s.schoolComments.id, comment.id))
              .run();
            break;
          }
          case "playlist": {
            await upload("cover", "coverPath", "image");
            resultId = text("id") || createId("pl");
            const data = {
              title: title(),
              description: text("description"),
              coverPath: school.safeUrl.parse(text("coverPath")),
              status: status(),
              ordering: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("ordering") || 0),
            };
            db.insert(s.schoolPlaylists)
              .values({ ...data, id: resultId })
              .onConflictDoUpdate({ target: s.schoolPlaylists.id, set: data })
              .run();
            break;
          }
          case "playlist-lesson": {
            const data = {
              playlistId: text("playlistId"),
              lessonId: text("lessonId"),
              ordering: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("ordering") || 0),
            };
            db.insert(s.schoolPlaylistLessons)
              .values({ ...data, id: createId("pll") })
              .onConflictDoUpdate({
                target: [
                  s.schoolPlaylistLessons.playlistId,
                  s.schoolPlaylistLessons.lessonId,
                ],
                set: { ordering: data.ordering },
              })
              .run();
            break;
          }
          case "playlist-remove":
            db.delete(s.schoolPlaylistLessons)
              .where(eq(s.schoolPlaylistLessons.id, text("id")))
              .run();
            break;
          case "banner": {
            await upload("imageFile", "image", "image");
            resultId = text("id") || createId("banner");
            const data = {
              title: title(),
              image: school.safeUrl.parse(text("image")),
              href: school.safeUrl.parse(text("href")),
              ordering: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("ordering") || 0),
            };
            if (!data.image) throw new Error("تصویر بنر الزامی است.");
            db.insert(s.schoolBanners)
              .values({ ...data, id: resultId })
              .onConflictDoUpdate({ target: s.schoolBanners.id, set: data })
              .run();
            break;
          }
          case "banner-remove":
            db.delete(s.schoolBanners)
              .where(eq(s.schoolBanners.id, text("id")))
              .run();
            break;
          case "course-settings": {
            const courseId = text("courseId");
            const parentId = text("parentCourseId");
            const course = db
              .select()
              .from(s.courses)
              .where(eq(s.courses.id, courseId))
              .get();
            if (!course) throw new Error("دوره یافت نشد.");
            if (
              parentId &&
              (parentId === courseId ||
                !db
                  .select()
                  .from(s.courses)
                  .where(
                    and(
                      eq(s.courses.id, parentId),
                      eq(s.courses.isGroup, true),
                    ),
                  )
                  .get())
            )
              throw new Error("گروه دوره معتبر نیست.");
            if (
              bool("isGroup") &&
              (parentId ||
                db
                  .select()
                  .from(s.lessons)
                  .where(eq(s.lessons.courseId, courseId))
                  .get())
            )
              throw new Error("گروه دوره نباید درس یا گروه والد داشته باشد.");
            db.update(s.courses)
              .set({
                isPublic: bool("isPublic"),
                issueCertificate: bool("issueCertificate"),
                parentCourseId: parentId || null,
                isGroup: bool("isGroup"),
              })
              .where(eq(s.courses.id, courseId))
              .run();
            break;
          }
          case "presenter":
            db.insert(s.schoolPresenters)
              .values({
                id: createId("presenter"),
                courseId: text("courseId"),
                name: title(),
                bio: text("bio"),
              })
              .run();
            break;
          case "presenter-remove":
            db.delete(s.schoolPresenters)
              .where(eq(s.schoolPresenters.id, text("id")))
              .run();
            break;
          case "attachment":
            await upload("attachmentFile", "url", "file");
            if (!text("url")) throw new Error("فایل یا آدرس پیوست الزامی است.");
            db.insert(s.schoolAttachments)
              .values({
                id: createId("attachment"),
                lessonId: text("lessonId"),
                title: title(),
                url: school.safeUrl.parse(text("url")),
              })
              .run();
            break;
          case "attachment-remove":
            db.delete(s.schoolAttachments)
              .where(eq(s.schoolAttachments.id, text("id")))
              .run();
            break;
          case "chapter": {
            const courseId = text("courseId");
            const data = {
              title: title(),
              ordering: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("ordering") || 0),
              status: status(),
            };
            if (text("id"))
              db.update(s.courseChapters)
                .set(data)
                .where(
                  and(
                    eq(s.courseChapters.id, text("id")),
                    eq(s.courseChapters.courseId, courseId),
                  ),
                )
                .run();
            else {
              const row = createChapter({ ...data, courseId });
              db.update(s.courseChapters)
                .set({ status: data.status })
                .where(eq(s.courseChapters.id, row.id))
                .run();
            }
            break;
          }
          case "lesson": {
            await upload("contentFile", "filePath", "file");
            await upload("audioFile", "audioUrl", "audio");
            let courseId = text("courseId");
            if (courseId === "__standalone") {
              courseId = "school_standalone";
              db.insert(s.courses)
                .values({
                  id: courseId,
                  title: "درس‌های مستقل",
                  status: "published",
                  ordering: 0,
                  createdAt: nowIso(),
                  isPublic: true,
                  isStandaloneCollection: true,
                  issueCertificate: false,
                })
                .onConflictDoNothing()
                .run();
            }
            const chapterId = text("chapterId");
            if (
              chapterId &&
              !db
                .select()
                .from(s.courseChapters)
                .where(
                  and(
                    eq(s.courseChapters.id, chapterId),
                    eq(s.courseChapters.courseId, courseId),
                  ),
                )
                .get()
            )
              throw new Error("فصل متعلق به دوره نیست.");
            const course = db
              .select()
              .from(s.courses)
              .where(eq(s.courses.id, courseId))
              .get();
            if (!course || course.isGroup)
              throw new Error("یک دوره آموزشی انتخاب کنید.");
            const data = {
              courseId,
              chapterId: chapterId || null,
              title: title(),
              description: text("description"),
              contentType: z
                .enum([
                  "TEXT",
                  "VIDEO",
                  "AUDIO",
                  "PDF",
                  "FILE",
                  "LINK",
                  "APARAT",
                ])
                .parse(text("contentType")),
              ordering: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("ordering") || 0),
              status: status(),
              durationMinutes: z.coerce
                .number()
                .int()
                .min(0)
                .parse(text("durationMinutes") || 0),
              audioUrl: school.safeUrl.parse(text("audioUrl")),
              isPreview: bool("isPreview"),
            };
            const content = {
              body: text("body"),
              url: school.safeUrl.parse(text("url")),
              filePath: school.safeUrl.parse(text("filePath")),
            };
            db.transaction(() => {
              const existing = text("id")
                ? db
                    .select()
                    .from(s.lessons)
                    .where(eq(s.lessons.id, text("id")))
                    .get()
                : null;
              if (text("id") && (!existing || existing.courseId !== courseId))
                throw new Error("درس معتبر نیست.");
              resultId =
                existing?.id ??
                createLesson({ ...data, chapterId: chapterId || "" }).id;
              db.update(s.lessons)
                .set(data)
                .where(eq(s.lessons.id, resultId!))
                .run();
              upsertLessonContent({ lessonId: resultId!, ...content });
            });
            break;
          }
          case "revoke": {
            const certificate = db
              .select()
              .from(s.schoolCertificates)
              .where(eq(s.schoolCertificates.id, text("id")))
              .get();
            const joined =
              certificate &&
              db
                .select()
                .from(s.schoolEnrollments)
                .where(eq(s.schoolEnrollments.id, certificate.enrollmentId))
                .get();
            if (!joined) throw new Error("گواهی یافت نشد.");
            school.assertStudentScope(actor, joined.studentId);
            db.update(s.schoolCertificates)
              .set({ revoked: true })
              .where(eq(s.schoolCertificates.id, text("id")))
              .run();
            break;
          }
          default:
            throw new Error("عملیات ناشناخته است.");
        }
      }
    }
    recordAudit({
      actorUserId: actor.id,
      entityType: "school",
      entityId:
        resultId ||
        text("id") ||
        text("courseId") ||
        text("attemptId") ||
        "school",
      action: operation,
    });
    revalidatePath("/staff/school", "layout");
    revalidatePath("/staff/classes", "layout");
    revalidatePath("/student/school", "layout");
    return { success: "ذخیره شد.", id: resultId };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? "اطلاعات فرم معتبر نیست؛ فیلدها را بررسی کنید."
          : error instanceof Error && !error.message.includes("SQLITE")
            ? error.message
            : "ذخیره انجام نشد؛ ارتباط اطلاعات انتخاب‌شده را بررسی کنید.",
    };
  }
}
