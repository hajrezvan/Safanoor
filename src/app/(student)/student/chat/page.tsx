import { redirect } from "next/navigation";

export const runtime = "nodejs";

/** مسیر قدیمی؛ به پیامرسان هدایت می‌شود (هم‌راستا با redirect در next.config) */
export default function StudentChatPage() {
  redirect("/student/messenger");
}
