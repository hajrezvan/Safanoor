import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { getContentType, resolveUploadPath } from "@/server/uploads";

export const runtime = "nodejs";

/** فایل‌های آپلودشده فقط برای کاربران واردشده سرو می‌شوند. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ segments: string[] }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { segments } = await params;
  const target = resolveUploadPath(segments);
  if (!target) return new NextResponse("Not found", { status: 404 });

  try {
    const file = await fs.readFile(target);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": getContentType(path.basename(target)),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
