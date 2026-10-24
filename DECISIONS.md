# Decisions

Choices made where the build spec was silent, plus the design review recorded at the end of each phase.

## Phase 0

- **Repository layout.** The spec's `aicte-platform/` folder is the repository root, so `docker compose up` and `npm run …` run from the top of this repo.
- **Node version.** Containers use Node 20 as specified. The code also runs on Node 22 (used in the build sandbox).
- **Local Postgres.** `npm run setup` starts the compose `db` service by default. `SETUP_NO_DOCKER=1 npm run setup` uses any Postgres 16 reachable through the URLs in `.env` (used in the build sandbox).
- **Database URLs.** `DATABASE_URL` (aicte_app) is used by the API and scheduler, `MIGRATOR_URL` (aicte_migrator) by migrations and the seed, `DEMO_ADMIN_URL` (postgres superuser) only by demo reset, demo tamper and the template build. Role passwords in `db/init/00_roles.sql` are the `.env.example` defaults; change both together.
- **Database names are configurable** (`APP_DB_NAME`, `TEMPLATE_DB_NAME`, defaults `aicte` and `aicte_seed`) so the test suite can use `aicte_test` / `aicte_test_seed` with the same reset code.
- **Demo reset** uses `DROP DATABASE … WITH (FORCE)` (PostgreSQL 13+) to end other sessions, then `CREATE DATABASE aicte TEMPLATE aicte_seed`. The API disconnects Prisma first and reconnects afterwards; schedulers exit on the dropped lock connection and compose restarts them.
- **Clock refresh.** `clock.now()` is synchronous and uses a cached `SimClock.offsetDays`. The API refreshes the cache after time travel and reset, and at most every 5 seconds from request middleware; the scheduler refreshes it at the start of every cycle.
- **`clock.advance(days)`** only moves the offset. The synchronous engine cycle after time travel lives in `engine/timeTravel.ts` (to avoid a circular import between `lib/clock.ts` and the engine).
- **"Today" is UTC**, as specified. Display uses IST for times.
- **Working-day arithmetic.** `addWorkingDays(d, 0)` returns `d`; `workingDaysBetween(a, b)` counts working days in `(a, b]` (negative when `b < a`). "Days to due" for working-day items is `workingDaysBetween(today, due)`.
- **Holidays.** The seed adds six placeholder holidays falling in the six months after the seed date, chosen from a fixed list of national and South Indian holidays (weekday dates first).
- **Login rate limit** counts failed attempts only (`skipSuccessfulRequests`): 10 failed attempts per 15 minutes per IP. Counting successful logins too would lock out a live demo that switches between a dozen users.
- **Stay signed in.** Added `POST /auth/refresh`, which exchanges a still-valid token for a fresh 8-hour token. The client warns 2 minutes before expiry.
- **ACCESS_DENIED rows** go to the global audit chain with the application id in `meta`, so a refused request never writes into a case chain the user cannot see.
- **Audit `verifyChains()`** loads all rows in id order; enough for demo scale (partitioning and streaming are phase 8).
- **Admin scope.** ADMIN has no application scope (`/applications` returns nothing); case history is read through the admin audit log, filtered by application number.
- **Formcheck stub (phase 0)** returns 503 on `/health` and `/score`, so `/health` on the API reports `formcheck: "down"`.
- **Container builds** could not be run in the build sandbox (no package mirror access from build containers). The compose stack is standard and builds on a normal machine; all behaviour was verified with the same services run as local processes against PostgreSQL 16.

### Design review, phase 0

| Check | Result |
|---|---|
| One primary action per view | Login: "Sign in" only. Placeholder pages have none. Style guide shows variants deliberately. |
| Tokens only | All colours, sizes, radii and shadows come from `tailwind.config.ts`; the theme replaces Tailwind's palette so no other colour classes exist. No arbitrary values (`-[…]`) in the client. |
| Tables for lists | `Table` is the only list component; card grids are used for stat tiles only. |
| Sentence case | All strings in `strings/en.ts` are sentence case. |
| Status never colour-only | `StatusBadge` always pairs an icon and a label; `Tracker` adds icons and screen-reader state text. |
| Loading, empty, error | `Table`, `Skeleton`, `EmptyState`, `ErrorState` in the style guide. |
| Keyboard path | Skip link, visible 2px focus ring, tabs and segmented control with arrow keys, dialogs trap and return focus, Escape closes dialogs and menus, rows open with Enter. |
| Nothing from 11.6 | No gradients, shadows only on overlays, radius 6/8px, system font, no emoji or "AI" labels. |
| axe | Login, all 13 named landing pages and the style guide: 0 serious or critical issues (axe-core via Playwright). |

## Phase 1

- **RETURN releases the scrutiny assignment** (transition table: "release assignment (RETURNED) and remember previousOfficerId"), so the officer's capacity is freed while the college holds the case. Section 2.3 says the assignment "stays open"; the transition table was followed. The paused stage item stays the responsibility of the officer who returned it.
- **Deadline items are written by the phase 1 transitions** (stage clocks, pause and resume, EVC schedule and report items) because the actions and their side effects are one transaction. Phase 2 adds the engine that reads them.
- **Required documents for the form check's `docs_ratio`** are the critical documents of the type. `docs_ratio` is unknown (rule R3 skipped) until the applicant reaches the documents step.
- **Hard validation** at submission (and in `/forms/validate` as `requiredMissing`): at least one course with intake and the faculty count for every type; land area, built-up area, laboratories and lease expiry for types whose checklist includes the land lease; intake increase for INTAKE_INCREASE; proposed name for NAME_CHANGE.
- **A submission without an earlier form check** runs one at submit time so every application is linked to a FormCheckResult.
- **Uploads on submit and reply** are multipart: `files[]` plus a `fileMeta` JSON array of `{kind, expiryDate}` in the same order. Critical documents that have an expiry must carry an expiry date.
- **Scrutiny completion verifies the documents on file** (sets `verified`, `verifiedById`), which is what DECIDE uses for the DOC_EXPIRY items.
- **REPLY uploads supersede** the earlier document of the same kind (`supersedesId`); the case view shows the current version and how many it replaces.
- **SUBMIT_EVC_REPORT** is accepted on or after the visit date. The recommendation values are `RECOMMEND_APPROVAL`, `RECOMMEND_CONDITIONS`, `RECOMMEND_REJECTION` and are advisory.
- **SUBMIT_RECOMMENDATION** (SAC/SHC) may be submitted by any committee member once the case is forwarded.
- **Assignment availability rule.** An officer is unavailable when a period covers today and, for non-urgent tasks, also the next working day (urgent tasks need today). Urgent = the task's deadline item is due within 3 working days or overdue.
- **Bureau overflow** takes both the region lock and `assign:bureau`, because the Bureau pool is shared across regions.
- **No-eligible-officer queue** is the set of open BLOCKED flags whose `sourceItemId` is `assign:<TASK>:<ref>` and whose task still has no open assignment. HoD (region) and Bureau work it through `POST /assignments/unassigned/assign` (added; the spec lists the queue but no endpoint to take a task from it).
- **Manual reassignment eligibility.** The target must be eligible for the task type (tier 0 or tier 1 role, skill) and pass every hard filter; the engine's own pick (excluding the current holder) is stored as `recommendedOfficerId`.
- **Specialisation mismatch** counts any assignment in the last 30 days on an application of the same category.
- **"Recused"** is a released assignment with reason `RECUSED`; there is no recusal action until phase 5, so the filter exists but never fires.
- **Application numbers** are `S-2026-0001` / `W-2026-0001` (region letter, year of the simulated clock, running number).
- **Colleges see a desk, not a name** ("Scrutiny officer, South"), and their case history omits internal workload events (assignments, releases, escalations, labels).
- **After an action that moves the case off the user's desk** (for example scheduling releases the EVC desk task), the client returns to the user's home page with a confirmation instead of showing "no access".
- **`GET /assignments/my-load`** (added) feeds the officer's utilisation bar.

### Design review, phase 1

| Check | Result |
|---|---|
| One primary action per view | Case view: the first permitted action is primary, Return is destructive, the rest secondary. Apply: Continue or Submit. College home: Start a new application. |
| Tokens only | New width tokens (`w-num`, `min-w-content`, `h-table`) live in the config. No arbitrary values. |
| Tables for lists | Applications, tasks, queues, deadlines, history and availability are tables. |
| Sentence case | Yes. Buttons name the result ("Return to college", "Complete scrutiny", "Schedule visit"). |
| Status never colour-only | Status badges carry icon and label; the tracker has icons and screen-reader state. |
| Loading, empty, error | Every list uses `Table` states; case views show skeletons and an error state with retry. |
| Keyboard path | Rows open with Enter; dialogs trap focus; the apply form has an error summary that takes focus and links to fields. |
| Nothing from 11.6 | Checked. The form check is "Check my entries" everywhere. |
| axe | College home, apply, college case, officer, case view (officer and authority), EVC, committee, authority, Bureau and availability: 0 serious or critical issues. |
