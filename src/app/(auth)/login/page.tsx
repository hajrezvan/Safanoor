import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(token);

  if (user) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-3xl font-bold tracking-tight text-[var(--brand)]">صفا نور</p>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          سامانه تربیتی نوجوانان
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
