import type { AuthUser } from "@/server/auth/session";
import { commentsFor } from "@/server/modules/school/service";
import { SchoolForm } from "./form";
import { Panel } from "./shared";
import { toFaDigits } from "@/lib/digits";
export function SchoolComments({
  actor,
  courseId,
  lessonId,
}: {
  actor: AuthUser;
  courseId: string;
  lessonId?: string;
}) {
  const comments = commentsFor(actor, courseId, lessonId);
  return (
    <Panel title="گفت‌وگو و پرسش‌ها">
      <div className="mb-5 space-y-3">
        {comments.map((c) => (
          <article
            className={`rounded-xl bg-[var(--muted)] p-4 ${c.parentId ? "ms-5 border-s-2 border-[var(--brand)]" : ""}`}
            key={c.id}
          >
            <p className="mb-2 text-xs font-bold">
              {c.author}
              {c.status !== "approved" ? " · در انتظار تأیید مربی" : ""}
            </p>
            {c.parentId && (
              <p className="mb-1 text-xs text-[var(--muted-foreground)]">
                در پاسخ به:{" "}
                {comments
                  .find((p) => p.id === c.parentId)
                  ?.body.slice(0, 100) ?? "نظر قبلی"}
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm leading-7">{c.body}</p>
            {c.status === "approved" && (
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <SchoolForm
                  operation="like"
                  hidden={{ id: c.id }}
                  submit={`پسندیدن · ${toFaDigits(c.likes)}`}
                />
                <details className="flex-1 text-sm">
                  <summary className="cursor-pointer py-2">پاسخ</summary>
                  <SchoolForm
                    operation="comment"
                    hidden={{
                      courseId,
                      lessonId: lessonId ?? "",
                      parentId: c.id,
                    }}
                    fields={[
                      {
                        name: "body",
                        label: "پاسخ شما",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                    submit="ارسال پاسخ"
                  />
                </details>
              </div>
            )}
          </article>
        ))}
      </div>
      <SchoolForm
        operation="comment"
        hidden={{ courseId, lessonId: lessonId ?? "" }}
        fields={[
          {
            name: "body",
            label: "نظر یا پرسش شما",
            type: "textarea",
            required: true,
          },
        ]}
        submit="ارسال برای بررسی"
      />
    </Panel>
  );
}
