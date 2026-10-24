# AICTE Approval & Compliance Platform (SIH 2026 prototype)

Working prototype for the Smart India Hackathon 2026 AICTE problem statement *Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System*. This build covers phases 0 to 4 of the final architecture (v3).

The system routes, assigns, reminds, explains and records. It never decides: the only approve or reject is the competent authority's **Decide** action, which always needs a human click and a reason.

> **What is placeholder.** All timelines, routes, application types, document lists, assignment weights, capacities and thresholds are pending verification against the APH and with AICTE officers. Holidays are placeholder dates. Form check results (including `formcheck/EVALUATION.md`) are measured on synthetic data. All people and institutions are fictional.

> **Placeholders.** All timelines, routes, application types, document lists, weights and thresholds are placeholders pending verification against the AICTE Approval Process Handbook (APH) and with AICTE officers. Form check results are measured on synthetic data.

## Setup

Requirements: Docker, Node 20 and Python 3.11.

```bash
cp .env.example .env
npm run setup          # install, start the db container, migrate, audit guard, seed, build the template db
docker compose up      # db, api, scheduler ×2, formcheck, web
```

Open http://localhost:8080 and pick a demo user on the sign-in page.

Other scripts:

| Script | What it does |
|---|---|
| `npm run dev` | API, scheduler and web locally (web on http://localhost:5173) against the compose database; formcheck via uvicorn |
| `npm test` | API tests (Vitest + Supertest against a real PostgreSQL test database `aicte_test`) |
| `npm run test:formcheck` | Form check service tests (pytest) |
| `npm run demo:reset` | Recreate the working database from the template (a few seconds) |
| `npm run demo:tamper` | As the postgres superuser, change one audit row behind the trigger's back (stands in for someone with server access) |

To use an existing local PostgreSQL 16 instead of the compose database: `SETUP_NO_DOCKER=1 npm run setup` with the URLs in `.env` pointing at it.

## Demo users

Password for every user: `demo1234`.

| Email | Who |
|---|---|
| college.abc@demo.in | ABC Engineering College (South), portfolio officer Priya Raman |
| priya@demo.in | Priya Raman, officer, South (Kumar's team) |
| arjun@demo.in | Arjun Rao, officer, South (Kumar's team) |
| meena@demo.in | Meena Pillai, officer, South (Kumar's team) |
| ravi@demo.in | Ravi Kumar, officer with the EVC desk skill, South |
| kumar@demo.in | Kumar Sharma, senior officer, South |
| lakshmi@demo.in | Lakshmi Iyer, super senior officer, South |
| hod.south@demo.in | Dr. Rajesh Menon, head of department, South |
| authority.south@demo.in | Competent authority, South |
| committee1@demo.in … committee6@demo.in | Expert committee pool (cross-region) |
| bureau.head@demo.in | Bureau head (cross-region) |
| officer.west@demo.in | Rahul Patil, officer, West |
| admin@demo.in | Administrator (time travel, reset, audit) |

## Demo script (after `npm run demo:reset`)

1. Sign in as ABC Engineering College (`college.abc@demo.in`). Start a new institution application. Enter a built-up area larger than the land area: "Check my entries" shows R1 (High); fix it. If a Medium warning remains, enter a justification. Try to submit without the land lease (blocked; the message names it); attach it with an expiry 2 years ahead and submit. Priya's case view shows "Assigned to Priya Raman … portfolio officer".
2. Sign in as Priya. Open the case from My tasks; the Form checks panel shows the history (mark the earlier R1 warning useful). Return it with "Lease covers 2 years, 3 required" and the land lease item. The case turns amber, the clock pauses, it leaves her own list and appears under "Waiting on college" after the next engine cycle (up to a minute).
3. Sign in as the college and reply with a new lease (3 years). Re-scrutiny returns to Priya with the remaining days.
4. Priya completes scrutiny. The EVC desk task goes to Ravi with its reason text.
5. Admin advances 20 days. "EVC not scheduled" appears; escalation level 1 reaches Kumar.
6. Sign in as Kumar. Team: per-officer figures, waiting-on breakdown, Escalated to me. Workforce: Arjun overloaded, Meena idle. Availability: add leave for Arjun starting today; his open tasks are reassigned (Meena takes the largest share), each with reason text. Workforce: reassign one task by hand and see "Recommended by system".
7. Sign in as Ravi: open the EVC case, review the proposed committee, schedule for tomorrow, online. Admin advances 1 day. Sign in as the first committee member and submit the report. The case reaches Decision.
8. Sign in as `authority.south@demo.in`: approve with conditions, "Submit fire NOC" due in 90 days.
9. Admin advances 85 days. The college sees reminders at 30, 15 and 7 days (each once), and Priya sees the expiring lease in her portfolio under "Waiting on college". The college uploads the fire NOC on Compliance; the verification task goes to Priya; she verifies on the case; the case becomes Closed.
10. Admin: filter the audit log by the application number (every step is there) and run Verify integrity (OK). Try an update as the app role (below): rejected. Run `npm run demo:tamper` and verify again: the broken row is named. Sign in as a South officer and open `/cases/<West id>` (the seed prints one): no access, logged as ACCESS_DENIED. Run `docker compose stop` on the leader scheduler (`docker compose ps scheduler` lists both; the admin Scheduler tab names the leader): the standby becomes leader within a minute and no alert repeats.

This script is automated with Playwright during development and passes end to end twice in a row after a reset.

## Phase status

- [x] Phase 0: foundation (compose stack, roles and audit guard, schema, config, clock, workdays, audit chains, auth, policy skeleton, directory seed, template and reset, design system and shell)
- [x] Phase 1: workflow and assignment (routing, transitions, assignment engine with reasons, availability, uploads, role screens)
- [x] Phase 2: deadline engine and scheduler (deadline items, pause and resume, leader election, reminders, overdue, escalation, digests, time travel, admin controls)
- [x] Phase 3: Action Center and dashboards (flags with reasons and five-key order, college "What we need from you", team roll-up with drill-down, workforce with reassignment and portfolio moves, no-eligible-officer queue, seeded history)
- [x] Phase 4: post-approval and form check (decide with conditions, undertakings and expiry items, evidence and renewal verification, automatic close, form check service with rules and an Isolation Forest, college and officer panels)

## Modules

**Workflow.** Each application type has a route (`shared/rules.json`) resolved at submission and stored on the case. A case is one record with a moving pointer: stage, status and holder. Every action goes through `performAction`, which validates the payload, checks `can(user, action, application)` (role, scope, transition table, current holder or assignment, separation of duties), then runs one database transaction that changes the case, moves assignments, updates deadline items, appends the audit row and creates notifications. There is no approve or reject anywhere except the competent authority's Decide.

**Assignment.** When a stage needs an officer, the engine locks the region, loads eligible officers with their live load from open assignments, drops anyone away, over capacity, barred or recused, prefers continuity (the institution's portfolio officer for scrutiny and verification, the returning officer for re-scrutiny), and otherwise picks the lowest score (0.70 projected utilisation, 0.20 recent assignments, 0.10 specialisation mismatch). If no officer in the region qualifies it overflows to the Bureau; if nobody qualifies the task goes to the head of department's queue. Every assignment stores a plain-language reason ("Assigned to Priya Raman (Officer, South): portfolio officer for ABC Engineering College; utilisation 0.15 after this task. 50 eligible; none excluded. Tier 0. Policy v1."). Leave covering today releases and reassigns an officer's open tasks without moving deadlines.

**Action Center.** Each engine cycle rebuilds a set of flags from the deadline items and case state: at risk, overdue, waiting on college, stalled, EVC not scheduled, EVC report overdue, evidence waiting for verification, undertaking due soon or overdue, document expiring or expired, blocked (missing critical document, no committee for a due EVC, no eligible officer), urgent and escalated. Each flag has an owner, a next action and a reason in plain language ("Overdue — Scrutiny deadline 4 working days overdue (due 6 Nov 2026); owner: Priya Raman (Officer, South); waiting 19 days; next: Complete stage, return or revert; next escalation: level 2 (Deputy Director) on 18 Nov 2026"). The list is always ordered by escalation level, days overdue, category (new institutions first), days to due and filing date. Flags owned by a college never count as an officer's overdue work; they appear under "Waiting on college" and on the college's own "What we need from you" card. No machine learning is involved.

**Reports and workforce.** Senior officers, super seniors and heads of department see their direct reports' work received, completed, returned and held, ageing in stage, overdue items, deadlines met and utilisation, with each person's figures summed over everyone who reports to them and a drill-down to the next level. There is no ranking and no composite score. The workforce view shows each officer's load against capacity, availability today, open tasks and portfolio, flags overloaded and idle officers against their own team's average, and lets the manager reassign a task (the system's recommendation is shown and recorded) or move a portfolio.

**Deadline engine and scheduler.** Every clock is a deadline item written inside the case transaction: stage deadlines in working days, the EVC scheduling and report deadlines, verification, undertakings and document expiry in calendar days. Returning a case pauses its clock and stores the remaining working days; the reply resumes it. Two scheduler processes run; the one holding a PostgreSQL advisory lock is the leader and runs a cycle every minute (the other waits and takes over within seconds if the leader stops). A cycle sends compliance reminders at 30, 15, 7 and 0 days, an at-risk alert at 80% of a stage deadline, an overdue alert, and escalations at 3, 7 and 14 days overdue up the `reportsTo` chain (HoD when the chain ends; the competent authority also at level 3). A unique key on every alert makes cycles idempotent, so a scheduler that was down catches up once, marking missed reminders late. Weekends and holidays are skipped. The admin's time travel moves a simulated clock that every date comparison uses, and runs a cycle at once.

**Post-approval compliance.** An approval with conditions creates one undertaking (with a deadline item) per condition, and every verified document with an expiry date gets an expiry item. Colleges upload evidence or a renewed document from the Compliance page; the engine assigns a verification task (preferring the portfolio officer) with a 5-working-day clock. Verified evidence closes the undertaking; when the last one is verified the case closes automatically. Rejected evidence goes back to the college with the officer's remarks. A verified renewal replaces the expiry item.

**Form check ("Check my entries").** While a college fills the form, the API checks required fields itself and asks the Python service for a score (800 ms timeout). The service applies five plausibility rules (built-up area larger than the plot, expired lease, fewer than 80% of required documents, more than 40 students per faculty member, less than 2 square metres per student) and an Isolation Forest trained on synthetic normal forms; rule hits are HIGH, a model-only anomaly is MEDIUM and names the three most unusual values with their typical values. If the service is down, the API evaluates the same rules file itself and marks the result "model unavailable". Warnings never block filing and never affect routing, deadlines, assignment or Action Center order; HIGH and MEDIUM warnings only ask the college for a justification, which the scrutiny officer sees alongside the check history and can label useful or not useful (stored with the model version). Evaluation figures in `formcheck/EVALUATION.md` are measured on synthetic data only.

**Audit.** Every action appends a row to `AuditLog`. Rows are chained per application (and one global chain for non-case events): each row stores `sha256(prevHash + canonicalJSON(row))`, with a per-chain advisory lock so concurrent cases never block each other. The app role has no UPDATE, DELETE or TRUNCATE on the table, and a trigger rejects updates and deletes even from the owner. `GET /api/admin/audit/verify` recomputes every chain and names the first broken row.

Try an update as the app role (rejected):

```bash
docker compose exec db psql -U aicte_app -d aicte -c "UPDATE \"AuditLog\" SET reason = 'x' WHERE id = 1"
```

## Next phases (not built)

Phase 5: rebalancing suggestions and approval, full committee coverage and independence rules, delegation grants, conflict-of-interest editor, case lock. Phase 6: rules, policy and model editors with versioning, impact preview and approval, letter templates, case summary PDF, report export, model shadow mode and feedback export. Phase 7: OCR document cross-check and units selector. Phase 8: PgBouncer, read replica, partitions, row-level security, TOTP, SSO, encryption at rest, virus scan, email and SMS (a `NotificationChannel` interface exists with only the in-app implementation), Hindi labels, integration adapter.
