/**
 * آپلود محلی ساده — فایل‌ها بیرون از `public` ذخیره می‌شوند تا در Docker روی volume بمانند
 * و از مسیر عمومی `/uploads/...` توسط route handler سرو شوند.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createId } from "@/lib/id";

export const UPLOAD_PUBLIC_PREFIX = "/uploads";

export const UPLOAD_FOLDERS = {
  COVERS: "covers",
  LESSONS: "lessons",
  EVIDENCE: "evidence",
} as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[keyof typeof UPLOAD_FOLDERS];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** پسوندهای مجاز؛ هر چیز دیگری رد می‌شود تا فایل اجرایی روی سرور ننشیند. */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
  ".mp3",
  ".m4a",
  ".ogg",
  ".mp4",
  ".webm",
  ".txt",
  ".md",
]);

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

export function getUploadRoot() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

export function getContentType(fileName: string) {
  return (
    CONTENT_TYPES[path.extname(fileName).toLowerCase()] ??
    "application/octet-stream"
  );
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * ذخیره فایل و بازگرداندن مسیر عمومی (`/uploads/<folder>/<id><ext>`).
 * ورودی خالی `null` برمی‌گرداند تا فرم‌های بدون فایل بدون شرط اضافی کار کنند.
 */
export async function saveUpload(
  file: File | null | undefined,
  folder: UploadFolder,
): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("حجم فایل بیش از ۲۰ مگابایت است.");
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadError("فرمت فایل مجاز نیست.");
  }

  const directory = path.join(
    /* turbopackIgnore: true */ getUploadRoot(),
    folder,
  );
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${createId()}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(
    path.join(/* turbopackIgnore: true */ directory, fileName),
    buffer,
  );

  return `${UPLOAD_PUBLIC_PREFIX}/${folder}/${fileName}`;
}

/** تبدیل مسیر عمومی به مسیر امن روی دیسک؛ خروج از ریشه آپلود مجاز نیست. */
export function resolveUploadPath(segments: string[]): string | null {
  const root = getUploadRoot();
  const target = path.resolve(root, ...segments);
  const normalizedRoot = path.resolve(/* turbopackIgnore: true */ root);

  if (
    target !== normalizedRoot &&
    !target.startsWith(normalizedRoot + path.sep)
  ) {
    return null;
  }
  return target;
}

export async function deleteUpload(publicPath: string | null | undefined) {
  if (!publicPath?.startsWith(`${UPLOAD_PUBLIC_PREFIX}/`)) return;

  const segments = publicPath.slice(UPLOAD_PUBLIC_PREFIX.length + 1).split("/");
  const target = resolveUploadPath(segments);
  if (!target) return;

  await fs.rm(target, { force: true });
}
