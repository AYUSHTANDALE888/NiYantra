# Feature inventory (Phase 1 audit)

Audit of the repository on branch `claude/new-session-35imia` at commit `d0f97d9`. A feature is marked **Verified** only when an automated check exercises it end to end: the API test suite (183 Vitest tests), the form check suite (99 pytest tests), or the Playwright demo script (steps 1–11, run twice in a row after a reset). Anything else is marked as partial, mocked or planned.

## Architecture

| Layer | What it is |
|---|---|
| Web | React 18 + Vite + TypeScript, Tailwind with CSS-variable tokens, TanStack Query. Public portal shell (utility bar, header, navigation, notice strip, footer) and a signed-in work shell with a left sidebar. English and Hindi, text size A- to A++, high contrast. |
| API | Node 22, Express 4, zod validation, Prisma 5 on PostgreSQL 16. 73 endpoints in 17 routers. JWT bearer auth, rate limits, helmet. Every case change runs `performAction` in one database transaction with an audit row. |
| Scheduler | Two Node processes; the PostgreSQL advisory-lock holder is the leader and runs the deadline engine every minute (reminders, at-risk, overdue, escalation, flags, digests, scheduled rule publication). |
| Form check | Python FastAPI service: rules sent by the API plus an Isolation Forest trained on synthetic forms. The API falls back to the same rules in Node when the service is down. |
| Rules | Yearly rule packs (cycles, versions, amendments) stored in PostgreSQL with an immutability trigger; every consumer reads them through `api/src/rules/service.ts`. |
| Audit | Append-only `AuditLog` with per-chain SHA-256 hashes (per application, `global`, `rules`); the app role cannot UPDATE or DELETE. |
| Data | Synthetic seed: 2 regions, about 80 users, about 60 institutions, about 190 applications built through the real actions on a back-dated clock; 4 rule pack versions. `npm run demo:reset` restores it in under a second from a template database. |

## Roles (demo accounts, password `demo1234`, synthetic data only)

COLLEGE (`college.abc@demo.in`), OFFICER (`priya@`, `arjun@`, `meena@`, `ravi@` with the EVC desk skill, `officer.west@`), SENIOR (`kumar@`), SUPER_SENIOR (`lakshmi@`), HOD (`hod.south@`), BUREAU (`bureau.head@`), COMMITTEE (`committee1@`…`6@`), AUTHORITY (`authority.south@`), ADMIN (`admin@`), RULE_EDITOR (`rules.editor@`), RULE_APPROVER (`rules.approver@`).

## Features

| # | Feature | Route | Role | Prerequisites | Test steps | Observable success | Status |
|---|---|---|---|---|---|---|---|
| 1 | Public home: cycle schedule, recent changes, quick links, sign in | `/` | anyone | API up | Open `/`; sign in as any demo user | Schedule table and 3 notices visible; redirect to the role home | Verified (demo, axe) |
| 2 | Accessibility controls: A-/A/A+/A++, high contrast, English/हिंदी, skip link | every page | anyone | none | Press each control; reload | Root size changes; light high-contrast theme; Hindi labels; choice survives reload | Verified (axe on 13 public pages × 4 modes × 2 widths) |
| 3 | What changed this cycle (public notices + schedule) | `/notices`, `/college/notices` | anyone | rule packs seeded | Open page | Amendment cards (kind, ref, dates, summary, affected types) and schedule | Verified (API test, demo 11.4) |
| 4 | Track an application | `/track` | anyone | application no + permanent ID | Enter both, Find | Stage, status, route, rules version; wrong pair → "No application matches" | Verified (API test `public-track.test.ts`) |
| 5 | Approval process, help, contact, policies, sitemap | `/process`, `/help`, … | anyone | none | Open pages | Content from current rules; "Prototype text" badge | Verified (axe pages load) |
| 6 | New application with filing context | `/college/apply` | COLLEGE | open application window | Fill the 5 steps | Header "Filing under approval cycle 2027–28 · rules v1"; checklist from the pinned rules | Verified (demo 1) |
| 7 | "Check my entries" form check | `/college/apply` | COLLEGE | — | Built-up > land | R1 HIGH warning; justification required; never blocks | Verified (demo 1, tests) |
| 8 | Hard validation: missing critical document blocks submit | `/college/apply` | COLLEGE | — | Omit land lease | Submit disabled, message names the document | Verified (demo 1, tests) |
| 9 | Purview / eligibility / schedule refusal | API on submit | COLLEGE | — | BBA at a non-technical college; file outside a window | Plain refusal naming the rule or the next window | Verified (tests) |
| 10 | Automatic assignment with reasons | case view | OFFICER | new case | Open the case | "Assigned to Priya Raman … portfolio officer …; utilisation …; Rules 2027-28 v1" | Verified (demo 1, tests) |
| 11 | Scrutiny: complete, return with deficiencies, reply, re-scrutiny | `/cases/:id`, `/college/applications/:id` | OFFICER, COLLEGE | assigned case | Return with items; college replies | Clock pauses (amber), resumes with remaining days to the same officer | Verified (demo 2–4) |
| 12 | Action Center with reasons and fixed order | `/officer` | OFFICER, BUREAU | seeded flags | Open | Rows ordered by escalation, overdue, category, due, filing; each row says why and what next | Verified (tests, demo 2) |
| 13 | Deadline engine: reminders, at-risk, overdue, escalation (L1–L3), digests | background | scheduler | schedulers running | Admin advances time | Escalation to the manager exactly once; reminders at 30/15/7 days once | Verified (demo 5, 9; tests) |
| 14 | Time travel (simulated clock) | `/admin` | ADMIN | DEMO_MODE | Advance N days | Header shows "Simulated date" | Verified (demo 5, 7, 9) |
| 15 | Team dashboard with roll-up and drill-down | `/team` | SENIOR, SUPER_SENIOR, HOD | — | Open | Per-officer figures, ageing chart, escalated to me | Verified (demo 6, tests) |
| 16 | Workforce: overloaded/idle, manual reassign with recommendation | `/workforce` | managers, BUREAU | — | Reassign a task | "Recommended by system" recorded | Verified (demo 6) |
| 17 | Availability: leave releases and reassigns open tasks | `/availability` | OFFICER, managers | — | Add leave from today | Tasks reassigned with reasons | Verified (demo 6) |
| 18 | EVC desk: committee proposal and scheduling | `/evc`, case view | OFFICER with skill | EVC stage | Schedule online for tomorrow | Visit scheduled; appointing authority recorded | Verified (demo 7) |
| 19 | Committee report and SAC/SHC recommendation | `/committee` | COMMITTEE | scheduled visit | Submit report | Case moves to DECISION | Verified (demo 7) |
| 20 | Competent authority decision with conditions | `/authority` | AUTHORITY | DECISION stage | Approve with conditions | Undertakings created with due dates | Verified (demo 8) |
| 21 | Post-approval compliance: evidence, verification, auto close | `/college/compliance`, case view | COLLEGE, OFFICER | undertakings | Upload evidence; officer verifies | Case CLOSED | Verified (demo 9) |
| 22 | Document expiry and renewal | `/college/compliance` | COLLEGE, OFFICER | expiring doc | Upload renewal; verify | Expiry item replaced | Verified (tests) |
| 23 | Notifications bell | header | all signed-in | events | Open bell | Unread count, mark read, jump to case | Verified (demo) |
| 24 | Rules Center: cycles and versions | `/rules` | RULE_EDITOR, RULE_APPROVER, ADMIN, HOD, BUREAU | seed | Open | Cycles, versions, maker, checker, pinned cases | Verified (demo 11) |
| 25 | Draft an amendment, section editors, condition builder, JSON tab | `/rules/versions/:id` | RULE_EDITOR | published version | Add a document, extend a window, save | Changed counts per section; errors shown inline | Verified (demo 11.1) |
| 26 | Apply scope enforcement (live vs new cases) | version page | RULE_EDITOR | changes | Mark a tightening change live, submit | Refused: "…can only apply to new cases." | Verified (demo 11.1, tests) |
| 27 | Diff with relaxing/tightening/neutral classification | `/rules/versions/:id/diff` | staff | draft | Open | Labelled changes with before/after and source | Verified (tests, screenshots) |
| 28 | Impact preview (dry run) | `…/impact` | staff | draft | Open | Sentences: cases moving, newly missing documents, form check counts, who can file | Verified (demo 11.2, tests) |
| 29 | Maker-checker review, approve, reject, publish, schedule | `…/review` | RULE_APPROVER | in review | Approve, publish | Published; approver cannot approve own edits | Verified (demo 11.3, tests) |
| 30 | Pinning and live rebase | case view | — | live relaxing change | Publish SLA extension marked live | Open cases move to new version; due dates move later only | Verified (tests) |
| 31 | College "changes since your last visit" banner | `/college` | COLLEGE | new publish | Sign in | "1 change to the 2027–28 rules since your last visit · View" | Verified (demo 11.4) |
| 32 | Rollback, export, import | version page | RULE_EDITOR | versions | Roll back to v1 | New draft with v1 content | Verified (demo 11.7, tests) |
| 33 | Audit log, filters, Verify integrity, tamper detection | `/admin` | ADMIN | — | Verify; run `demo:tamper`; verify | OK, then "Broken: row N in chain …" | Verified (demo 10) |
| 34 | Access control: scope and ACCESS_DENIED logging | any case URL | wrong-region officer | — | Open a West case as a South officer | No access page; audit row | Verified (demo 10, tests) |
| 35 | Scheduler leader election and failover | background | — | 2 schedulers | Stop the leader | Standby takes over, no alert repeats | Verified (demo 10) |
| 36 | Demo reset | `/admin`, `npm run demo:reset` | ADMIN | DEMO_MODE | Reset | Seed restored in under 1 s | Verified (every demo run) |
| 37 | Style guide (both themes, languages, text sizes) | `/styleguide` | ADMIN | — | Open | Components in standard and contrast | Verified (screenshot) |

## Partial, mocked or planned (excluded from claims in the video)

| Item | State |
|---|---|
| Statistical model in the form check | Real Isolation Forest, but trained and evaluated on synthetic data only (`formcheck/EVALUATION.md`). Locally the Python service is often not running, and the app then shows "Model unavailable: rules only". The video will say "rules plus a statistical model trained on synthetic data" and show the real state. |
| Uploaded documents | Real uploads stored on disk; seed documents are generated placeholder PDFs. |
| Fees | Shown only; no payment is taken. |
| Email and SMS | Not built; only in-app notifications (a channel interface exists). |
| Hindi | Shell, navigation, public pages, notices, sign in, Rules Center labels, roles and status badges. Work-screen bodies stay English. |
| Rule values | Every value in the seeded packs is a placeholder or "modelled on" public reports, not verified against the official handbook. |
| Phases 5–8 (rebalancing suggestions, delegation, OCR, SSO, TOTP, PgBouncer, integrations) | Planned, not built. |
| Docker compose stack | Defined, but this audit ran the services natively (PostgreSQL service, `tsx` API, Vite dev server, schedulers via npm scripts). |

## Known issues found during the audit

- The demo seed's application count varies between 191 and 192 between setups: the assignment tie-break compares random UUIDs. It is harmless and predates the add-on.
- "Track application" had no automated test; `api/test/public-track.test.ts` now covers it (both numbers required, same message for either wrong value).
