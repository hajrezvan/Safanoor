# AGENTS.md: Smart Safa Mosque platform

This file is the single source of truth for building the platform. If anything else (a template README, a code comment, a chat message) conflicts with this file, this file wins. Persian terms appear in parentheses where the domain word matters.

How to start: read this whole file, read both provided templates completely (the NestJS backend and the Next.js + MUI frontend), then implement Phase 1 (section 12). Do the phases in order.

---

## 1. Goal and context

Build a web platform that makes the in-person work of a mosque youth-mentoring organization easier. It does NOT virtualize in-person activities; it removes friction from them: scheduling, attendance, camps (اردو), money, consultations (مشاوره), projects, meeting minutes, photos and class recordings.

Members are children, teenagers and university students. Many are under 18. Privacy and access control are the core of the product, not an add-on. When a rule is unclear, choose the most restrictive behaviour and record the question in `docs/OPEN_QUESTIONS.md`.

## 2. How to work

- Read both templates first. Extend them; do not re-scaffold them or swap their core libraries unless this spec requires it. Record every deviation in `docs/ARCHITECTURE.md`.
- Work phase by phase (section 12). Do not start a phase before the previous one passes typecheck, lint, tests and the seed script, and is committed (one commit per phase at least).
- At the start of each phase write a short plan (files, tables, endpoints, tests). At the end update `docs/ARCHITECTURE.md` and `docs/ACCESS_POLICY.md`.
- Never invent product rules. Ambiguity goes to `docs/OPEN_QUESTIONS.md`; pick the most restrictive option and continue.
- Every backend endpoint and query that touches protected data must go through the central `can()` function (section 6). An endpoint without a policy test is not done.
- Keep the code boring and readable: TypeScript strict, small modules, no clever abstractions.

## 3. Architecture and tech stack

- **Two applications, one contract.** Backend: complete the provided NestJS template. Frontend: complete the provided Next.js (App Router) + MUI template. Keep their conventions (folder layout, lint rules, package manager, scripts, ORM, validation style).
- **Backend (NestJS, TypeScript strict).** One module per domain (people, groups, access, schedule, camps, finance, consultations, projects, meetings, lms, album, retention, notifications, files, audit, imports). Thin controllers, business logic in services, a global policy guard and decorator that calls `can()`, DTO validation (follow the template), versioned REST API under `/api/v1`, OpenAPI via `@nestjs/swagger`, one error format, pagination everywhere.
- **Database.** PostgreSQL with migrations that apply from scratch. Use the ORM already in the template; if none, Prisma or Drizzle. Use recursive CTEs or a closure table for the hierarchy.
- **Background work.** A separate worker entrypoint (Nest standalone application) with a Postgres-backed queue (pg-boss; BullMQ only if the template already uses Redis): audio splitting and compression (ffmpeg), PDF generation, retention purges, notification fan-out, the nightly age-18 job, bulk import processing.
- **Storage.** S3-compatible storage behind an interface, local adapter for development. Short-lived signed URLs. Published LMS audio is served through a CDN-friendly route.
- **Authentication.** Short-lived access token plus rotating refresh token (stored hashed), argon2 password hashing, behind a provider interface so an OTP provider can be added later. The web app uses httpOnly Secure cookies with CSRF protection; a future mobile app uses the same endpoints with bearer tokens. Rate limiting and lockout.
- **The API is the contract.** It is the only way to read or write data, for the web app now and a native app later. The frontend uses a typed client generated from the OpenAPI spec (openapi-typescript or orval), regenerated in CI. If the two templates live in one monorepo, put shared Zod schemas and types in `packages/shared`; otherwise rely on the generated client only.
- **Frontend (Next.js + MUI).** TypeScript strict, TanStack Query, React Hook Form + Zod. No business or access logic in the frontend, and none in Next.js server actions or route handlers. It renders what the API returns and shows or hides actions from capability flags returned by the API. Redaction of protected fields is always done by the backend.
- **MUI setup.** Full RTL (emotion cache with a stylis RTL plugin, theme direction rtl, `dir=rtl` on html), Vazirmatn font, MUI X date pickers with a Jalali adapter. Only free (MIT) MUI packages, no Pro or Premium features. Build a fully custom theme (palette, shape, typography, component overrides) so it does not look like stock Material; keep design tokens in one file.
- **Two experiences in one frontend.** The member app: mobile-first, bottom navigation, large touch targets, friendly modern look for teenagers, installable PWA (manifest, service worker, offline shell). And `/admin`: desktop-first tables and forms for the technical manager and for mentors' management screens.
- **Dev environment.** A Dockerfile per app and a docker-compose file (Postgres, storage emulator, backend, worker, frontend); environment-based configuration. Serve web and API under the same parent domain through a reverse proxy to keep cookies simple and avoid CORS problems.
- **Mobile readiness.** Every endpoint must work for a native client: pagination, resumable chunked uploads, no cookie-only assumptions. A native app (likely React Native with Expo) will be built later on this same API.

## 4. Language, calendar, locale

- All UI strings in Persian (fa-IR), RTL layout, Vazirmatn font, behind an i18n layer; never hard-code strings.
- Store dates in UTC / Gregorian; display and input in the Jalali (Solar Hijri) calendar. The week starts on Saturday. One single date utility handles conversion and age calculation and is used everywhere.
- Money is an integer in one fixed unit (configurable constant, default toman). Never floats for money.
- Iranian national ID: validate with the standard check-digit algorithm.
- Search normalizes Persian text (Arabic ya and kaf to Persian, half-space, diacritics, digits).

## 5. Organization model

Levels: **supervisor** (ناظر, exactly 5 people, nobody above them) > **head mentor** (سرمربی, usually 2 or 3 mentors under each) > **mentor** (مربی, around 6 assistants and around 40 members) > **assistant** (کمک‌مربی, follows a subset of the mentor's members, around 8 to 10) > **member** (نیرو).

- Roles belong to relationships, not people. Everyone except the 5 supervisors is a member of someone else's group. An assistant is both `member` and `assistant` in his mentor's group (two membership rows) and may also own another group as a mentor if qualified.
- Every person has exactly one active `member` membership (except supervisors); it defines his direct mentor.
- A mentor or assistant with open assignments cannot be deactivated until his members are reassigned.
- A mentor has an availability flag (available / unavailable). While unavailable, the assistant who follows a given member is the responder for that member: urgent notifications and emergency access go to him as well.
- Assignment of members to assistants is data (history kept), with no fixed ratio or cap.
- Some activities involve several groups (joint camps, joint events), so events and photos can belong to more than one group.

## 6. Access control (most important part)

Implement one function `can(user, action, resource)` backed by:

- `access_policy` table: resource_type, owner_role, viewer_relation, level (none | summary | detail). Rules live in data, not scattered if-statements.
- `access_grant` table: resource_type, resource_id, grantee_person_id, granted_by, granted_at, revoked_at, reason. One mechanism for all referrals (see below). Grants are revocable and logged.
- `audit_log` (reads of confidential data, PDF prints, identity-field changes, grants, deletions, admin actions) and `emergency_access_log`.

Enforce at API and query level so protected fields never reach the browser; redact on the server. Use Postgres Row Level Security on the most sensitive tables if practical. Default is deny.

**Rules already decided by the organization (implement as policy rows):**

1. **Consultation private notes.** An assistant's private note: visible to him and his mentor. A mentor's private note: visible only to him. Head mentors and supervisors never see private notes.
2. **Private schedule blocks.** For a member: only his own mentor sees details. For an assistant: his mentor and his head mentor. Everyone else with schedule access sees only a busy-private block. Private blocks still count in conflict detection and common-free-time suggestions. A mentor is a member of a higher mentor, so the member rule applies to him.
3. **Non-private schedules** are visible to the whole chain above a person.
4. **Meetings.** Access = attendees + all ancestors of every attendee, for public and private meetings alike (private only changes who attends).
5. **Album photos.** Visible to members of every attached group, plus their assistants, mentors, head mentors and supervisors; unrelated people cannot see them. Only the host group's mentor edits or deletes; another group's mentor can hide a photo from his own group.
6. **Finance.** Fund balance and deposits: only the group's mentor and its finance officer. The transparency report (expenses only; no fund balance, no donors, no personal debts, no receipts) is visible to everyone inside the organization across all groups, but not to parents.
7. **Parents** see only: the final per-person camp price, their own child's payment status, the camp notice, consent forms, notifications, any consultation summary the mentor explicitly released to them, and the total spent on a camp after settlement.
8. **Emergency data** (exact address, optional medical notes): hidden by default for everyone. The member's mentor can open it at any time with one tap plus a reason code; always logged, and the mentor is notified when someone else opens it. Assistants can open it with the emergency action. A camp lead can open it only for participants of his camp and only on camp days.
9. **System administrator** (technical manager) has no access to notes, medical data, exact addresses or private blocks by default. Any exception is a logged break-glass action. (Default assumption; also listed in open questions.)
10. **Superiors** (head mentor, supervisor) see aggregates and public content only, never private notes.

**Referrals (grants).** Only the member's mentor issues them. Allowed: a member's confidential file to a supervisor; a member's confidential notes to a new assistant after reassignment (by default a new assistant sees only shared summaries); one consultation summary to the member's parent. All revocable and logged.

---

## 7. Module specifications

### 7.1 People, profile, emergency, parents, consent

- `person` holds names, father's name, birth date, national ID (encrypted + HMAC hash for uniqueness, masked in the UI), phone, org level, availability, status (active | left | purged).
- **Under-18 profile:** siblings count, birth order, parents' jobs and education (entered by the parent, optional with a prefer-not-to-say choice), school name, GPA by year, neighborhood, street note, exact address (encrypted, sealed), emergency phone, parents' phones, own phone, optional medical notes (encrypted).
- **18+ profile:** last degree, university, field, current job, job history, books read, interests and skills (tags from an extendable list), monthly time-use self report (hours per category; also computed from schedule block categories).
- Collect data in layers over time, not in one giant form. Identity fields are filled by the person (or the parent) and marked verified by the mentor; changes to identity fields are audited.
- **Emergency card:** one summary screen per person (name, age, emergency phone, parents' phones; exact address and medical notes only through the emergency action of rule 8). A printable emergency-card list for a camp lead (logged, intended to be destroyed after the camp).
- **Parent panel** exists only for people under 18. A nightly job deactivates it at 18, archives the parent link, notifies the person and the parent 30 days before, and requires the person to accept consent again. The parent link is confirmed by the mentor; one parent can have several children.
- **Consent:** at first login show versioned consent items: use of the system, data retention, public publishing of photos and audio, and "the mentor may release a consultation summary to your parent and you will be told". Store `consent_record` (signer is the parent for minors). If a person declines public publishing, the rest of the system still works for him and his photos or voice are never published.

### 7.2 Weekly schedule and attendance

- `busy_block`: weekday, start, end, category (skill, study, job, family, social media, ...), label, is_private, valid_from, valid_to (term-based).
- `event` (type program | class | meeting | camp | project_event) with a host group and `event_group` for participating groups; `event_occurrence` for dated instances (cancel or move one week only); recurrence rules. A mentor creates group programs; an assistant can create them with the mentor's permission.
- `rsvp` (yes | no | late, reason, location option, free text for "Other") is separate from `attendance` (actual presence marked by an assistant in seconds from a checklist). `location_option` is an editable list plus "Other".
- Conflict detection between events and busy blocks (private blocks included, details redacted), plus a common-free-time suggestion when defining a group program.
- Reminders are in-app notifications only.

### 7.3 Camps (including joint camps)

- Lifecycle: draft > permit_pending > permit_ok > registration > running > finished > settled.
- **Joint camps:** one organizer (camp lead / مسئول اردو) and a list of participating groups declared in the permit. Each participating group submits its own participant list (`camp_group_request`, status pending or submitted, visible to the organizer). One person collects signatures.
- **Permit:** generate a PDF from a fixed template (name, father's name, birth date, national ID) for the selected participants of all groups. Show a missing-data list first and validate national IDs. Never store the generated PDF permanently; log every print. The signed paper is uploaded as one photo; uploading it marks the permit obtained (the semi-automated approval process is out of scope for now; keep a status field so steps can be added later). Registration cannot open before the permit photo exists.
- **Costs:** itemized `cost_item` lines (what each cost is for) visible to mentors; parents see only the final per-person price. Each participant has charges and payments; each person sees his own debt and its reasons in his panel. Each group's mentor (or finance officer) collects his own people's money and hands it to the camp lead (see finance, hand-over).
- **Multi-day:** one `camp_day_attendance` row per participant per day, default present, editable during the camp (a person may be present day 1, absent days 2 and 3, back on day 4).
- **Conflicts:** before the camp the mentor sees a list of participants with schedule conflicts per day and can mark each as resolvable with a note.
- **Schedule:** editable only by the mentor and the camp's responsible assistant; viewable by assistants of all participating groups; hidden from members until the camp ends. Members get a separate **participant notice** (meeting time, place, items to bring).
- **Settlement:** after the camp compute surplus or deficit. Surplus is split among groups proportionally to participant counts (editable before approval); first repay open mentor claims, then deposit the rest into the group fund. A deficit is paid by each group's mentor out of pocket and becomes a mentor claim; when the same group creates its next camp, suggest an explicit cost line for recovering it, shown separately in the internal breakdown and in the transparency report. A camp is not closed until it is settled.

### 7.4 Finance

- Money moves between wallets: `wallet` (types member_debt, mentor_personal, fund, camp_pool; custodian for funds) and an append-only `ledger_entry` (from, to, integer amount, date, category, destination camp | project | general, public description, internal description, receipt file, recorded_by, confirmed_by, reverses_entry_id). Corrections are reversing entries, never edits.
- **Hand-over:** when a mentor hands collected money to the camp lead, the sender records it and the receiver confirms it; unconfirmed money shows as in transit.
- A mentor usually pays out of pocket first; that creates a mentor claim, repaid when members settle.
- Each group may have zero or more funds (leftover camp money, voluntary monthly contributions). Deposits have a source and an optional donor name. One assistant per group is the finance officer (a `group_role`); he records transactions and the mentor sees and confirms.
- Budget vs actual per camp and project. Mentor dashboard: my claim from the group, open member debts per camp, fund balances. Export to Excel and PDF.
- Cross-group transparency report: expenses only, with cost per participant by category, filters by group and event type, and a "copy cost items from a previous camp" feature (copies categories and amounts only). Public descriptions are optional and default empty; internal descriptions never appear in reports. No ranking of groups.
- Audit every finance write.

### 7.5 Consultations

- `consultation`: member, author, date, kind, shared summary (the member sees it), follow-up text and date (creates a reminder). Summary edits keep versions. Show a fixed reminder above the summary field: the member can read this.
- `consultation_private_note` is a separate table and endpoint and is never returned with the shared summary.
- **Release to a parent:** only the mentor, per consultation, through a grant; optionally a separate parent-facing message instead of the original text. The child gets an in-app notification and a permanent label on that summary ("visible to your parent"); revoking informs the child.
- Per-member timeline with search. No audio recording or AI summarization for consultations.

### 7.6 Projects

- `project` (owner, groups, finance destination, due date, optional link to a camp or event), `task` (assigned, in_progress, submitted, approved, needs_revision), `task_assignee`, `task_report` (versioned; private by default, the author may share it with project members), `report_feedback` (visible only to the author and the person following him up).
- All project members see everyone's participation and status; `needs_revision` is shown to others as `in_progress`. No ranking or leaderboard; team progress notifications (task delivered, milestone reached such as half the tasks done).
- A project can be copied as a template without assignees.

### 7.7 Meetings

- Meetings are recorded offline on someone's phone and uploaded afterwards (chunked, resumable upload). The worker splits audio into 20 to 30 minute parts with ffmpeg and offers them for download in order.
- **There is NO AI API integration.** The system generates a ready-to-copy prompt for a consumer AI chat and provides a paste box that parses the structured answer (agenda, per-item summary, resolutions with assignee and due date, open items) into fields; if parsing fails, keep the raw text for manual editing. An optional switch adds "do not write individual personal details, only note that an individual matter was discussed". Store links from items to audio timestamps when available.
- The mentor reviews and approves; versions are kept. A resolution converts to a project task with one click. Raw audio is purged about 30 days after the minutes are approved.
- Before upload, show exactly who will be able to see the meeting. Only the mentor, or someone he authorizes for that meeting, may upload.

### 7.8 LMS (class recordings)

- Class recordings go to a private archive per group. The mentor prepares an item (title, speaker, course and order, tags, trim start and end, compress for speech, optional transcript pasted in) and publishes it **immediately** after completing a mandatory consent checklist (voices of minors, names or personal data, speaker consent); the publish button stays disabled until all boxes are ticked.
- The head mentor is notified (prominently) and can revoke at any time with a reason; revoking returns the item to the archive; republishing a revoked item needs the head mentor's approval (proposed rule, not yet confirmed). The mentor can unpublish instantly. No supervisor approval is needed.
- Public pages (no login): course list, player with speed control and resume, Persian search, simple play counts without tracking people.

### 7.9 Album

- Multi-group photos; EXIF and GPS removed on upload; manual tagging only (no face recognition); tagged people are notified and can request removal; public publishing requires the consent of every tagged person (parent for minors) and the system blocks publishing if one is missing. The host mentor publishes deliberately; nothing moves from an album to the public channel automatically.
- Search by event and by person; a "my photos" view for each member shows only photos where he is tagged and that his group may see.

### 7.10 Lifecycle, retention, deletion

- **Leaving is a soft delete.** Status `left`: hidden from lists and statistics; sensitive data (exact address, medical notes, emergency contacts) sealed and unreadable to everyone; purge scheduled after a configurable period (default 12 to 13 months). Returning restores the same record (the national ID hash stays unique), requires fresh consent and re-confirmation of sensitive data, and applies the age-18 transition if he turned 18 meanwhile. Group membership history is kept.
- **Full deletion** is a separate flow: the person (or parent) files a request; the member's mentor reviews; it escalates automatically to the head mentor after 14 days. Rejection needs a reason shown to the requester (for example unverified identity or an open financial record). Execution deletes personal data, replaces the name in group-owned content with a "former member" label, anonymizes financial records, removes photo tags, keeps a content-free deletion log, notifies the person, and lets backups roll off within 30 days.
- A `retention_policy` table drives scheduled purge jobs (all values configurable proposals the organization will finalize): raw meeting audio about 30 days after approval, temporary upload parts a few days, permit photos about 1 year after the camp, audit log 1 to 2 years, notifications 90 days.

### 7.11 Notifications (in-app only; keep delivery separate from the notification record so channels like messengers can be added)

- **Camps:** invitation; group request pending; permit status; participant notice published; schedule changes (to those who may view it); payment reminders; hand-over awaiting confirmation; settlement ready.
- **Schedule:** new group program; RSVP reminder; conflict flagged.
- **Projects:** task assigned; due soon; report submitted; feedback ready; milestone reached.
- **Consultations:** follow-up due; summary released to parent (to the child); release revoked.
- **Grants:** file referred; grant revoked.
- **Meetings:** minutes ready for review; resolution assigned.
- **LMS:** published (to the head mentor, prominent); revoked (to the mentor, with reason); republish request.
- **Emergency:** someone else opened a member's emergency data (to his mentor).
- **Album:** tagged; removal request.
- **Finance:** new mentor claim; deficit-recovery suggestion for the next camp.
- **Lifecycle:** upcoming age-18 transition (person and parent); deletion request submitted, escalated, decided; retention warnings.

### 7.12 Role dashboards (server-computed; superiors get aggregates only)

- **Member:** my week with RSVP buttons, upcoming events and camps with what I owe, my tasks and the team's progress, my shared consultation summaries, notices, my photos.
- **Assistant:** the members assigned to me with status (attendance rate, task status, next follow-ups), my camp responsibilities, camp emergency cards, my workload.
- **Mentor:** group overview (attendance, RSVP gaps, conflicts to review), assistants' workload with a simple way to reassign members, unconfirmed money hand-overs, finance summary (my claim, open debts, funds), projects, LMS items, deletion requests to review, grants I issued.
- **Head mentor:** aggregates across his mentors (counts, attendance, finance totals), recently published LMS items with a revoke button, no private notes.
- **Supervisor:** organization-wide aggregates, the cross-group transparency report, referrals received.
- **Parent:** the minimal panel from rule 7.

### 7.13 Bulk import

- Mentors (for their group) and admins can upload CSV or XLSX of people: names, father's name, birth date (Jalali), national ID, phones, group.
- Dry run first: validate national-ID check digit, duplicates by national ID hash, missing fields, date formats; show row-level errors and a preview; commit only on confirmation; idempotent; keep an import log (`import_job`).
- Imported people must accept consent at first login. Parents are linked separately.

### 7.14 Admin area scope (`/admin`)

- User and hierarchy management: create people, assign mentors, reassign follow-ups, deactivate.
- Organization configuration: consent form versions, retention policies, finance categories, location options, tag lists, courses.
- A read-only viewer of the access policy table (changes go through code-reviewed migrations in v1), an audit-log viewer (metadata only, no sensitive content), a job monitor (purges, audio processing, imports), system health.
- The administrator has no access to sensitive content by default (rule 9).

---

## 8. Data model (reference for tables and fields)

Names are English and PostgreSQL-oriented. Add indexes, foreign keys and timestamps (`created_at`, `updated_at`) as usual. Where the ORM in the template has other conventions, follow them.

**Core and hierarchy**

| Table | Key fields | Notes |
|---|---|---|
| `person` | id, first_name, last_name, father_name, birth_date, national_id_enc, national_id_hash (unique), phone, org_level, availability, status (active/left/purged), left_at, purge_after | national ID encrypted; hash keeps the record unique so a returning person matches his old record |
| `app_user` | id, person_id, login, password_hash | a parent is also an app_user |
| `group` | id, name, owner_person_id | each group has one mentor |
| `membership` | person_id, group_id, role (member/assistant), valid_from, valid_to | exactly one active `member` row per person (except supervisors); defines the direct mentor |
| `follow_up_assignment` | member_person_id, assistant_person_id, group_id, from_date, to_date | history kept; no fixed ratio |
| `group_role` | group_id, person_id, role (finance_officer, camp_lead, ...), valid_from, valid_to | assigned roles |
| `person_ancestors` | person_id, ancestor_id, depth | view or closure table for "all superiors" |

**Access, audit**

| Table | Key fields | Notes |
|---|---|---|
| `access_policy` | resource_type, owner_role, viewer_relation, level | core of `can()` |
| `access_grant` | id, resource_type, resource_id, grantee_person_id, granted_by, granted_at, revoked_at, reason | all referrals |
| `emergency_access_log` | person_id, accessed_by, reason_code, accessed_at | |
| `audit_log` | actor_id, action, resource_type, resource_id, at, meta | no sensitive content in meta |

**Schedule and attendance**

| Table | Key fields | Notes |
|---|---|---|
| `busy_block` | person_id, weekday, start_time, end_time, category, label, is_private, valid_from, valid_to | term-based |
| `event` | id, type, title, host_group_id, recurrence_rule, start, end, place, status | multi-group |
| `event_group` | event_id, group_id | participating groups |
| `event_occurrence` | id, event_id, date, cancelled | |
| `rsvp` | occurrence_id, person_id, status, reason, location_option_id, location_note | intent |
| `attendance` | occurrence_id, person_id, present, marked_by | actual presence |
| `location_option` | id, label, active | editable list |

**Camps**

| Table | Key fields | Notes |
|---|---|---|
| `camp` | event_id, organizer_person_id, status, price_per_person | camp is an event with more fields |
| `camp_group_request` | camp_id, group_id, status, submitted_by | one per participating group |
| `camp_participant` | camp_id, person_id, group_id, status (invited/accepted/declined/confirmed) | |
| `camp_day_attendance` | camp_id, person_id, day, status | one row per person per day |
| `camp_permit` | camp_id, image_file_id, uploaded_by, status | uploading the signed photo marks it obtained |
| `camp_schedule_item` | camp_id, day, start, end, title, responsible_person_id | hidden from members until the camp ends |
| `camp_notice` | camp_id, meeting_time, meeting_place, items_to_bring | what members may see |
| `camp_conflict_review` | camp_id, person_id, day, resolvable, note | |
| `camp_settlement` | camp_id, status, split_rule | |
| `settlement_share` | settlement_id, group_id, kind (surplus/deficit), amount | |

**Finance**

| Table | Key fields | Notes |
|---|---|---|
| `wallet` | id, type, owner_person_id, group_id, custodian_person_id | member_debt, mentor_personal, fund, camp_pool |
| `ledger_entry` | id, from_wallet_id, to_wallet_id, amount (integer), entry_date, category_id, destination_type, destination_id, description_public, description_internal, receipt_file_id, recorded_by, confirmed_by, confirmed_at, reverses_entry_id | append-only; hand-overs need receiver confirmation |
| `finance_category` | id, label | editable |
| `cost_item` | owner (camp or project), title, amount, per_person | itemized for mentors only |
| `charge` | person_id, camp_id, amount | member debt = sum of charges minus payments |
| `budget` | destination_type, destination_id, amount | budget vs actual |

**Consultations, projects**

| Table | Key fields | Notes |
|---|---|---|
| `consultation` | id, member_id, author_id, held_at, kind, shared_summary, followup_text, followup_date | summary visible to the member |
| `consultation_summary_version` | consultation_id, version, edited_by, edited_at, body | |
| `consultation_private_note` | consultation_id, author_id, body | separate table and endpoint |
| `project` / `project_group` | id, title, description, owner_person_id, finance_destination_id, due_date, status / project_id, group_id | |
| `task` / `task_assignee` | id, project_id, title, description, due_date, status / task_id, person_id | |
| `task_report` | id, task_id, author_id, body, version, shared_with_project | private by default |
| `report_feedback` | report_id, author_id, verdict, comment | author and follower only |

**Meetings, LMS, album**

| Table | Key fields | Notes |
|---|---|---|
| `meeting` / `meeting_attendee` | id, group_id, held_at, kind, uploaded_by, status / meeting_id, person_id | access = attendees + ancestors |
| `meeting_audio` | meeting_id, file_id, chunk_order, purge_after | purged about 30 days after approval |
| `meeting_minutes` | meeting_id, ai_raw_output, agenda, summary, status, approved_by | pasted AI output |
| `resolution` | meeting_id, text, assignee_id, due_date, task_id, audio_timestamp | converts to a task |
| `class_recording` | id, group_id, occurrence_id, speaker, file_id, title, tags | private archive |
| `course` | id, title | |
| `lms_item` | recording_id, course_id, order, published_at, published_by, consent_checklist, revoked_at, revoked_by, revoke_reason | published immediately; head mentor can revoke |
| `republish_request` | lms_item_id, requested_by, status | head mentor approves |
| `photo` | id, host_group_id, event_id, file_id, uploaded_by, taken_at | EXIF stripped |
| `photo_group` | photo_id, group_id, hidden_by_group | |
| `photo_tag` | photo_id, person_id, tagged_by | manual only |
| `photo_publication` | photo_id, published_by, published_at | needs consent of every tagged person |

**Personal data**

| Table | Key fields | Notes |
|---|---|---|
| `person_family` | person_id, siblings_count, birth_order, father_job, father_education, mother_job, mother_education | parent fills; optional |
| `person_school` | person_id, school_name, gpa_by_year | under 18 |
| `person_adult_profile` | person_id, last_degree, university, field, current_job | 18 and over |
| `job_history` | person_id, title, from, to | |
| `person_address` | person_id, neighborhood, street_note, address_enc | exact address sealed behind the emergency action |
| `emergency_contact` | person_id, emergency_phone, parent_phones | |
| `medical_info` | person_id, notes_enc | optional, encrypted |
| `tag` / `person_tag` | label, kind (interest/skill) / person_id, tag_id | extendable list |
| `book_log` | person_id, title, date | |
| `time_use_report` | person_id, month, hours_by_category | self-report plus computed from busy blocks |
| `parent_link` | parent_user_id, child_person_id, confirmed_by, active | under 18 only; deactivated at 18 |

**Lifecycle, system**

| Table | Key fields | Notes |
|---|---|---|
| `consent_form_version` / `consent_record` | id, items, published_at / person_id, signer_id, version_id, accepted_items, at | signer is the parent for minors |
| `deletion_request` | id, person_id, requested_by, reviewer_id, status, reject_reason, escalated_to, created_at | mentor reviews; escalates after 14 days |
| `retention_policy` | data_type, keep_days, action (delete/anonymize/archive) | drives scheduled purges |
| `file` | id, kind, storage_key, size, created_by, purge_after | signed URLs only |
| `notification` | id, recipient_id, type, payload, created_at, read_at | delivery is separate |
| `import_job` | id, created_by, status, summary, errors | bulk import log |

## 9. Security and privacy requirements

- Application-level encryption (AES-GCM, key from the environment, rotation supported) for national ID, exact address and medical notes; HMAC hash for national ID uniqueness; masked display everywhere except where a policy allows.
- No sensitive data in logs, analytics, error messages or URLs. Signed URLs expire quickly. Validate file types and sizes. Strip image metadata.
- Every admin or break-glass action is logged. Secure defaults: deny unless a policy row or grant allows.
- Consent and privacy texts are editable in the admin area and versioned.
- Printed material (permit lists, emergency cards) is generated on demand, never stored permanently, and every print is logged.

## 10. Out of scope for version 1

AI API calls, face recognition, the automated permit approval workflow, SMS or messenger push (but keep the notification record separate from delivery), a native mobile app (planned later on the same API), an online payment gateway.

## 11. Seed data and tests

- **Seed:** 1 supervisor, 1 head mentor, 2 mentors, 3 assistants, 12 members (some under 18 with parents), one joint camp across 2 groups, some private blocks, consultations with shared and private parts, a sample fund and ledger entries.
- **Policy matrix test:** for every resource type and every relation (self, assistant following the member, assistant not following, own mentor, other mentor, head mentor, supervisor, parent, unrelated member, system admin), assert the expected visibility. No endpoint ships without a row in this matrix.
- **Also test:** ledger invariants (append-only, balances), camp settlement math, the age-18 transition, soft delete and return, chunked upload resume, import validation, and that private notes never appear in shared-summary responses.

## 12. Phases

1. **Foundation:** inspect and extend both templates (backend module structure, auth, OpenAPI generation, generated frontend client, MUI RTL theme and design tokens, Jalali utilities, i18n, PWA shell), Docker and CI, person, group, membership, hierarchy, `can()`, access policy and grants, audit log, consent, notifications, admin area skeleton, bulk import, seed data, policy test matrix.
2. **Weekly schedule:** events, RSVP, attendance, conflicts, common free time, member and assistant dashboards.
3. **Consultations and camps:** consultations with parent release; camps (permit PDF, joint camps, parent panel, participant notice, emergency card, per-day attendance).
4. **Finance and projects:** wallets, ledger, hand-overs, settlement, reports; projects and tasks; mentor, head mentor and supervisor dashboards.
5. **Album, meetings, LMS:** chunked upload, prompt generator, paste parser, publishing and revoking.
6. **Lifecycle and hardening:** retention jobs, soft delete and deletion flow, admin area completion, performance, accessibility pass.

## 13. Definition of done (every phase)

Typecheck, lint and tests pass; migrations apply from scratch; the seed runs; the policy matrix is updated; docs are updated; `docs/OPEN_QUESTIONS.md` lists every assumption; one commit per phase at least.

## 14. Open questions

Decided by the organization but still to be finalized or confirmed:

- Retention periods (30 days for raw meeting audio, 12 to 13 months for people who left, 14 days to review a deletion request, and the rest) are proposals; the officials must finalize them and a legal advisor should review the legal rules.
- Republishing an LMS item after a head-mentor revocation needs his approval (proposed, not confirmed).
- The build order in section 12 is a proposal, not confirmed.

Ask the owner before coding: the authentication method (phone OTP provider?), the hosting target, whether the two templates share one repository, whether the technical manager may ever access sensitive data, the fixed currency unit, and the final retention periods.
