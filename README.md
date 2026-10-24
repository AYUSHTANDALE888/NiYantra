# AICTE Approval & Compliance Platform (SIH 2026 prototype)

Working prototype for the Smart India Hackathon 2026 AICTE problem statement *Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System*. This build covers phases 0 to 4 of the final architecture (v3).

The system routes, assigns, reminds, explains and records. It never decides: the only approve or reject is the competent authority's **Decide** action, which always needs a human click and a reason.

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

## Phase status

- [x] Phase 0: foundation (compose stack, roles and audit guard, schema, config, clock, workdays, audit chains, auth, policy skeleton, directory seed, template and reset, design system and shell)
- [x] Phase 1: workflow and assignment (routing, transitions, assignment engine with reasons, availability, uploads, role screens)
- [x] Phase 2: deadline engine and scheduler (deadline items, pause and resume, leader election, reminders, overdue, escalation, digests, time travel, admin controls)
- [ ] Phase 3: Action Center and dashboards
- [ ] Phase 4: post-approval and form check

## Modules

**Workflow.** Each application type has a route (`shared/rules.json`) resolved at submission and stored on the case. A case is one record with a moving pointer: stage, status and holder. Every action goes through `performAction`, which validates the payload, checks `can(user, action, application)` (role, scope, transition table, current holder or assignment, separation of duties), then runs one database transaction that changes the case, moves assignments, updates deadline items, appends the audit row and creates notifications. There is no approve or reject anywhere except the competent authority's Decide.

**Assignment.** When a stage needs an officer, the engine locks the region, loads eligible officers with their live load from open assignments, drops anyone away, over capacity, barred or recused, prefers continuity (the institution's portfolio officer for scrutiny and verification, the returning officer for re-scrutiny), and otherwise picks the lowest score (0.70 projected utilisation, 0.20 recent assignments, 0.10 specialisation mismatch). If no officer in the region qualifies it overflows to the Bureau; if nobody qualifies the task goes to the head of department's queue. Every assignment stores a plain-language reason ("Assigned to Priya Raman (Officer, South): portfolio officer for ABC Engineering College; utilisation 0.15 after this task. 50 eligible; none excluded. Tier 0. Policy v1."). Leave covering today releases and reassigns an officer's open tasks without moving deadlines.

**Deadline engine and scheduler.** Every clock is a deadline item written inside the case transaction: stage deadlines in working days, the EVC scheduling and report deadlines, verification, undertakings and document expiry in calendar days. Returning a case pauses its clock and stores the remaining working days; the reply resumes it. Two scheduler processes run; the one holding a PostgreSQL advisory lock is the leader and runs a cycle every minute (the other waits and takes over within seconds if the leader stops). A cycle sends compliance reminders at 30, 15, 7 and 0 days, an at-risk alert at 80% of a stage deadline, an overdue alert, and escalations at 3, 7 and 14 days overdue up the `reportsTo` chain (HoD when the chain ends; the competent authority also at level 3). A unique key on every alert makes cycles idempotent, so a scheduler that was down catches up once, marking missed reminders late. Weekends and holidays are skipped. The admin's time travel moves a simulated clock that every date comparison uses, and runs a cycle at once.

**Audit.** Every action appends a row to `AuditLog`. Rows are chained per application (and one global chain for non-case events): each row stores `sha256(prevHash + canonicalJSON(row))`, with a per-chain advisory lock so concurrent cases never block each other. The app role has no UPDATE, DELETE or TRUNCATE on the table, and a trigger rejects updates and deletes even from the owner. `GET /api/admin/audit/verify` recomputes every chain and names the first broken row.

Try an update as the app role (rejected):

```bash
docker compose exec db psql -U aicte_app -d aicte -c "UPDATE \"AuditLog\" SET reason = 'x' WHERE id = 1"
```

## Next phases (not built)

Phase 5: rebalancing suggestions and approval, full committee coverage and independence rules, delegation grants, conflict-of-interest editor, case lock. Phase 6: rules, policy and model editors with versioning, impact preview and approval, letter templates, case summary PDF, report export, model shadow mode and feedback export. Phase 7: OCR document cross-check and units selector. Phase 8: PgBouncer, read replica, partitions, row-level security, TOTP, SSO, encryption at rest, virus scan, email and SMS (a `NotificationChannel` interface exists with only the in-app implementation), Hindi labels, integration adapter.
