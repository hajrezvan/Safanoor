import { redirect } from "next/navigation";

/** مسیر قدیمی داشبورد کمک‌مربی → پنل یکپارچه staff */
export default function AssistantRootRedirect() {
  redirect("/staff");
}
