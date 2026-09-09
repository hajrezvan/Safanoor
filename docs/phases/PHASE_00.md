# PHASE 00 — Project Setup

## خلاصه

اسکلت Monolith با Next.js 16، SQLite/WAL، RTL، Auth skeleton، و Docker واحد آماده شد.

## ساخته‌شده

- `STACK_DECISIONS.md`، `OPEN_QUESTIONS.md`، `TASKS.md`
- اسکلت Next.js App Router + TypeScript + Tailwind v4
- Design system پایه (پالت آرام سبز-زیتونی OKLCH، Vazirmatn، patternها)
- Drizzle schema اولیه: users / sessions / roles / permissions / role_permissions
- Migration: `drizzle/0000_phase0_auth.sql`
- Auth: argon2id، session cookie، login/logout، requireUser/requireRole
- صفحات اسکلت: `/login`، `/admin`، `/staff/mentor`، `/staff/assistant`، `/student`
- Seed: کاربر `admin` / `Admin@1234`
- Dockerfile + docker-compose با volume `/data`
- Vitest smoke tests
- README

## تغییرات دیتابیس

جداول auth اولیه با WAL و foreign_keys.

## API / Server

- Server Actions: `loginAction`، `logoutAction`
- Guards: `requireUser`، `requireRole`

## UI

- RTL ریشه (`dir="rtl" lang="fa"`)
- Login + داشبوردهای اسکلت چهار نقش با EmptyState

## تست‌ها

- هش رمز، policy نقش، smoke migration

## تصمیم‌های معماری

طبق `STACK_DECISIONS.md`؛ جابجایی Phase 4/5 در `TASKS.md`.

Docker: ایمیج runtime از standalone میزبان + rebuild `better-sqlite3` برای Linux؛ تأیید شده با `docker run` و HTTP 200 روی `/login` (RTL فارسی).

## باقی‌مانده

- تکمیل CRUD کاربران و permissionهای غنی (Phase 1)
- دامنه دانش‌آموز و پرونده رشد (Phase 2)
