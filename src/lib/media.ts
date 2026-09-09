/** Resolve stored media paths to a browser-safe URL. */
export function resolveMediaSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  return `/uploads/${trimmed}`;
}

export const DEFAULT_COURSE_COVER = "/covers/course-default.svg";
