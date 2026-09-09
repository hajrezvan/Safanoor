import { LESSON_CONTENT_TYPE } from "@/lib/enums";

function aparatEmbedUrl(raw: string) {
  try {
    const u = new URL(raw);
    // https://www.aparat.com/v/VIDEO_ID → https://www.aparat.com/video/video/embed/videohash/VIDEO_ID/vt/frame
    const match = u.pathname.match(/\/v\/([^/]+)/);
    if (match?.[1]) {
      return `https://www.aparat.com/video/video/embed/videohash/${match[1]}/vt/frame`;
    }
    if (u.hostname.includes("aparat.com") && u.pathname.includes("embed")) {
      return raw;
    }
  } catch {
    /* keep raw */
  }
  return raw;
}

function resolveAssetSrc(src: string) {
  return src.startsWith("/") || src.startsWith("http") ? src : `/uploads/${src}`;
}

export function LessonMedia({
  contentType,
  body,
  url,
  filePath,
  title,
  /** When true, skip rendering body text (body belongs in the content tab). */
  mediaOnly = false,
}: {
  contentType: string;
  body?: string | null;
  url?: string | null;
  filePath?: string | null;
  title?: string;
  mediaOnly?: boolean;
}) {
  const src = url || filePath || "";

  if (contentType === LESSON_CONTENT_TYPE.APARAT && src) {
    return (
      <div className="overflow-hidden rounded-2xl bg-zinc-900 aspect-video">
        <iframe
          title={title ?? "ویدیو آپارات"}
          src={aparatEmbedUrl(src)}
          className="h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
    );
  }

  if (contentType === LESSON_CONTENT_TYPE.PDF && src) {
    const pdfSrc = resolveAssetSrc(src);
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--muted)]">
        <object data={pdfSrc} type="application/pdf" className="h-[70vh] w-full">
          <iframe title={title ?? "PDF"} src={pdfSrc} className="h-[70vh] w-full" />
          <p className="p-4 text-sm">
            نمایش PDF پشتیبانی نمی‌شود.{" "}
            <a href={pdfSrc} className="text-[var(--brand)] underline" target="_blank" rel="noreferrer">
              دانلود فایل
            </a>
          </p>
        </object>
      </div>
    );
  }

  if (contentType === LESSON_CONTENT_TYPE.AUDIO && src) {
    const audioSrc = resolveAssetSrc(src);
    return (
      <div className="rounded-2xl bg-zinc-900 px-4 py-8">
        <audio controls className="w-full" src={audioSrc}>
          مرورگر شما از پخش صوت پشتیبانی نمی‌کند.
        </audio>
      </div>
    );
  }

  if (contentType === LESSON_CONTENT_TYPE.VIDEO && src) {
    const videoSrc = resolveAssetSrc(src);
    return (
      <div className="overflow-hidden rounded-2xl bg-zinc-900">
        <video controls className="w-full" src={videoSrc}>
          مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
        </video>
      </div>
    );
  }

  if (contentType === LESSON_CONTENT_TYPE.LINK && src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-900 px-4">
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--brand)]"
        >
          باز کردن پیوند
        </a>
      </div>
    );
  }

  if (contentType === LESSON_CONTENT_TYPE.FILE && src) {
    const fileSrc = resolveAssetSrc(src);
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-900 px-4">
        <a
          href={fileSrc}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--brand)]"
        >
          دانلود فایل
        </a>
      </div>
    );
  }

  if (mediaOnly) {
    return (
      <div
        className="aspect-video rounded-2xl bg-zinc-800"
        role="img"
        aria-label="بدون رسانه تصویری"
      />
    );
  }

  if (body) {
    return (
      <div className="prose prose-sm max-w-none rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 leading-8 whitespace-pre-wrap">
        {body}
      </div>
    );
  }

  return (
    <p className="text-sm text-[var(--muted-foreground)]">محتوایی برای این درس ثبت نشده است.</p>
  );
}
