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
