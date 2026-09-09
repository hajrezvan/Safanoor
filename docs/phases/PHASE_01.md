# PHASE 01 — Auth / Roles / Permissions / Core Users

## خلاصه

چهار نقش با permission مرکزی، CRUD کاربران توسط Admin، و seed حساب‌های نمونه آماده شد.

## ساخته‌شده

- `src/server/authz/policy.ts` — PERMISSIONS، نقش‌ها، assertPermission
- `src/server/modules/users/service.ts` — list/create/update/password/toggle
- `src/server/actions/users.ts`
- صفحات: `/admin/users`، `/admin/users/new`، `/admin/users/[id]`
- ناوبری AdminShell + AppNav
- Seed: admin، mentor1، assistant1، student1
- تست‌های permission

## حساب‌های seed

| کاربر | رمز | نقش |
|-------|-----|-----|
| admin | Admin@1234 | مدیر |
| mentor1 | Mentor@1234 | مربی |
| assistant1 | Assist@1234 | کمک‌مربی |
| student1 | Student@1234 | دانش‌آموز |

## باقی‌مانده به فاز بعد

- صفحات دانش‌آموزان و پرونده رشد (Phase 2)
