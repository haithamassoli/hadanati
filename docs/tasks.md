# Tasks — Hadanati

Derived from [PRD.md](./PRD.md). Milestone sequence is fixed (M0 → M3), no dates. Ship gate for each milestone = its acceptance criteria pass. Task IDs reference the PRD's FR/AC numbers.

---

## M0 — Foundation + offline spike

Goal: stand up the skeleton and **de-risk the offline outbox before anything depends on it**. Nothing in M1+ starts until the spike passes AC-OFF-1.

- [ ] Repo setup: Next.js (App Router) + Convex + Tailwind/shadcn with RTL + Serwist wired; deploys to Vercel
- [ ] CI: lint, typecheck, build on every PR
- [ ] Convex schema: all §10 tables with `nurseryId`-first indexes; unique constraints for `(studentId, date)`, `(studentId, yearId, week)`, `clientMutationId`
- [ ] Convex Auth: staff email + password; `users` + `memberships` with roles (FR-AUTH-1)
- [ ] Tenancy guard helper: assert caller membership + role in every query/mutation; adopted as the mandatory pattern from day one (FR-TEN-1)
- [ ] Internal admin script: create nursery + first admin — no public signup (FR-TEN-2)
- [ ] Nursery settings: name, logo, active academic year (`yearId`, start/end), default locale (FR-TEN-3)
- [ ] App shell: role-routed layouts (staff dashboard / parent portal), PWA manifest, installable
- [ ] i18n scaffold: `ar` default with `dir="rtl"`, `en` toggle, string dictionaries, CSS logical properties (FR-I18N-1)
- [ ] Money convention locked in code: integer fils everywhere, shared format/parse helpers, no floats (§3)
- [ ] **Week-1 offline spike (throwaway UI):** SW precache → IndexedDB query snapshots → outbox queue `{clientMutationId, name, args, createdAt}` → FIFO replay → idempotent server mutation deduped via `syncLog`
- [ ] Spike passes **AC-OFF-1**: airplane mode → 25 attendance marks + 5 evaluations → kill app → reopen → reconnect → 100% persisted, zero duplicates

**Ship gate:** AC-OFF-1 passes on the spike; schema deployed; tenancy guard covered by a test proving cross-tenant access fails.

---

## M1 — Core staff loop (online)

Goal: a teacher and admin can run a school day end-to-end, online only.

- [ ] Stages CRUD: freeform names, ordered (FR-STU-1, §3 nursery/KG mix)
- [ ] Classrooms CRUD + teacher assignment (`teacherIds`)
- [ ] Students CRUD: nameAr required / nameEn optional, DOB, sex, guardians `[{name, phone, relation}]`, health notes, active/archived (FR-STU-2)
- [ ] PDPL consent capture at enrollment; photo upload opt-in, consent-gated, via Convex file storage (§3, §12)
- [ ] Enrollments: student ↔ classroom ↔ `yearId` ↔ fee plan, history preserved per year (FR-STU-3)
- [ ] Attendance grid: classroom roster, one tap cycles present → absent → late → excused, optional note + check-in time (FR-ATT-1)
- [ ] Attendance upsert: exactly one record per (student, date); teacher edits same-day own classrooms only, admin any date (FR-ATT-2)
- [ ] Evaluations: weekly 4 axes (academic, social, motor, behavioral) scored 1–5 + note; one per (student, yearId, week); Sunday-start week-number helper (FR-EVA-1/2)
- [ ] Progress charts: one line per axis across the year, staff view (FR-EVA-3)
- [ ] Admin dashboard: today's present/absent counts per classroom + absentee list (FR-ATT-3)
- [ ] §6 permission matrix enforced server-side across all of the above (teacher scoped to own classrooms, accountant read-only, etc.)

**Ship gate:** full staff loop (setup → enroll → attendance → evaluation → dashboard) works online; permission matrix verified server-side.

---

## M2 — Offline + parents

Goal: the classroom works on bad Wi-Fi; parents see everything without an account.

### Offline (§8)
- [ ] Productionize the spike outbox: attendance + evaluation mutations accept `clientMutationId`, optimistic local apply
- [ ] Cached reads everywhere: Convex query snapshots persisted to IndexedDB, hydrate on offline load, offline badge + data age
- [ ] Reconnect replay: FIFO, `syncLog` dedupe, LWW conflict rule with "updated during sync" marker in UI (§8.4–5)
- [ ] Queue survives app restart; pending-count chip + manual "sync now" (§8.6)
- [ ] All non-attendance/evaluation writes blocked offline with explicit message (§8 scope, FR-FIN-6)
- [ ] **AC-OFF-1** re-verified on production code
- [ ] **AC-OFF-2**: two devices edit same attendance record offline → one record after both sync, later sync wins, no error state
- [ ] **AC-OFF-3**: cold-start offline opens to cached roster + today's grid in <3s

### Parent portal
- [ ] Access codes: ≥10 chars high entropy, stored hashed, rate-limited verification, admin regeneration invalidates old (FR-AUTH-2)
- [ ] Parent session persists offline; portal opens with cached data, no network (FR-AUTH-3)
- [ ] Child switcher for multiple codes on one device (FR-AUTH-2)
- [ ] Portal home: today's attendance status, latest evaluation summary, balance due (FR-PAR-1)
- [ ] Progress: 4-axis charts over the year (FR-PAR-2)
- [ ] Entire portal read-only, Arabic default (FR-PAR-5)

### Announcements & notifications
- [ ] Announcements: admin → nursery or classroom; teacher → own classrooms; text + optional image (FR-ANN-1)
- [ ] Parent announcements feed (FR-PAR-4)
- [ ] In-app notification inbox (FR-NOT-1)
- [ ] Events wired: absence marked (FR-ATT-4), evaluation saved (FR-EVA-4), announcement published (FR-NOT-2)
- [ ] Web Push via VAPID, opt-in; payload = type + ids only, no child PII (FR-NOT-1/3)
- [ ] iOS A2HS onboarding screen for push (FR-NOT-4)

**Ship gate:** AC-OFF-1/2/3 pass on production code; a parent with only an access code can see attendance, progress, and announcements.

---

## M3 — Money + pilot

Goal: finance loop closes, first real nurseries live, revenue starts.

### Finance (online-only)
- [ ] Fee plans CRUD: name, `amountFils`, cadence monthly | term | annual | one-time (FR-FIN-1)
- [ ] Invoices: auto-generated per enrollment per cadence + manual ad-hoc; states draft/issued/partial/paid/overdue/void; overdue computed from `dueDate` (FR-FIN-2)
- [ ] Payments against invoices: `amountFils`, method cash | cliq | transfer | cheque, `paidAt`, `receivedBy`, partials allowed (FR-FIN-3)
- [ ] Expenses: date, category, amount, note (FR-FIN-4)
- [ ] Finance views: collected MTD, total outstanding, overdue list, expenses MTD, per-student statement (FR-FIN-5)
- [ ] Finance writes disabled offline with explicit message (FR-FIN-6)
- [ ] Parent payments tab: invoices + payment history, read-only (FR-PAR-3)
- [ ] Notifications: invoice issued, invoice overdue (FR-NOT-2)
- [ ] Print stylesheets: payment receipt + per-student statement (FR-FIN-3/5, §5 no PDF export)

### Pilot
- [ ] Seed + onboarding scripts: full nursery set up (stages, classrooms, students, codes) in ≤1 hour (§4)
- [ ] Decide pricing model — flat tiered vs per-student (open question #1, blocks charging)
- [ ] Resolve default photo policy (open question #2)
- [ ] Onboard pilot nursery #1 (free)
- [ ] Onboard pilot nursery #2 (free)
- [ ] Fix pilot feedback; validate KG term-report need (open question #3)
- [ ] Start charging

**Ship gate:** 2 pilots live; plan → invoice → payment → statement works end-to-end; onboarding measured ≤1 hour.

---

## Cross-milestone tracking (90-day goals, §4)

- [ ] Attendance recorded ≥80% of school days per active nursery
- [ ] ≥50% of parents open the portal weekly
- [ ] Zero lost offline mutations; sync failure rate <1%
- [ ] 5 paying nurseries live
