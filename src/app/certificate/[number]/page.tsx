import { notFound } from "next/navigation";
import { certificateByNumber } from "@/server/modules/school/service";
import { PrintCertificate } from "@/components/school/print-button";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Certificate({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const certificate = certificateByNumber(number);
  if (!certificate) notFound();
  return (
    <main dir="rtl" className="mx-auto my-10 max-w-4xl px-5 text-center">
      <article className="rounded-3xl border-8 border-double border-teal-800 bg-white px-8 py-16 text-slate-800">
        <p className="text-sm tracking-widest">سامانه تربیتی صفا نور</p>
        <h1 className="my-8 text-4xl font-bold text-teal-900">
          گواهینامه پایان دوره
        </h1>
        <p className="leading-10">گواهی می‌شود</p>
        <p className="my-3 text-2xl font-bold">{certificate.studentName}</p>
        <p className="leading-10">
          دوره آموزشی «{certificate.courseTitle}» را با موفقیت به پایان رسانده
          است.
        </p>
        <p className="mt-10 text-sm">
          تاریخ صدور:{" "}
          {new Date(certificate.issuedAt).toLocaleDateString("fa-IR")}
        </p>
        <p className="mt-3 break-all text-xs" dir="ltr">
          {certificate.number}
        </p>
        <p className="mt-4 text-xs text-teal-800">
          این گواهینامه در سامانه صفا نور معتبر است.
        </p>
      </article>
      <PrintCertificate />
    </main>
  );
}
