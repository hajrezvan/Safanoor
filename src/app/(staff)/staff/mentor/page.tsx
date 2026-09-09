import { redirect } from "next/navigation";

/** مسیر قدیمی داشبورد مربی → پنل یکپارچه staff */
export default function MentorRootRedirect() {
  redirect("/staff");
}
