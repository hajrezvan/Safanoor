# Assistant workspace and evening presentation

Plan: add an isolated, repeatable presentation seed for six fictional members each in Safa 27 and 33, with MJ-authored conversations and consultations. Extend the existing apps, generated API and UI components with an assistant workspace: paginated assigned roster, recorded attendance, dated follow-ups/tasks, camp responsibilities and logged emergency cards. Add database migrations, central policy rows, API isolation tests and 390/1440 light/dark screenshots.

Scope: assignments remain mentor-owned. Assistants see only assigned members in their selected group. Task cards here are follow-up work items, not a replacement for the future project module. Attendance percentages use recorded group sessions only; unmarked attendance is shown as unknown, not absence. Confidential emergency content requires a reason, authorization and audit and is never included in the dashboard. Demo people are explicitly labelled «نمایشی», with no national IDs or real confidential details. No director role is assigned.

Implemented:
- `seed:evening-demo`: 12 fictional people (six in each group), 24 MJ-authored shared consultations, 12 direct threads / 60 messages, attendance and operational follow-up fixtures. Existing accounts, passwords and real memberships are preserved. Every fixture has a stable `81000000` namespace; repeat runs insert nothing twice. All six Safa 27 demo members follow MJ. Existing assignments are preserved.
- `/assistant/*`: selected-role capability, paginated roster, search, 90-day recorded attendance, open/completed operational tasks and follow-ups, workload counts, mentor availability, and upcoming personally assigned camp duties.
- Mentor creates dated attendance programs; assistants mark only assigned members after the program starts. Responsible assistants edit their own camp duty title/day within the open camp's dates. These one-off attendance programs do not implement the future recurring schedule / RSVP / conflict engine.
- Emergency cards: explicit reason, current membership/assignment policy, encrypted optional content, no-store response, immutable audit plus emergency log and mentor notification. Empty contacts/address/medical data are displayed honestly. The demo uses a synthetic explanation rather than a real contact or confidential personal content.
- Due reminders: existing worker's notification job, idempotent per work item/current assistant, current assignment and membership rechecked. A new assistant gets his own reminder; completed items generate none.
- Multi-role privacy correction: assistant private notes use the author's role in the consultation's group, and only that group's mentor reads them. The role is stored as an immutable snapshot so later promotion or ownership changes cannot reclassify old notes. Selected-role group scope also applies to shared consultation lists and direct reads of consultations/chat/work items.

Product limits carried forward: operational follow-up tasks are not project tasks. The full project workflow, recurring weekly schedule/conflicts/RSVP, per-day camp attendance and emergency-profile editing/print/export remain separate roadmap work; this change must not be described as completing those modules.

Validation completed:
- API/UI strict typechecks and lint of all changed TypeScript/TSX files pass.
- 462 unit tests and 48 PostgreSQL integration tests pass, including fresh migrations, repeatable seeds, selected-role denials, current assignment revocation, nullable/unassigned camp duty denial, encrypted emergency data/logging, immutable note-role snapshots and deduplicated reminders.
- Two real-browser scenarios pass: full assistant workflows plus MJ mentor's populated consultations/chats. The assistant screenshots at 390/1440 px in light/dark have been visually inspected; no horizontal overflow or untranslated interpolation placeholders.
- Three targeted UI checks pass for tokens/contrast, protected offline cache and browser token storage. The repository's previously documented global design-contract debt is outside this change; the new assistant screen uses no ad hoc MUI/style literals.
- Local migrations and `seed:evening-demo` applied; seed ran twice without duplicate fixtures. API, UI and worker restarted. Live fixture counts: 12 people, 24 consultations, 12 threads and 60 messages; assigned directors remain zero.

Presentation: use محمدجواد رضوانیان's existing account, select «صفا ۳۳ - مربی» for the member/consultation/chat demo and «صفا ۲۷ - کمک‌مربی» for the new home workspace or mobile «گروه من». Seed does not create or change login credentials.
