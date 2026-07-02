# PRD — Hadanati (working name)

Nursery management SaaS for Jordan. One Next.js app serving a staff dashboard and a parent portal, installable as a PWA. Arabic-first, offline-capable for classroom workflows.

**Stack:** Next.js (latest, App Router) · Convex · PWA via Serwist · Tailwind + shadcn/ui (RTL) · Vercel
**Business model:** Multi-tenant SaaS. Concierge onboarding (WhatsApp → set up for the nursery in <1 hour). Subscription billed to nursery. No public self-serve signup.

---

## 1. Problem

Jordanian nurseries run on paper and WhatsApp groups. Attendance is untracked, child development is invisible to parents, fee collection leaks (no invoices, no running balances), and the owner has no live view of the operation. Global tools are not Arabic-first, do not handle JOD, and assume reliable connectivity inside the building.

## 2. Users

| Role | Job to be done |
|---|---|
| Admin (owner/director) | Live overview: attendance, cash position, overdue fees. Full control. |
| Teacher | Record attendance + weekly evaluations for own classroom in <5 min on a phone, even with bad Wi‑Fi. |
| Accountant | Issue invoices, record payments, chase overdue, log expenses. |
| Parent | See today's attendance, child's progress charts, and balance due — without creating an account. |

## 3. Market constraints (Jordan)

- Currency: JOD, **3 decimal places** → store all amounts as integer fils (JOD × 1000). Never floats.
- School week: **Sunday–Thursday**; weekend Fri–Sat. Attendance and "week" logic start Sunday.
- Payments: cash, CliQ, bank transfer dominate → v1 **records** payments, does not process them.
- Language: Arabic default (RTL), English toggle. Gregorian dates.
- Data: children's data is sensitive under Jordan PDPL (Law 24/2023) → guardian consent capture at enrollment, photos opt-in, deletion on request.
- Stages must be freeform: nurseries (0–4, MoSD-licensed) and KGs (KG1/KG2) may coexist in one facility.

## 4. Goals (90 days post-launch)

- 5 paying nurseries live.
- Attendance recorded on ≥80% of school days per active nursery.
- ≥50% of parents open the portal weekly.
- Zero lost offline mutations; sync failure rate <1%.
- Onboarding ≤1 hour per nursery.

## 5. Non-goals (v1)

Native iOS/Android apps · payment gateway integration · Excel import · branded PDF export (browser print stylesheet only) · online enrollment/waitlists · teacher-performance analytics · multi-currency · per-tenant database isolation · WhatsApp API automation · meals/transport/bus tracking modules.

Anything added to v1 must displace something on this list's complement.

## 6. Roles & permissions

| Resource | Admin | Teacher | Accountant | Parent |
|---|---|---|---|---|
| Nursery settings, staff, stages/classrooms | CRUD | — | — | — |
| Students | CRUD | Read (own classrooms) | Read | Read (own children) |
| Attendance | CRUD (any date) | CRUD (own classrooms, same day) | Read | Read (own children) |
| Evaluations | CRUD | CRUD (own classrooms) | — | Read (own children) |
| Finance (plans, invoices, payments, expenses) | CRUD | — | CRUD | Read own invoices/payments |
| Announcements | CRUD | Create (own classrooms) | — | Read |

Parents are not `users`; they authenticate via per-child access codes (FR-AUTH-2).

## 7. Functional requirements

### 7.1 Tenancy & onboarding
- FR-TEN-1: Nursery = tenant. Every record carries `nurseryId`. Every Convex query/mutation asserts caller membership + role before touching data. Cross-tenant access is impossible server-side.
- FR-TEN-2: Nurseries and their first admin are created via an internal admin script/tool. No public signup.
- FR-TEN-3: Nursery settings: name, logo, active academic year (start/end dates, `yearId` e.g. `"2026-2027"`), default locale.

### 7.2 Auth
- FR-AUTH-1: Staff: email + password via Convex Auth. Role comes from `memberships`.
- FR-AUTH-2: Parent: per-child access code. ≥10 chars, high entropy, stored hashed, rate-limited verification, regenerable by admin (invalidates old). Code = bearer credential; no account, no password. Multiple codes on one device → child switcher.
- FR-AUTH-3: Sessions persist offline; the PWA must open and render cached data with no network.

### 7.3 Structure & students
- FR-STU-1: Stages (freeform, ordered) → classrooms → assigned teacher(s).
- FR-STU-2: Student profile: name (AR required, EN optional), DOB, sex, optional photo (consent-gated), guardians `[{name, phone, relation}]`, health notes/allergies, status active/archived.
- FR-STU-3: Enrollment links student ↔ classroom ↔ `yearId` ↔ fee plan. History preserved per year (enables v1.1 bulk-promote rollover wizard; not built in v1, but the model supports it).

### 7.4 Attendance — offline-capable
- FR-ATT-1: Teacher view: classroom roster grid; one tap cycles present → absent → late → excused. Optional note and check-in time.
- FR-ATT-2: Exactly one record per (student, date) — upsert semantics. Teachers edit same-day only; admin edits any date.
- FR-ATT-3: Admin dashboard: today's present/absent counts per classroom + absentee list.
- FR-ATT-4: Marking a student absent emits a parent notification.

### 7.5 Evaluations — offline-capable
- FR-EVA-1: Weekly per student: four axes — academic, social, motor, behavioral — each scored 1–5, optional note. Week = academic-year week number (Sunday start).
- FR-EVA-2: Exactly one evaluation per (student, yearId, week) — upsert; latest write wins.
- FR-EVA-3: Charts: one line per axis across the year. Visible to staff and to that child's parents.
- FR-EVA-4: Saving an evaluation emits a parent notification.

### 7.6 Finance — online-only
- FR-FIN-1: Fee plans: name, `amountFils`, cadence monthly | term | annual | one-time.
- FR-FIN-2: Invoices: auto-generated per enrollment per cadence + manual ad-hoc. States: draft, issued, partial, paid, overdue, void. Overdue = issued/partial past `dueDate` (computed).
- FR-FIN-3: Payments recorded against an invoice: `amountFils`, method cash | cliq | transfer | cheque, `paidAt`, `receivedBy`. Partial payments allowed. Receipt = printable view (print stylesheet).
- FR-FIN-4: Expenses: date, category, `amountFils`, note.
- FR-FIN-5: Views: collected MTD, total outstanding, overdue list, expenses MTD, per-student statement (on-screen, printable).
- FR-FIN-6: All finance writes require connectivity. Offline UI disables them with an explicit message.

### 7.7 Parent portal (PWA)
- FR-PAR-1: Home: today's attendance status, latest evaluation summary, balance due.
- FR-PAR-2: Progress: 4-axis charts over the year.
- FR-PAR-3: Payments: invoices + payment history, read-only.
- FR-PAR-4: Announcements feed (nursery-wide or classroom-scoped; text + optional image).
- FR-PAR-5: Entire portal read-only. Arabic default.

### 7.8 Announcements & notifications
- FR-ANN-1: Admin composes to whole nursery or a classroom; teachers to own classrooms.
- FR-NOT-1: In-app notification inbox (all events) + Web Push (VAPID) opt-in.
- FR-NOT-2: Events: absence marked, evaluation saved, invoice issued, invoice overdue, announcement published.
- FR-NOT-3: No child PII in push payloads (payload = type + ids; content fetched on open).
- FR-NOT-4: iOS requires installed PWA (iOS ≥16.4) for push → parent onboarding screen walks through Add to Home Screen.

### 7.9 i18n
- FR-I18N-1: `ar` (default, `dir="rtl"`) and `en`. All strings from dictionaries; CSS logical properties throughout; per-session toggle.

## 8. Offline-first spec (v1 must-have)

**Scope.** Reads: last-known data renders everywhere when offline, with an offline badge + data age. Writes: **attendance and evaluations only**. All other writes are blocked offline.

**Why scoped.** Convex has no first-class offline mutations — the outbox is custom. Attendance and evaluations are the in-classroom, bad-Wi-Fi workflows; they are single-record upserts, so conflicts are trivially resolvable. Finance and structural edits offline create conflict costs that exceed their value.

**Architecture.**
1. App shell precached via Serwist service worker.
2. Convex query snapshots persisted to IndexedDB; on offline load, hydrate from snapshot.
3. Outbox: offline mutations appended to an IndexedDB queue `{clientMutationId: uuid, name, args, createdAt}` and applied optimistically to local state.
4. On reconnect: FIFO replay. Server mutations are idempotent — `clientMutationId` checked against a `syncLog` table (unique index) before applying; duplicates ack silently.
5. Conflict rule: attendance/evaluations are keyed upserts → last write to reach the server wins; if the server row changed after the client's snapshot, apply LWW and mark the record "updated during sync" in the UI.
6. Queue survives app restart. UI shows pending-count chip + manual "sync now".

**Acceptance criteria.**
- AC-OFF-1: Airplane mode → mark attendance for 25 students + save 5 evaluations → kill app → reopen → reconnect → 100% persisted, zero duplicates.
- AC-OFF-2: Two devices edit the same attendance record offline → after both sync: one record, later sync wins, no error state.
- AC-OFF-3: Cold-start offline: app opens to cached roster + today's grid in <3s.

## 9. Architecture decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Backend | Convex | Supabase, Firebase | Reactive queries power live dashboards free; end-to-end TS; zero infra. Trade-off accepted: DIY offline outbox (§8). |
| Tenancy | Single deployment, `nurseryId` enforced in every function | DB-per-tenant | Operational sanity for a solo dev. Revisit past ~100 tenants. |
| Clients | One Next.js PWA, role-routed (staff dashboard + parent portal) | Native apps | One codebase, no store review, instant updates. Trade-off: iOS push needs A2HS (FR-NOT-4). |
| Payments | Record only | Gateway integration | Jordan reality is cash/CliQ. Gateway is v2 if pilots demand it. |
| Files | Convex file storage (photos, logos) | S3 | Fewer moving parts; consent-gated uploads. |
| Money | Integer fils everywhere | Decimal/float | JOD has 3 decimals; floats corrupt sums. |

## 10. Data model (Convex tables)

```
nurseries      { name, logoId?, settings: { locale, weekStart: "sun" }, activeYear: { yearId, start, end } }
users          { authId, name, phone?, locale }
memberships    { userId, nurseryId, role: "admin"|"teacher"|"accountant" }        // idx: by_user, by_nursery
stages         { nurseryId, name, order }
classrooms     { nurseryId, stageId, name, teacherIds: Id<users>[] }
students       { nurseryId, nameAr, nameEn?, dob, sex, photoId?, health?, guardians: [{name, phone, relation}], consent: { photos: boolean }, status: "active"|"archived" }
accessCodes    { nurseryId, studentId, codeHash, active }                          // idx: by_codeHash
enrollments    { nurseryId, studentId, classroomId, yearId, feePlanId? }           // idx: by_classroom_year, by_student
attendance     { nurseryId, classroomId, studentId, date: "YYYY-MM-DD", status: "present"|"absent"|"late"|"excused", note?, checkInAt?, recordedBy }   // unique: (studentId, date)
evaluations    { nurseryId, studentId, yearId, week: number, scores: { academic, social, motor, behavioral }, note?, recordedBy }                      // unique: (studentId, yearId, week)
feePlans       { nurseryId, name, amountFils, cadence: "monthly"|"term"|"annual"|"one_time" }
invoices       { nurseryId, studentId, feePlanId?, amountFils, dueDate, period?, status: "draft"|"issued"|"partial"|"paid"|"overdue"|"void" }
payments       { nurseryId, invoiceId, amountFils, method: "cash"|"cliq"|"transfer"|"cheque", paidAt, receivedBy, note? }
expenses       { nurseryId, category, amountFils, date, note? }
announcements  { nurseryId, classroomId?, title, body, imageId?, createdBy, createdAt }
notifications  { nurseryId, target: { studentId? , userId? }, type, payload, readAt? }
pushSubs       { nurseryId, owner: { userId? , accessCodeId? }, subscription }
syncLog        { clientMutationId, processedAt }                                   // unique: clientMutationId
```

Every table indexed by `nurseryId` first. Attendance and evaluation mutations accept optional `clientMutationId` for offline replay dedupe.

## 11. Milestones

Ship gate for each milestone = its acceptance criteria pass. No dates; sequence is fixed.

- **M0 — Foundation + offline spike.** Repo, CI, Convex schema, Convex Auth, tenancy guard helper, RTL app shell, i18n scaffold. **Week-1 spike: prove AC-OFF-1 with a throwaway UI before building anything on the outbox.**
- **M1 — Core staff loop (online).** Stages/classrooms/students CRUD, attendance grid, evaluations + charts, admin dashboard.
- **M2 — Offline + parents.** Outbox for attendance/evals, cached reads, parent portal via access codes, push notifications, announcements.
- **M3 — Money + pilot.** Finance module, statements + print stylesheets, seed/onboarding scripts, onboard 2 pilot nurseries free, fix, then start charging.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Convex offline gap breaks the core promise | Narrow scope (§8); M0 spike de-risks before dependent work exists. |
| iOS parents never enable push | A2HS onboarding flow; in-app inbox is the fallback channel; measure opt-in rate at pilot. |
| Access code leaks child data | High entropy, hashed at rest, rate-limited, admin regeneration, no PII in push payloads. |
| PDPL / data residency (Convex is US-hosted) | Guardian consent at enrollment, photo opt-in, delete-on-request; legal review of cross-border transfer before scaling past pilots. |
| Concierge onboarding doesn't scale | Acceptable ≤50 nurseries; build CSV importer when it hurts. |
| Solo-dev scope creep | §5 is a contract. Every addition must be traded against it. |

## 13. Open questions

1. Pricing: flat JOD/month per nursery (tiered by student count) vs per-student. Decide before M3.
2. Default photo policy: off unless guardian consent, or off entirely for v1?
3. Do KG-stage nurseries need MoE-format term reports? Validate during pilot; candidate v2 feature.
