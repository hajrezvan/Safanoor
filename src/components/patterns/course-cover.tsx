import { DEFAULT_COURSE_COVER, resolveMediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

export function CourseCover({
  coverPath,
  title,
  className,
  imgClassName,
}: {
  coverPath?: string | null;
  title?: string;
  className?: string;
  imgClassName?: string;
}) {
  const src = resolveMediaSrc(coverPath) ?? DEFAULT_COURSE_COVER;

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[linear-gradient(135deg,#0f766e_0%,#0d9488_55%,#14b8a6_100%)]",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title ? `کاور ${title}` : ""}
        className={cn("size-full object-cover", imgClassName)}
      />
    </div>
  );
}
