# Plan: building the Accountable MVP

This plan is written so an engineer can build the MVP from it alone, one phase per session. It carries every rule, shape and number needed. `docs/intent.md` says why, `docs/spec.md` says what in prose, and `docs/mockups/b-dashboard.png` and `b-pipeline.png` show the chosen look. If this plan and the spec disagree, the spec wins and this plan gets fixed. Requirement IDs in brackets (G1, T6, D4a…) are the spec's, so tests can name them.

Sections: [Summary](#summary) · [Ground rules](#ground-rules) · [Files that change](#files-that-change) · [Order of work](#order-of-work) · [What this could break](#what-this-could-break) · [Risks](#risks) · [Decided against](#decided-against) · [Proof](#proof) · [Reference](#reference) (data model, rules, API, sample data, design).

## Summary

- **What's built:** a sales CRM that runs on one computer. A FastAPI backend keeps the data in a SQLite file. A React app shows five sections in the browser: Dashboard, Organizations, Contacts, Deals and Pipeline.
- **Commands** (repo root, after the one-off install in STATUS):
  - `npm run dev` starts both at `http://localhost:5173`.
  - `npm run seed` resets the data to the sample data.
  - `npm test` runs every test without touching your data.
- **Order:** skeleton → data → API → frontend basics → lists and pages → pipeline → dashboard → finish.
- **Riskiest step:** Phase 5, drag and drop on the pipeline (see [Risks](#risks)).
- **Most likely to stall:** Phase 0, installing packages through the corporate proxy.

## Ground rules

These apply to every phase.

1. **Start of each session:** read this plan, `docs/STATUS.md` and the phase you're building. Run `npm test` before changing anything, so you know what passed before you started.
2. **End of each phase:**
   - `npm test` passes.
   - Add one line to `docs/STATUS.md` saying what's done, plus anything a later phase must know.
   - Commit with the message `Build: phase N`.
3. **Tests sit beside the code.** Every rule gets a test in the phase that builds it. Don't change a test to make it pass unless the test itself is wrong; if it is, say so in STATUS.
4. **No raw SQL.** Every query uses SQLAlchemy Core expressions. `text()` is allowed only for `PRAGMA foreign_keys=ON`.
5. **The backend owns the rules.** Stage rules, late flags, positions, date windows and dashboard figures are computed on the server. The frontend shows them and doesn't work them out again. The one exception is optimistic board totals while a move is saving (P6).
6. **"Today"** is the date on the computer running the backend, unless `ACCOUNTABLE_TODAY=YYYY-MM-DD` is set. Tests set it. The backend gives the frontend its "today" and "now" through `GET /api/meta`. The frontend never uses the browser's date for anything that matters: "Today" and "Yesterday" labels, the activity form's default time, and optimistic close dates all come from `/api/meta`. Otherwise e2e tests, which fix the backend's date but not the browser's, would disagree with themselves.
7. **Nothing beyond the spec.** No global search, board filters or "Late only" chip, even though mockup B shows them. No features from the spec's out-of-scope list. Ideas go in STATUS under "Later".
8. **Leave alone:** `README.md`, `course/`, `community_contributions/`, `.claude/skills/`, `.mcp.json`.
9. **Library versions:** take the latest stable version of each library at install time and let `package-lock.json` and `uv.lock` pin them. Don't pin by hand unless something breaks, and say why in STATUS if you do.

## Files that change

The repo has no app code yet, so almost everything is new.

### Repo root

| File | Change |
| --- | --- |
| `package.json` | New. `"private": true`, `"workspaces": ["frontend"]`, the scripts below, and dev dependencies `concurrently` and `@playwright/test` |
| `package-lock.json` | New, made by `npm install` |
| `pyproject.toml` | New. Python project `accountable`, `requires-python = ">=3.12,<3.13"`, `[tool.uv] package = false`. Dependencies: `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2`, `pydantic>=2`, `email-validator`, `faker`. Dev group: `pytest`, `httpx`. `[tool.pytest.ini_options] testpaths = ["backend/tests"]`, `pythonpath = ["."]` |
| `uv.lock` | New, made by `uv lock` |
| `.python-version` | New, `3.12` |
| `.gitignore` | Add `data/` |
| `playwright.config.ts` | New (see [Phase 0](#phase-0-skeleton-and-tooling)) |
| `scripts/dev.mjs` | New. Makes `data/` if missing, then runs `concurrently` with the two servers. Kills both on Ctrl+C |
| `scripts/check-env.mjs` | New. Run by `dev` and `test` first. Checks that Node is version 24 or later and that `uv` can be found, and says how to install either in plain words |

Root scripts:

```json
{
  "dev": "node scripts/check-env.mjs && node scripts/dev.mjs",
  "seed": "uv run python -m backend.app.seed",
  "test": "node scripts/check-env.mjs && npm run test:frontend && npm run test:backend && npm run test:e2e",
  "test:frontend": "npm run test -w frontend",
  "test:backend": "uv run pytest",
  "test:e2e": "playwright test"
}
```

`&&` works in npm scripts on Windows, Mac and Linux. The scripts set no environment variables, because that syntax differs between shells. Defaults live in `backend/app/config.py`, and the test runners set their own variables.

### Backend (`backend/`)

| File | Contents |
| --- | --- |
| `backend/__init__.py`, `backend/app/__init__.py`, `backend/app/routers/__init__.py`, `backend/app/services/__init__.py`, `backend/tests/__init__.py` | Empty package markers |
| `backend/app/config.py` | `REPO_ROOT` (from this file's path, not the current directory), `db_path()` (`ACCOUNTABLE_DB`, default `REPO_ROOT/data/accountable.db`), `today()` (`ACCOUNTABLE_TODAY` or `date.today()`), `now()` (today's date with the current local time), `test_mode()` (`ACCOUNTABLE_TEST_MODE == "1"`) |
| `backend/app/db.py` | `make_engine(path)`, with a connect event that runs `PRAGMA foreign_keys=ON`. `init_db(engine)` creates the tables if missing, and seeds if the organizations table is empty and the file was just created. A FastAPI dependency gives each request a connection inside `engine.begin()` |
| `backend/app/schema.py` | `MetaData` and the five tables, with constraints and indexes ([Data model](#data-model)) |
| `backend/app/stages.py` | `STAGES` (ordered keys), `OPEN_STAGES`, `CLOSED_STAGES`, `STAGE_NAMES`, `USUAL_PROBABILITY` |
| `backend/app/models.py` | Pydantic models for every request and response in [API](#api), with the checks |
| `backend/app/listing.py` | `apply_listing(select, q, search_cols, sort, dir, sort_cols, page, page_size)`: case-insensitive `LIKE` search with `%` and `_` escaped, sort from an allow-list with nulls last and `id` as the tie-break, paging, and the total count |
| `backend/app/services/deals.py` | `create_deal`, `update_deal`, `move_deal`, `delete_deal`, `renumber(stage)`, `record_stage_change`. All stage rules live here ([Rules](#rules)) |
| `backend/app/services/timeline.py` | Contact and deal timelines |
| `backend/app/services/dashboard.py` | Every dashboard figure ([Dashboard figures](#dashboard-figures)) |
| `backend/app/routers/meta.py` | `GET /api/meta`, `GET /api/health`, and `POST /api/test/reset`, which exists only in test mode |
| `backend/app/routers/organizations.py`, `contacts.py`, `deals.py`, `activities.py`, `pipeline.py`, `dashboard.py` | The endpoints in [API](#api) |
| `backend/app/main.py` | `create_app(db_path=None)`, which builds the engine, runs `init_db` and includes the routers. Also `app = create_app()` for uvicorn |
| `backend/app/seed.py` | `seed(conn, today, rng)` builds the sample data ([Sample data](#sample-data)). `main()`, run by `python -m backend.app.seed`, backs up the current file and resets it |
| `backend/tests/conftest.py` | Fixtures. `today` is fixed at 2026-11-26. `engine` is a temporary SQLite file per test. `client` is an `httpx`/`TestClient` app on that file. Factories `make_org`, `make_contact`, `make_deal`, `make_activity` take only the fields a test cares about. Also a guard: fail at once if `ACCOUNTABLE_DB` resolves to `data/accountable.db` |
| `backend/tests/test_*.py` | Listed in [Proof](#proof) |

### Frontend (`frontend/`)

| File | Contents |
| --- | --- |
| `frontend/package.json` | Name `frontend`. Scripts: `dev` (`vite`), `build` (`tsc -b && vite build`), `test` (`vitest run`). Dependencies: `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-hook-form`, `zod`, `@hookform/resolvers`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `lucide-react`, `date-fns`, `sonner`, `@fontsource/instrument-sans`, `@fontsource/instrument-serif`, `@fontsource/jetbrains-mono`. Dev dependencies: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/react`, `@types/react-dom` |
| `frontend/vite.config.ts` | React plugin. `server.port` from `WEB_PORT` (default 5173) with `strictPort: true`. Proxy `/api` to `http://127.0.0.1:${API_PORT ?? 8000}`. Vitest: `environment: "jsdom"`, setup file, `include: ["src/**/*.test.{ts,tsx}"]` |
| `frontend/tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html` | Standard Vite React TypeScript setup with `strict: true`. `index.html` has `<title>Accountable</title>` and an inline SVG favicon, so there's no 404 in the console |
| `frontend/src/main.tsx` | Imports fonts and styles, then renders `<App/>` |
| `frontend/src/App.tsx` | `QueryClientProvider`, `Toaster`, router with the routes in [Screens](#screens) and a not-found page |
| `frontend/src/test/setup.ts` | `@testing-library/jest-dom`, and stubs for `ResizeObserver` and `matchMedia` |
| `frontend/src/styles/tokens.css` | CSS variables from [Design](#design) |
| `frontend/src/styles/global.css` | Base styles, and the `.num` class for JetBrains Mono with tabular figures |
| `frontend/src/lib/format.ts` | `usd`, `usdShort`, `percent`, `formatDate`, `formatDateTime`, `relativeDay` ([Formats](#formats)) |
| `frontend/src/lib/stages.ts` | The same stage list as `backend/app/stages.py`, plus colors |
| `frontend/src/lib/urlState.ts` | `useListState()` reads and writes `q`, `sort`, `dir`, `page` and `status` in the URL search params |
| `frontend/src/lib/useDebounced.ts` | 250 ms debounce for search (T1) |
| `frontend/src/api/client.ts` | `api.get/post/patch/delete`. Throws `ApiError` with `status` and FastAPI's `detail` |
| `frontend/src/api/types.ts` | TypeScript types matching [API](#api) |
| `frontend/src/api/hooks.ts` | TanStack Query hooks for each resource. Each mutation invalidates the queries it affects ([Cache invalidation](#cache-invalidation)) |
| `frontend/src/components/TopBar.tsx` | Mockup B's top bar |
| `frontend/src/components/PageHeader.tsx` | Title on the left, actions on the right |
| `frontend/src/components/Panel.tsx` | White panel with title and subtitle |
| `frontend/src/components/DataTable.tsx` | TanStack Table in manual mode: search box, sortable headers, rows, row menu, paging bar, empty state |
| `frontend/src/components/Dialog.tsx`, `ConfirmDialog.tsx` | Radix dialog, and the delete confirmation ([Delete dialog wording](#delete-dialog-wording)) |
| `frontend/src/components/EntityPicker.tsx` | Radix popover with a search box over `/options`. Supports "none" when the field is optional |
| `frontend/src/components/badges.tsx` | `StageBadge`, `StatusBadge`, `LateBadge` |
| `frontend/src/components/Money.tsx`, `EmptyState.tsx`, `ErrorState.tsx` | Small pieces |
| `frontend/src/components/Timeline.tsx`, `ActivityForm.tsx` | The timeline, and the log and edit activity form |
| `frontend/src/features/organizations/` | `OrganizationsPage.tsx`, `OrganizationPage.tsx`, `OrganizationForm.tsx` |
| `frontend/src/features/contacts/` | `ContactsPage.tsx`, `ContactPage.tsx`, `ContactForm.tsx` |
| `frontend/src/features/deals/` | `DealsPage.tsx`, `DealPage.tsx`, `DealForm.tsx`, `LostReasonDialog.tsx` |
| `frontend/src/features/pipeline/` | `PipelinePage.tsx`, `Board.tsx`, `OpenColumn.tsx`, `ClosedColumn.tsx`, `DealCard.tsx`, `ClosedRow.tsx`, `boardState.ts` (pure functions: apply a move, totals) |
| `frontend/src/features/dashboard/` | `DashboardPage.tsx`, `HeadlinePanel.tsx`, `RevenueBars.tsx`, `PipelinePanel.tsx`, `StageStrip.tsx`, `StageBars.tsx`, `Funnel.tsx`, `RunningTotalLine.tsx`, `WonLostBars.tsx`, `FollowUps.tsx`, `FollowUpsDialog.tsx`, `RecentActivity.tsx`, `ChartTooltip.tsx` |
| `frontend/src/**/*.test.ts(x)` | Listed in [Proof](#proof) |

### End-to-end tests (`e2e/`)

| File | Contents |
| --- | --- |
| `e2e/fixtures.ts` | A Playwright `test` that, before each test, calls `POST http://127.0.0.1:8100/api/test/reset`. Afterwards it fails the test if the page logged any console error or warning, or threw an uncaught error (G7) |
| `e2e/helpers.ts` | `api(request)` helpers that read the seeded data, so tests look up names and ids instead of hard-coding them. `dragCard(page, card, target)` drags with mouse steps, since dnd-kit ignores a single-step drag |
| `e2e/*.spec.ts` | Listed in [Proof](#proof) |

### Docs

| File | Change |
| --- | --- |
| `docs/STATUS.md` | Phase 0: a "How to run" section for a non-technical user. Then one line after each phase |
| `docs/spec.md` | Already updated with this plan: the move endpoint takes `before_id` instead of `index` ([Decided against](#decided-against)). Otherwise change it only if building shows the spec is wrong, with a note in STATUS |

## Order of work

Eight phases, each a commit point. Within a phase, work top to bottom. "Done when" is the exit check for the phase.

### Phase 0: Skeleton and tooling

1. **Install check.**
   - Confirm `node -v` is 24 or later, `uv --version` works, and Google Chrome is installed.
   - Behind the corporate proxy, see the first row of [Risks](#risks) before installing anything.
2. **Python side.**
   - Write `pyproject.toml` and `.python-version`, then run `uv sync`.
   - Write `backend/app/main.py`, with `create_app()` and `GET /api/health` returning `{"ok": true}`.
3. **Frontend side.**
   - Scaffold `frontend/` by hand from the file list. Don't use `npm create vite`: it adds files we don't want.
   - Write `App.tsx` with one page that fetches `/api/health` and shows "Accountable".
4. **Root files.**
   - Write the root `package.json`, `scripts/check-env.mjs` and `scripts/dev.mjs` (G1), and add `data/` to `.gitignore`.
   - Run `npm install`, then `npx playwright --version` (no browser download needed: we use the installed Chrome).
5. **`playwright.config.ts`:**
   - `testDir: "e2e"`, `fullyParallel: false`, `workers: 1`, `retries: 0`.
   - `use: { baseURL: "http://localhost:5273", channel: "chrome", trace: "retain-on-failure" }`.
   - `webServer`, two entries, both with `reuseExistingServer: false`:
     1. `uv run uvicorn backend.app.main:app --host 127.0.0.1 --port 8100`, with env `ACCOUNTABLE_DB=data/e2e.db`, `ACCOUNTABLE_TEST_MODE=1`, `ACCOUNTABLE_TODAY=2026-11-26`, waiting on `http://127.0.0.1:8100/api/health`.
     2. `npm run dev -w frontend`, with env `WEB_PORT=5273`, `API_PORT=8100`, waiting on `http://localhost:5273`.
6. **One trivial test in each suite:** `format.test.ts` checks `1 + 1`, `test_health.py` calls `/api/health`, and `start.spec.ts` sees "Accountable".
7. **`docs/STATUS.md`:** replace the opening with a "How to run" section:
   - install Node.js (LTS) from nodejs.org;
   - install uv with the command from docs.astral.sh/uv (uv downloads Python 3.12 itself on first use);
   - install Google Chrome (only needed for tests);
   - then `npm install` once, `npm run dev` to start, and open `http://localhost:5173`;
   - also `npm run seed` and `npm test`.

**Done when:**
- `npm run dev` shows the placeholder at `http://localhost:5173`, and Ctrl+C stops both servers.
- `npm test` passes.
- `npm test` fails when one test in each suite is broken on purpose (G5). Then put them back.

### Phase 1: Data and sample data

1. **Tables.** `schema.py`, `stages.py`, `config.py` and `db.py`, exactly as in [Data model](#data-model), including the check that an activity has exactly one of contact or deal (A2).
2. **Stage rules.** `services/deals.py`, covering every rule in [Rules](#rules): creating a deal, changing its stage, moving it and renumbering positions, deleting it, and recording stage changes (D7).
3. **Sample data.** `seed.py`, built to [Sample data](#sample-data) (S1–S5). Every service function takes an optional `at` timestamp (default `config.now()`), and the seed passes historical times. That way seeded history follows the same rules as live history, and `created_at`, `changed_at` and close dates line up.
4. **The seed command (G3):**
   - Copy the current `data/accountable.db`, if there is one, to `data/accountable.backup.db`, overwriting the old copy.
   - Drop all tables, create them, and seed, all in one transaction.
   - Print `Sample data loaded: 20 organizations, 60 contacts, 40 deals, 150 activities. Your previous data was saved to data/accountable.backup.db. Refresh the browser to see it.`
   - It works with `npm run dev` still running: SQLite lets the seed take its own write transaction, and the next request sees the new data.
5. **Startup.** `main.py` calls `init_db` on startup. A missing file is created and seeded (G2); an existing one is left alone.

**Done when:** the [Proof](#proof) tests for `test_schema.py`, `test_stage_rules.py`, `test_positions.py`, `test_seed.py` and `test_startup.py` pass.

### Phase 2: Backend API

1. **Shared pieces.**
   - `models.py` and `listing.py`.
   - `routers/meta.py` with `/api/meta`, `/api/health` and `/api/test/reset`. The reset endpoint is registered only when `test_mode()` is on. It reseeds in one transaction with the fixed seed and `today()`.
2. **Organizations, contacts and deals routers,** with lists, detail, create, update, delete, delete-impact and options. Every write commits before the response is sent (G4).
3. **Activities router.** Contact and deal timelines through `services/timeline.py`.
4. **Pipeline router:** `GET /api/pipeline` and `POST /api/deals/{id}/move`.
5. **Dashboard router:** `GET /api/dashboard` and `GET /api/follow-ups`, through `services/dashboard.py`, over the rolling 12 months (H1).

**Done when:**
- The remaining backend tests in [Proof](#proof) pass.
- `http://127.0.0.1:8000/docs` lists every endpoint in [API](#api).

### Phase 3: Frontend foundation

1. **Fonts and styles.**
   - In `main.tsx`, import the fonts: `@fontsource/instrument-sans/400.css`, `500.css`, `600.css`, `700.css`, `@fontsource/instrument-serif/400.css`, `@fontsource/jetbrains-mono/400.css` and `600.css`.
   - Write `tokens.css` and `global.css` from [Design](#design).
2. **Layout and routes.** `TopBar`, `PageHeader` and `Panel`, the router with every route, and an empty page per route with its title.
3. **Data layer.**
   - `api/client.ts`, `types.ts` and `hooks.ts`, with every mutation invalidating the queries in [Cache invalidation](#cache-invalidation) (G4, H9).
   - Toasts as in [Messages](#messages).
   - A `useToday()` hook from `/api/meta`.
4. **Helpers.** `lib/format.ts` (G8), `stages.ts`, `urlState.ts` and `useDebounced.ts`, with their tests.
5. **Shared components.** `DataTable`, `Dialog`, `ConfirmDialog`, `EntityPicker`, the badges, `Money`, `EmptyState` and `ErrorState`, with their tests.
6. **Drag-and-drop spike.** Build a throwaway `/__spike` route with two stacked drop areas in one column and a sortable list beside it, using dnd-kit with mouse and keyboard sensors. Check that you can:
   - drop into the lower area of the stacked column;
   - reorder within a list;
   - do both by keyboard.

   Delete the route once it works, and note in STATUS what you learned. This takes the riskiest unknown out of Phase 5 early.

**Done when:** every section opens from the top bar with the right title and no console errors (G7), the shared component tests pass, and the spike has worked and been deleted.

### Phase 4: Lists, forms and record pages

0. **E2e plumbing.** Write `e2e/fixtures.ts` and `e2e/helpers.ts` (see [Files that change](#end-to-end-tests-e2e)), and move `start.spec.ts` onto the fixture. Every later e2e spec imports `test` from `fixtures.ts`, never from `@playwright/test` directly.
1. **Organizations:**
   - list (O1, T1–T8);
   - form in a dialog, for adding and editing (O2);
   - record page (O3);
   - delete with the impact dialog (O4, T6).

   After a delete from the record page, go to `/organizations`.
2. **Contacts:**
   - list with the status filter, using a segmented control and counts (C1, C2);
   - form with the email check and the organization picker (C3);
   - record page with their deals and timeline (C4);
   - delete (C5).
3. **Deals:**
   - list with stage badges and Late badges (D1, D6);
   - form with the stage and probability behaviour and the lost reason (D2, D3, D4, D4a);
   - record page with the timeline (D8);
   - delete (D9).
4. **Activities:**
   - "Log activity" on contact and deal pages (A1);
   - the timeline (A3, A4);
   - edit, delete and mark done (A5, A6).

**Done when:** the frontend tests for these forms and components pass, and the e2e specs `organizations`, `contacts`, `deals` and `timelines` pass.

### Phase 5: Pipeline

1. **Board data and summary.** `PipelinePage` loads `/api/pipeline` and shows the summary panel with the stage strip (P3).
2. **Columns.**
   - `OpenColumn` for the four open stages, with header, cards in position order and "Add deal" (P1, P4, P7).
   - `ClosedColumn` with Won above Lost, each with its own header, rows and "Add deal". Won's rows scroll inside a box no taller than five rows (P1, P2).
3. **Drag and drop** with dnd-kit `DndContext` (P5, P8):
   - Sensors:
     - `PointerSensor` with an activation distance of 6px, so a click still opens the deal;
     - `KeyboardSensor` with `sortableKeyboardCoordinates`.
   - Six droppable containers, one per stage, each a `SortableContext` with `verticalListSortingStrategy`. An empty column or block must still accept drops (`useDroppable` on the container).
   - Collision detection: `closestCorners`, so keyboard arrows can move a card into the next column.
   - A `DragOverlay` shows the lifted card, with a stronger shadow and a 2° tilt. The drop place shows a dashed outline.
   - Screen-reader announcements name the deal and the stage.
4. **The move itself.** On drop, work out `before_id` (the deal now directly below the dropped card, or `null` for the bottom), then:
   - **Dropped into Lost from another stage:** show the card in Lost where it was dropped, without sending anything yet, and open `LostReasonDialog`.
     - Save sends the move with the reason; Skip sends it without one.
     - Cancel or Escape puts the board back and sends nothing (D5).
   - **Any other drop:**
     - apply the move to the cached board at once with `boardState.applyMove`, which also updates totals (P6);
     - send the move;
     - on error, restore the previous board and show the toast "Couldn't move the deal. Try again.";
     - on success, invalidate the queries in [Cache invalidation](#cache-invalidation).
   - **Dropped where it started:** send nothing.
5. **Optimistic moves into Won or Lost.** The card's probability shows the new stage's usual value and its close date shows today straight away, so the totals are right before the server replies.

**Done when:** `boardState.test.ts` and the `pipeline` e2e spec pass, including keyboard moves and the checks after a refresh.

### Phase 6: Dashboard

1. **Layout.** A main area beside a 380px right-hand column ([Screens](#screens)).
2. **Headline panel and revenue bars** (H2, H3). If nothing was won in the 12 months, show "No deals won in the last 12 months." instead of the best-month sentence.
3. **Pipeline panel** (H2, H5, H6), with an "Open the board" link to `/pipeline`.
4. **Bottom row:** the running total line and the won and lost bars (H3, H4).
5. **Right-hand column:**
   - Follow-ups (H7) with a done checkbox (A6), and "Show all", which opens `FollowUpsDialog` with every open follow-up from `/api/follow-ups`.
   - Recent activity (H8).
6. **Charts.**
   - Every chart has a tooltip with exact values.
   - Every chart has a `role="img"` wrapper with an `aria-label` that sums it up in a sentence, built from the data (for example "Revenue won per month, highest in April at US$41,500").
   - Recharts' `ResponsiveContainer` sits in a parent with a fixed height, so it never measures zero and warns.

**Done when:** the `dashboard` e2e spec passes, and the figures on screen match the hand-checked figures in `test_dashboard.py`.

### Phase 7: Finish and prove

1. **Performance (G6).**
   - Load 5,000 organizations, contacts, deals and activities into `data/perf.db`, with a throwaway script run by `uv run python -m backend.tests.perf_data` (kept in the tests folder, not run by pytest).
   - Start the backend on it, then time `GET /api/organizations?q=a`, `/api/contacts?q=a`, `/api/deals?q=a`, `/api/pipeline` and `/api/dashboard`, five times each.
   - Each must be under 300 ms on this laptop, leaving room for the frontend in the 500 ms budget. Fix any slow query with an index or a better query, and record the timings in STATUS.
2. **Accessibility.**
   - Tab through every screen and check focus is visible everywhere.
   - Every dialog traps focus and returns it on close.
   - Every text color matches the [Design](#design) table.
3. **Cross-checks.**
   - Run the e2e suite twice in a row to catch tests that depend on order.
   - Run `npm run build -w frontend` to catch type errors.
4. **Visual check.** Compare the dashboard and the pipeline with `docs/mockups/b-dashboard.png` and `b-pipeline.png` using Playwright screenshots at 1600 × 1000. Differences other than the agreed ones in [Design](#design) get fixed.
5. **Walk-through (success criterion 8).** A person uses every section and action in Chrome with the console open: add, search, sort, page, edit and delete in each table; log and finish a follow-up; drag cards, including to Won and Lost; reset with `npm run seed`. Problems found are fixed and noted in STATUS.
6. **STATUS.** Bring `docs/STATUS.md` up to date: how to install, run, reset and test, what's done, and any "Later" ideas.

**Done when:** every item in [Proof](#proof) passes, the walk-through finds nothing left to fix, and STATUS says the MVP is done.

## What this could break

| What | How | Guard |
| --- | --- | --- |
| Your own data | `npm run seed` wipes it by design. A test pointed at the wrong file could wipe it by mistake | Seed backs up to `data/accountable.backup.db` first. Tests use `data/e2e.db` and temp files, and `conftest.py` refuses to run against `data/accountable.db`. `/api/test/reset` exists only in test mode |
| A running dev server | E2e tests starting on 5173 or 8000 would hit, or reuse, your dev servers and dev data | E2e uses ports 5273 and 8100 with `reuseExistingServer: false` and `strictPort` |
| Other apps on ports 5173 or 8000 | `npm run dev` fails if something else holds the port | Vite's `strictPort` and uvicorn both fail with a clear "address in use" message. STATUS says how to find and stop the other app |
| Test discovery | pytest or Vitest could pick up files in `course/` or `community_contributions/` | `testpaths` for pytest, `include` for Vitest, `testDir` for Playwright |
| Course checkpoints | The course's branches (for example `week1day3-end`) have their own root `package.json` and `pyproject.toml`, so merging one later will conflict | Don't merge course branches into `mvp`. Compare them by checking them out separately |
| The Playwright MCP server | `.mcp.json` runs `@playwright/mcp@latest` through `npx`. A root `@playwright/test` install could seem to clash | They're separate packages with separate browser setups. Leave `.mcp.json` alone and check the MCP still starts after Phase 0 |
| The brand | Building could drift from the brand skill's colors | `tokens.css` is copied from [Design](#design), which follows the brand skill. The Phase 7 visual check compares with mockup B |
| Upstream | Pushing to `upstream` (ed-donner/accountable) would be wrong | Push only to `origin`, the fork |

## Risks

### The riskiest step

**Phase 5, steps 3 to 5: drag and drop on the pipeline.** It's where most things meet:

- dnd-kit's sortable lists across six containers, two of them stacked in one column;
- keeping the exact drop position, including in Won and Lost columns that hide older deals;
- optimistic totals with rollback;
- a dialog that interrupts the drop for Lost;
- keyboard dragging;
- tests that have to drive all of this through a real browser.

A mistake here can look fine on screen and still save the wrong position, which success criterion 4 checks after a refresh.

How the plan reduces the risk:
1. The Phase 3 spike proves stacked drop areas and keyboard moves before any real board exists.
2. The server decides positions from `before_id`, so the client never computes positions for hidden deals.
3. `boardState.ts` keeps the optimistic logic in pure functions with unit tests.
4. Every e2e pipeline test checks the result after a refresh, not just on screen.

### The step most likely to stall

**Phase 0, installing packages.** This machine is behind the Netskope proxy, which re-signs HTTPS. `gh` already failed on it until the Miniconda `SSL_CERT_FILE` and `SSL_CERT_DIR` variables were cleared. `npm install`, `uv sync` and `uv python install` may fail the same way. Fixes, in order:

1. Clear the two variables for the shell:
   - Git Bash: `unset SSL_CERT_FILE SSL_CERT_DIR`
   - PowerShell: `Remove-Item Env:SSL_CERT_FILE, Env:SSL_CERT_DIR`
2. If uv still fails, use the Windows certificate store with `uv --native-tls` or `UV_NATIVE_TLS=1`.
3. If npm still fails, export Netskope's root certificate from the Windows store (certmgr → Trusted Root Certification Authorities) and point npm at it with `npm config set cafile <path>`. That's user config, not the repo.

Never turn off certificate checks (`strict-ssl false`).

### Other risks

| Risk | What could happen | What we'll do |
| --- | --- | --- |
| Non-technical setup | Installing Node.js and uv is the hardest part of success criterion 1 | Plain step-by-step notes in STATUS. `check-env.mjs` says what's missing and where to get it |
| Dates in tests | Late flags, the 30-day window, follow-ups and the 12 months depend on today, so tests could pass today and fail tomorrow | One `today()` in the backend, set by `ACCOUNTABLE_TODAY` in every test run. The frontend uses `/api/meta` for "Today" and "Yesterday" |
| Funnel accuracy | The funnel depends on stage history. A wrong history gives a wrong funnel that looks fine | Unit tests on hand-built histories. The seed writes history through the same service as the API |
| SQLite cascades | SQLite ignores foreign keys unless they're turned on for each connection, so deletes could leave orphans | A connect event turns them on. `test_schema.py` checks it, and delete tests count rows in the database itself |
| Search speed | `LIKE '%x%'` can't use an index | At 5,000 rows a scan is a few milliseconds. Phase 7 measures it |
| Console warnings | Recharts warns about zero-size containers, and React warns about keys and controlled inputs, which breaks G7 | The e2e fixture fails any test with a console error or warning, so warnings surface in the phase that causes them |
| Shared test database | E2e tests change data, so one test can break the next | Reset before every test through `/api/test/reset`, with one worker |
| Drag tests | dnd-kit needs real pointer movement, so `locator.dragTo` can be unreliable | `dragCard` moves the mouse in steps with pauses. Keyboard moves are tested as well |
| Marigold next to Coral | Proposal and Negotiation look alike side by side | Every chart and column names the stage in text (spec concern 9) |
| Chrome missing | Playwright uses the installed Chrome | `check-env.mjs` warns. STATUS says it's needed for tests only |
| Scope creep | Mockup B shows search and filters that are out of scope | Ground rule 7 |

## Decided against

| Option | Why not |
| --- | --- |
| Next.js, Remix or another full-stack framework | The stack is fixed as Vite + React with a FastAPI backend |
| An ORM layer (SQLModel, SQLAlchemy ORM) | The stack says SQLAlchemy Core. Core is enough for five tables |
| Alembic migrations | The database is created fresh and reset by the seed. Migrations come with the move to Supabase |
| Paging and searching in the browser | Fine at a few hundred rows, but the spec asks for speed at a few thousand. The server already sorts and filters |
| Sending a numeric `index` for moves (the spec's first draft) | Won and Lost hide deals older than 30 days, so a visible index doesn't match the stored order. `before_id` says exactly where the card goes |
| Fractional positions (1.5 between 1 and 2) | Saves renumbering, but drifts and needs occasional repair. Renumbering one or two columns of at most a few hundred deals is cheap |
| Working out late flags and date windows in the browser | Two clocks could disagree, and tests would need to control both. The server decides |
| A UI kit (MUI, Chakra, Ant Design) | Fighting its look to match the brand costs more than styling Radix primitives |
| Tailwind | The mockups' CSS already maps to brand tokens. CSS variables plus one plain CSS file per feature is less to learn and to keep consistent |
| Redux, Zustand or another state store | Server data lives in TanStack Query. The rest is URL state or local component state |
| AG Grid or MUI DataGrid | Heavy, with their own look. TanStack Table is headless and fits the brand |
| `@hello-pangea/dnd` for the board | It has board-style keyboard dragging built in, but dnd-kit is more widely used, actively maintained, and is what the spec names. The Phase 3 spike checks dnd-kit handles the stacked column |
| Running e2e tests in parallel | Needs a server and database per worker. It's an optional speed-up after the MVP works, and the course suggests it as a later step |
| Fixing the browser's clock in e2e tests | The backend's `ACCOUNTABLE_TODAY` plus `/api/meta` gives the app one "today", so the browser clock doesn't matter |
| Testing a real backend restart in e2e | Playwright's web server can't be restarted mid-run. `test_startup.py` covers restart by closing and reopening the same file. The e2e suite covers refreshes |
| Mockup B's global search, board filter and "Late only" chip | Not in the intent (ground rule 7) |
| Generating TypeScript types from FastAPI's OpenAPI schema | Another tool and build step for about 20 types. `api/types.ts` is written by hand from [API](#api), and the e2e tests catch any mismatch |
| Loading Google Fonts at run time | The app must work offline, so fonts are bundled with `@fontsource` |

## Proof

`npm test` runs all three suites against their own databases. Each test's name ends with the requirement IDs it proves, for example `test_leaving_lost_clears_reason__D4a`.

### Backend unit tests (pytest, `backend/tests/`)

Unless a test says otherwise, `today` is 2026-11-26.

**`test_health.py`**
- `/api/health` returns `{"ok": true}`.
- `/api/meta` returns `today` as `2026-11-26`, and `now` on that date.

**`test_schema.py`**
- `PRAGMA foreign_keys` is 1 on a new connection.
- Inserting an activity with both or neither of contact and deal raises an integrity error (A2).
- A deal with no organization is refused.
- `value = -1` and `probability = 101` are refused by the database and by the API (422).

**`test_stage_rules.py`**
- A new deal at each stage gets that stage's usual probability (D3).
- Changing only the probability keeps it.
- Changing the stage without a probability in the request resets it to the new stage's usual value. Changing the stage with an explicit probability keeps the explicit one (D3).
- Moving to Won sets the close date to today, and so does moving to Lost (D4).
- Saving Won → Won doesn't change the close date.
- Moving Lost → Qualified clears `lost_reason`, keeps the close date and sets probability 25 (D4a).
- Creating a deal records `from_stage = null`. Each change records from, to and the lost reason (D7).
- An edit that doesn't change the stage records nothing.

**`test_positions.py`**
- A new deal goes to position 0 of its stage and the others shift down (P7).
- A move with `before_id` puts the deal directly above that deal. `before_id = null` puts it at the bottom.
- After any move, both affected stages are numbered 0 to n-1 with no gaps.
- A stage change from the form puts the deal at the top of the new stage.
- A `before_id` in a different stage from the requested one returns 422.
- After a move, a reload shows the same order (P5).

**`test_listing.py`**
- Search ignores case and matches inside words (T1).
- `%` and `_` in the search are matched literally.
- Every allowed sort column works both ways, with nulls last (T2).
- An unknown sort column returns 422.
- Paging returns the right slice and total (T3).
- `page_size` above 100 returns 422.

**`test_organizations.py`**
- Create with only a name works. An empty name returns 422 (O2).
- The list shows contact count, deal count and open value (O1).
- Search matches name, industry and website (O1).
- The detail view includes contacts and deals (O3).
- Delete-impact counts contacts, deals and the deals' activities.
- Delete removes its deals, their activities and their stage changes, and leaves its contacts with `organization_id = null`. All of this is checked by counting rows (O4).

**`test_contacts.py`**
- Name is required.
- An invalid email returns 422. An empty email is accepted and stored as null (C3).
- The status filter combines with search, and the counts per status ignore the status filter but respect the search (C2).
- Search matches the organization's name (C1).
- Delete leaves their deals with `main_contact_id = null`, deletes the activities on the contact, and keeps activities on those deals (C5).

**`test_deals.py`**
- Name, organization, stage and value are required (D2).
- The lost reason is limited to 200 characters.
- Search matches organization and contact names (D1).
- The default sort is close date ascending, with nulls last (T2).
- `is_late` is true only for an open deal with a close date before today. It's false for a close date of today, for Won or Lost, and for a deal with no close date (D6).
- Delete removes its activities and stage changes (D9).
- The detail view includes the organization name, the main contact's name and the lost reason (D8).

**`test_activities.py`**
- Create on a contact and on a deal (A2).
- Type, description and `occurred_at` are required. A description of 2,001 characters returns 422 (A1).
- Edit changes the fields. Delete removes the activity.
- Marking done keeps the activity (A5, A6).
- Unknown contact or deal ids return 404.

**`test_timelines.py`**
- Entries are newest first by time, then by newest id (A3).
- A contact's timeline includes activities on deals where they're the main contact, marked with that deal as the source (A4).
- After the main contact changes, those activities move to the new contact's timeline (A4).
- A deal's timeline includes its stage changes with the right text: "Created in New", "Moved from Proposal to Negotiation", and "Moved from Negotiation to Lost: Price too high" (D7).
- After reopening, the "Moved … to Lost" entry still shows its reason (D4a).

**`test_pipeline.py`**
- Columns come back in stage order, with count, value and expected revenue per column (P1).
- Won and Lost include close dates from 2026-10-28 to 2026-11-26, and leave out 2026-10-27 (P2). That's today and the 29 days before.
- Board totals cover open deals only (P3).
- Cards carry `is_late` and the main contact's initials.
- A move to Lost with a reason stores it. A move without one stores null (D5).

**`test_dashboard.py`**

All on a hand-built dataset, with each expected figure worked out in a comment above it.
- The 12 month buckets run from December 2025 to November 2026 (H1).
- Revenue by month, the running total and the best month, including a tie (the later month wins) and the "no deals won" case (H3).
- Deals won and lost, win rate, average deal won, and win rate with no closed deals (null) (H2).
- Won and lost by month (H4).
- The funnel:
  - a deal that went New → Qualified → Lost counts in New and Qualified only;
  - a Won deal counts in every stage;
  - a deal created before the window is left out (H5).
- Open value and expected revenue by stage (H6).
- Follow-ups:
  - overdue oldest first, then today to today + 14 days, soonest first;
  - done ones excluded;
  - one on day 15 excluded from the dashboard but included in `/api/follow-ups`;
  - at most 10 (H7).
- Recent activity: the 10 newest across activities and stage changes (H8).
- After a deal is moved to Won, revenue, deals won and the open pipeline all change (H9).

**`test_seed.py`**
- Exactly 20 organizations, 60 contacts, 40 deals and 150 activities (S1).
- At least six industries.
- Every status appears, and some contacts have no organization (S2).
- Every stage appears, with the counts in [Sample data](#sample-data). Values are between 1,000 and 40,000. Exactly 3 open deals are late (S3).
- Won and lost deals are spread over at least 8 of the 12 months.
- Follow-ups: at least 3 overdue, at least 3 due within 14 days and at least 5 done (S4).
- Each deal's last stage change matches its stage.
- Two seeds with the same today give identical rows (S5).
- Seeding over changed data restores the sample data (G3).

**`test_startup.py`**
- A missing file is created and seeded (G2).
- An existing file with changes is not reseeded.
- A change is still there after closing the engine and opening the file again (G4).

**`test_stages_match.py`**
- Parses `frontend/src/lib/stages.ts` for keys and probabilities, and checks they equal `backend/app/stages.py`.

**`test_test_mode.py`**
- `/api/test/reset` returns 404 unless test mode is on.

### Frontend unit tests (Vitest, `frontend/src/`)

**`lib/format.test.ts`** (G8)
- `usd(12400)` gives `US$12,400`, and `usd(0)` gives `US$0`.
- `usdShort(48000)` gives `US$48k`, `usdShort(41500)` gives `US$41.5k`, and `usdShort(1200000)` gives `US$1.2M`.
- `percent(75)` gives `75%`.
- `formatDate` gives `12 Mar 2026`. `relativeDay` gives "Today" and "Yesterday" for the given today, and a plain date otherwise.

**`lib/stages.test.ts`**
- Order, names, colors and usual probabilities.
- `isOpen("won")` is false.

**`lib/urlState.test.ts`** (T3, T7)
- Reads `q`, `sort`, `dir`, `page` and `status` from the URL.
- Changing `q`, `sort` or `status` resets `page` to 1.

**`components/DataTable.test.tsx`**
- Clicking a heading calls sort ascending, and clicking again calls descending (T2).
- The paging text reads "Showing 26–50 of 312", and Previous is disabled on page 1 (T3).
- The empty state reads "No contacts match 'zz'", and its button clears the search (T8).
- A row click opens the record, and a click on the row menu doesn't (T5).

**`components/ConfirmDialog.test.tsx`**
- Shows the exact wording from [Delete dialog wording](#delete-dialog-wording) for each record type, including counts of zero (T6).

**`components/EntityPicker.test.tsx`**
- Typing filters the options.
- "None" is offered only when the field is optional.

**`features/deals/DealForm.test.tsx`**
- Changing the stage fills in its usual probability. A typed probability survives until the stage changes again (D3).
- The lost reason appears only for Lost (D2).
- Organization is required, and a value of -1 is refused.
- Choosing Won shows a note: "The close date will be set to today."

**`features/contacts/ContactForm.test.tsx`**
- Name is required.
- `abc` is refused as an email, and an empty email is accepted (C3).

**`components/ActivityForm.test.tsx`**
- Type, description and date are required, and the date defaults to now (A1).

**`components/Timeline.test.tsx`**
- Entries are in the order given.
- Stage changes have no menu (A5).
- An overdue follow-up shows in the alert text color.
- The done checkbox calls the update (A6).

**`features/pipeline/boardState.test.ts`** (P5, P6)
- `applyMove` puts a card above `before_id` or at the bottom.
- Column and board totals are recomputed.
- A move into Won sets probability 100 and today's date.
- Rollback returns the exact previous state.

**`features/dashboard/FollowUps.test.tsx`**
- Overdue and "Next 14 days" headings, with overdue first.
- The count pill shows the overdue count (H7).

**`features/dashboard/HeadlinePanel.test.tsx`**
- The best-month sentence, the no-revenue sentence, and win rate shown as "–" when it's null (H2, H3).

### End-to-end tests (Playwright with installed Chrome, `e2e/`)

Every test starts from freshly seeded data with today fixed at 2026-11-26, and fails on any console error or warning (G7). Tests find records through the API helpers, not by hard-coded names.

**`start.spec.ts`** (G1, success criterion 1). It starts in Phase 0 as a check that the page loads, and gains these checks once the dashboard exists in Phase 6:
- `/` shows the dashboard with revenue won and at least one follow-up.
- Each section in the top bar shows rows or cards.

**`organizations.spec.ts`** (T1–T8, O1–O4)
- Add an organization and find it by search.
- Sort by name both ways.
- Go to page 2 and refresh: still on page 2.
- Edit its industry.
- Open an organization that has deals and delete it:
  - the dialog names the deals and activities that will go and the contacts that stay;
  - afterwards its contacts show no organization, and its deals are gone from the Deals table and the board.

**`contacts.spec.ts`** (C1–C5, T7, T8)
- Filter by Lead: the count matches the rows.
- Search within the filter, then refresh: the filter and search are kept.
- Add a contact with the email `abc`, see the error, fix it, and save.
- Search for `zz`: the empty state shows, and its button clears the search.
- Delete a contact who is a deal's main contact: the deal stays with no main contact.

**`deals.spec.ts`** (D1–D9)
- Add a deal and see it in the table.
- A late deal shows the Late badge in the table and on its page.
- Edit the stage to Negotiation: probability 75 and a "Moved from … to Negotiation" entry.
- Edit to Lost with a reason: the close date is today, and the reason shows on the page and in the timeline.
- Reopen it to Qualified: the reason is gone from the page but still in the timeline entry.
- Delete a deal.

**`timelines.spec.ts`** (A1–A6)
- On a contact, log a note with a follow-up date: it's at the top of the timeline.
- On a deal, log a call: it shows on the deal and on its main contact's timeline.
- Edit an activity, then delete one after confirming.
- Mark a follow-up done.

**`pipeline.spec.ts`** (P1–P8, D3–D5, success criterion 4)
- Drag a card from Proposal to Negotiation:
  - its probability shows 75 and the totals of both columns and the board change before the request finishes (the test delays the move response with `page.route`);
  - after a refresh it's still there;
  - the Deals table shows Negotiation and 75%.
- Drag a card to the top of its own column, refresh: the order is kept.
- Drag a card into Lost, type a reason, Save: it shows in Lost with the reason.
- Drag another card into Lost and press Escape: it's back where it was, and no request was sent.
- Drag a card into Won: the close date is today and the card shows in Won.
- Click "Add deal" in Qualified and save: the new deal is at the top of Qualified.
- Move a card with the keyboard (focus, Space, arrow keys, Space): the change persists after a refresh.
- A Won deal closed 31 days ago isn't on the board but is in the Deals table (P2). The test makes it through the API: create the deal as Won, then `PATCH` its close date to 31 days before today.
- With the move request forced to fail (`page.route` returns 500), the card goes back and the toast "Couldn't move the deal. Try again." appears (P6).

**`dashboard.spec.ts`** (H1–H9)
- The headline figures equal the figures from `/api/dashboard`.
- Mark an open deal Won on the pipeline, go back to the dashboard: revenue won and deals won have gone up by that deal.
- Log a follow-up due tomorrow: it appears under "Next 14 days". Mark it done: it disappears.
- The overdue follow-ups come first.
- "Show all" opens the full list.

**`persistence.spec.ts`** (G4, success criterion 2)
- Make one change in each section, then reload every page: every change is still there.
- After calling the reset endpoint, the change is gone and the sample data is back (the same code as `npm run seed`).

**`a11y.spec.ts`**
- Every page can be used with the keyboard alone (the tests tab to the main action and open it).
- Focus is visible.
- Every chart has an `aria-label`.

### Checks beyond the tests

- **`npm test` itself (G5):** in Phase 0, break one test in each suite and check that `npm test` fails, then put them back. Repeat after Phase 7.
- **Performance (G6):** the Phase 7 timings, recorded in STATUS.
- **Visual check:** screenshots compared with mockup B (Phase 7).
- **Walk-through (success criterion 8):** a person goes through every section and action in Chrome. Passing tests is necessary, but not enough.
- **Requirement coverage:** every requirement ID in `docs/spec.md` (G, T, O, C, D, P, A, H and S) must appear in at least one phase step in [Order of work](#order-of-work) and at least one item in Proof. Re-check this whenever the spec or this plan changes, writing ranges out in full rather than as "X1–X4a".

## Reference

### Data model

All tables have `id INTEGER PRIMARY KEY`, plus `created_at` and `updated_at`, both `DateTime` and not null. These are set by the services from `config.now()`, not by database defaults, so tests can control them. Dates are `Date`. Times are `DateTime` with no time zone.

**organizations**
- `name` String(200), not null.
- `website` String(300).
- `industry` String(100).
- `notes` Text.
- Index on `name`.

**contacts**
- `name` String(200), not null.
- `email` String(254).
- `phone` String(50).
- `job_title` String(100).
- `organization_id` FK → organizations, `ondelete="SET NULL"`.
- `status` String(20), not null, check in (`lead`, `qualified`, `customer`).
- Indexes on `name` and `organization_id`.

**deals**
- `name` String(200), not null.
- `organization_id` FK → organizations, not null, `ondelete="CASCADE"`.
- `main_contact_id` FK → contacts, `ondelete="SET NULL"`.
- `stage` String(20), not null, check in the six stage keys.
- `value` Integer, not null, check ≥ 0.
- `probability` Integer, not null, check between 0 and 100.
- `close_date` Date.
- `lost_reason` String(200).
- `position` Integer, not null.
- Indexes on `name`, `organization_id`, `main_contact_id` and (`stage`, `position`).

**activities**
- `type` String(10), not null, check in (`note`, `call`, `email`).
- `description` Text, not null.
- `occurred_at` DateTime, not null.
- `follow_up_date` Date.
- `done` Boolean, not null, default false.
- `contact_id` FK → contacts, `ondelete="CASCADE"`.
- `deal_id` FK → deals, `ondelete="CASCADE"`.
- Check: `(contact_id IS NULL) != (deal_id IS NULL)`.
- Indexes on `contact_id`, `deal_id`, `occurred_at` and (`follow_up_date`, `done`).

**stage_changes**
- `deal_id` FK → deals, not null, `ondelete="CASCADE"`.
- `from_stage` String(20), null for creation.
- `to_stage` String(20), not null.
- `lost_reason` String(200).
- `changed_at` DateTime, not null.
- Indexes on `deal_id` and `changed_at`.

Stages, in order: `new` (New, 10), `qualified` (Qualified, 25), `proposal` (Proposal, 50), `negotiation` (Negotiation, 75), `won` (Won, 100), `lost` (Lost, 0). The first four are open; Won and Lost are closed.

### Rules

All of these live in `backend/app/services/deals.py`, unless the rule says otherwise. `today` and `now` come from `config`.

**Creating a deal**
- Probability is the request's if given, otherwise the stage's usual value.
- If the stage is Won or Lost, the close date is today.
- Position 0 in its stage, with the others shifted down.
- A stage change is recorded with from `null`, to the stage, and the lost reason if Lost.
- The lost reason is kept only if the stage is Lost.

**Updating a deal**, when the stage changes from A to B:
- Probability is the request's if the request includes `probability`, otherwise B's usual value.
- If B is Won or Lost, the close date is today, whatever the request says.
- If A is Lost, the lost reason is cleared.
- If B is Lost, the lost reason is the request's (or null).
- The deal goes to position 0 of B, and A is renumbered.
- A stage change is recorded with from A, to B, the lost reason, and `now`.

**Updating a deal** when the stage doesn't change: fields update as given, and a lost reason is only accepted while the stage is Lost.

**Moving a deal** (`POST /api/deals/{id}/move` with `{stage, before_id, lost_reason}`):
- If `before_id` is given, that deal must exist and be in `stage`, or the request fails with 422.
- The deal is taken out of its stage's order and inserted directly above `before_id`, or at the bottom if `before_id` is null.
- If the stage changed, the same rules as updating apply, except that probability is always the usual value and the deal goes where it was dropped rather than to the top.
- Both stages are renumbered.
- Everything happens in one transaction.

**Positions:** each stage is numbered 0 to n-1, top to bottom. Renumbering reads the stage's ids in order and writes their new positions.

**Late:** stage open, `close_date` not null, and `close_date < today`.

**Deleting a deal:** the cascade removes its activities and stage changes, and its stage is renumbered.

**Deleting an organization:** its deals cascade, and so do their activities and stage changes. Its contacts' `organization_id` is set to null. Every affected stage is renumbered.

**Deleting a contact:** activities on the contact cascade. Deals' `main_contact_id` is set to null.

**Stage change text** is built when it's read:
- `from` null → "Created in {To}".
- Otherwise → "Moved from {From} to {To}".
- If `to` is Lost and there's a lost reason, add ": {reason}".

**Contact timeline:** activities where `contact_id` is the contact, plus activities whose deal's current `main_contact_id` is the contact. Sorted by `occurred_at` descending, then id descending. Items from a deal carry `source = {kind: "deal", id, name}`.

**Deal timeline:** the deal's activities plus its stage changes, mixed and sorted by time (`occurred_at` or `changed_at`) descending.

### Dashboard figures

Let `start` be the first day of the month 11 months before today's month. For today = 2026-11-26, that's 2025-12-01. The window runs from `start` to today, inclusive, in 12 month buckets labelled "Dec 2025" … "Nov 2026".

- **Revenue by month:** the sum of `value` for Won deals whose `close_date` falls in each month.
- **Running total:** the cumulative sum of revenue by month.
- **Revenue won:** the sum over the 12 months.
- **Best month:** the bucket with the highest revenue. A tie goes to the later month. It comes with that month's deal count, and is null if revenue is 0.
- **Deals won and lost:** the count of Won and Lost deals by `close_date` in the window, also per month.
- **Win rate:** `round(100 × won / (won + lost))`, or null if both are 0.
- **Average deal won:** `round(revenue / won)`, or null if nothing was won.
- **Open pipeline:** over deals in open stages, the count, the sum of `value`, the expected revenue (`round(sum(value × probability / 100))`) and the late count. Also these per stage.
- **Funnel:**
  - Take deals with `created_at ≥ start`.
  - For each, its furthest stage is the highest of New, Qualified, Proposal, Negotiation and Won that appears as `to_stage` in its stage changes or as its current stage. Lost isn't a step.
  - Each deal adds 1 to the count and its `value` to the value of every stage up to and including its furthest.
  - Return the five steps with `deals` and `value`.
- **Follow-ups:**
  - Open follow-ups are activities with `follow_up_date` not null and `done` false.
  - Overdue: `follow_up_date < today`, oldest first.
  - Upcoming: `today ≤ follow_up_date ≤ today + 14 days`, soonest first.
  - The dashboard takes overdue then upcoming, at most 10 in all, plus `overdue_count` and `total_open`.
  - `/api/follow-ups` returns every open one, overdue first, then by date.
- **Recent activity:** the 10 newest entries across activities (by `occurred_at`) and stage changes (by `changed_at`).

### API

All paths start with `/api`. Request and response bodies are JSON. Dates are `YYYY-MM-DD` and times are `YYYY-MM-DDTHH:MM:SS`, with no time zone. Errors:
- 404 `{"detail": "Organization not found"}` (and the same for other records);
- 422 with FastAPI's standard `detail` list, which names the field that failed.

**Updates (`PATCH`)** change only the fields sent. A field sent as `null` is cleared; a field left out is unchanged (use Pydantic's `model_fields_set`). Clearing a required field (`name`, a deal's `organization_id`, `stage`, `value`) returns 422. Empty strings in optional text fields are stored as null.

**List parameters** for organizations, contacts and deals:
- `q` (optional);
- `sort` (allow-listed per resource);
- `dir` (`asc` or `desc`);
- `page` (≥ 1, default 1);
- `page_size` (1–100, default 25).

Lists return `{items, total, page, page_size}`.

**Allowed sort columns**
- Organizations: `name`, `industry`, `website`, `contacts_count`, `deals_count`, `open_value`.
- Contacts: `name`, `organization_name`, `job_title`, `email`, `phone`, `status`.
- Deals: `name`, `organization_name`, `main_contact_name`, `stage` (in stage order, with a Core `case()` expression), `value`, `probability`, `close_date`.

**Search columns** are as in the spec (O1, C1, D1).

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /health` | | `{ok: true}` |
| `GET /meta` | | `{today: "2026-11-26", now: "2026-11-26T14:05:00"}`; `now` is today's date with the backend's current local time |
| `POST /test/reset` (test mode only) | | `{ok: true}` |
| `GET /organizations` | list params | items: `{id, name, industry, website, contacts_count, deals_count, open_value}` |
| `POST /organizations` | `{name, website?, industry?, notes?}` | the organization (201) |
| `GET /organizations/{id}` | | `{id, name, website, industry, notes, contacts: [{id, name, job_title, status}], deals: [{id, name, stage, value, close_date, is_late}]}` |
| `PATCH /organizations/{id}` | any of the create fields | the organization |
| `GET /organizations/{id}/delete-impact` | | `{contacts: n, deals: n, activities: n}`, where activities are those on the deals that will go |
| `DELETE /organizations/{id}` | | 204 |
| `GET /organizations/options?q=` | | up to 20 `[{id, name}]`, by name |
| `GET /contacts` | list params plus `status` | items: `{id, name, organization_id, organization_name, job_title, email, phone, status}`, plus `status_counts: {all, lead, qualified, customer}` |
| `POST /contacts` | `{name, email?, phone?, job_title?, organization_id?, status}` | the contact (201) |
| `GET /contacts/{id}` | | the contact with `organization_name` and `deals: [{id, name, stage, value, close_date, is_late}]` (deals where they're the main contact) |
| `PATCH /contacts/{id}`, `DELETE /contacts/{id}` | | as for organizations |
| `GET /contacts/{id}/delete-impact` | | `{deals: n, activities: n}` (deals that lose their main contact, and activities that will go) |
| `GET /contacts/options?q=&organization_id=` | | up to 20 `[{id, name, organization_name}]`; contacts of `organization_id` first |
| `GET /contacts/{id}/timeline` | | `[TimelineItem]` |
| `GET /deals` | list params | items: `{id, name, organization_id, organization_name, main_contact_id, main_contact_name, stage, value, probability, close_date, is_late}` |
| `POST /deals` | `{name, organization_id, main_contact_id?, stage, value, probability?, close_date?, lost_reason?}` | the deal (201) |
| `GET /deals/{id}` | | the list item plus `lost_reason` |
| `PATCH /deals/{id}` | any of the create fields | the deal |
| `GET /deals/{id}/delete-impact` | | `{activities: n}` |
| `DELETE /deals/{id}` | | 204 |
| `POST /deals/{id}/move` | `{stage, before_id: int or null, lost_reason?}` | the board, as `GET /pipeline` |
| `GET /deals/{id}/timeline` | | `[TimelineItem]` |
| `GET /pipeline` | | `{totals: {open_value, open_expected, open_count}, columns: [{stage, count, value, expected, deals: [Card]}]}`, six columns in stage order; Won and Lost hold only the last 30 days |
| `POST /activities` | `{type, description, occurred_at, follow_up_date?, contact_id?, deal_id?}` | the activity (201) |
| `PATCH /activities/{id}` | any of `type, description, occurred_at, follow_up_date, done` | the activity |
| `DELETE /activities/{id}` | | 204 |
| `GET /dashboard` | | see below |
| `GET /follow-ups` | | `[FollowUp]` |

**Shapes**

- **Card**:

  ```
  {id, name, organization_name, value, probability, close_date,
   is_late, main_contact_initials, lost_reason}
  ```

  Initials are the first letters of the first and last words of the name.

- **TimelineItem**:

  ```
  {kind: "activity" | "stage_change", id, type: "note" | "call" | "email" | "stage",
   text, at, follow_up_date, done, overdue,
   source: {kind: "deal", id, name} | null}
  ```

- **FollowUp**:

  ```
  {id, description, follow_up_date, overdue,
   on: {kind: "contact" | "deal", id, name}}
  ```

- **Dashboard**:

  ```
  {today,
   months: [{label, revenue, running_total, won, lost}],
   revenue_won, deals_won, deals_lost, win_rate, average_won,
   best_month: {label, revenue, deals} | null,
   open: {value, expected, count, late,
          by_stage: [{stage, count, value, expected}]},
   funnel: [{stage, deals, value}],
   follow_ups: {items: [FollowUp], overdue_count, total_open},
   recent: [{kind, type, text, at, on: {kind, id, name}}]}
  ```

### Cache invalidation

| After | Invalidate |
| --- | --- |
| Any organization change | `organizations`, `organization/{id}`, `contacts`, `deals`, `pipeline`, `dashboard` |
| Any contact change | `contacts`, `contact/{id}`, `deals`, `organization/*`, `dashboard` |
| Any deal change or move | `deals`, `deal/{id}`, `pipeline`, `dashboard`, `organizations`, `organization/*`, `contact/*` |
| Any activity change | `timeline/*`, `dashboard`, `follow-ups` |

### Sample data

`seed(conn, today, rng)` uses `random.Random(20261126)` and Faker seeded with the same number, so the data is the same every time apart from dates relative to `today` (S5). All times are working hours, 08:00–18:00.

**Organizations (20)**
- Industries: Restaurants and cafés, Hotels, Retail, Offices and co-working, Fitness, Schools, Healthcare, Logistics. At least two in each.
- Names are hand-written in the seed file, so they sound real and stay stable. For example: Harbor Street Café, Brightwell Hotels, Pinecrest Fitness, Maple & Rye Bakery, Lakeside Primary School, Northwind Office Park, Copper Kettle Diner, Summit Dental Group, Riverside Grocers, Elm Row Boutique, Greenleaf Co-working, Bayview Medical, Oakridge Academy, Atlas Logistics, Crescent Spa, and five more of your choosing.
- Websites: the name in lowercase with spaces removed, plus `.example.com`.
- Notes on about half.

**Contacts (60)**
- 52 at organizations (2–4 each) and 8 with no organization.
- Status: 24 lead, 14 qualified, 22 customer. Unattached contacts are always leads.
- Name from Faker. Email `first.last@` plus the organization's domain, or a Faker free email for the unattached.
- Phone, and a job title from a list that fits a wholesale buyer: Owner, Office Manager, Purchasing Manager, Head Chef, Facilities Manager and so on.

**Deals (40)**

Names come from a product catalogue per industry, for example "Banquet linen contract" for Hotels or "Classroom supplies 2027" for Schools. Values are whole hundreds between 1,000 and 40,000, and the main contact is one of the organization's contacts, or none on about 10% of deals.

| Stage | Count | Created | Close date |
| --- | --- | --- | --- |
| Won | 12 | 30–120 days before its close date | Spread so at least 8 of the 12 months have one; at least 2 in the last 30 days |
| Lost | 6 | 30–120 days before its close date | Spread across the 12 months; at least 1 in the last 30 days; 4 have a lost reason from a list ("Went with a cheaper supplier", "Budget cut", "Chose to wait until next year", "Went with their usual supplier") |
| New | 6 | 0–60 days ago | 30–110 days ahead |
| Qualified | 6 | 15–90 days ago | 10–90 days ahead |
| Proposal | 5 | 20–100 days ago | 5–60 days ahead |
| Negotiation | 5 | 30–120 days ago | 3–40 days ahead |

Exactly 3 open deals (one each in Qualified, Proposal and Negotiation) get a close date 2–12 days before today, so they're late.

**Stage history**
- Each deal starts with "Created in New" at `created_at`.
- It then moves one stage at a time to its current stage, each step at an evenly spread time between `created_at` and its close date (for closed deals) or today (for open deals).
- Lost deals reach a random open stage first, then move to Lost on their close date with their reason.
- Probability is the usual value for the current stage.

**Activities (150)**
- 60 on contacts and 90 on deals, with types about 40% note, 35% call and 25% email.
- Each `occurred_at` falls between the record's creation and today, mostly in the last 12 months.
- Descriptions come from short templates that fit the type and the industry, for example "Talked through a volume discount on linen" or "Sent the 2027 catalogue".
- 26 have a follow-up:
  - 4 overdue (1–9 days ago) and not done;
  - 7 due from today to 14 days ahead and not done;
  - 3 due 15–40 days ahead;
  - 12 in the past and done.

**Positions** are numbered by close date within each stage, soonest first.

### Screens

Routes:

| Route | Page |
| --- | --- |
| `/` | Dashboard |
| `/organizations` and `/organizations/:id` | Organizations list and organization page |
| `/contacts` and `/contacts/:id` | Contacts list and contact page |
| `/deals` and `/deals/:id` | Deals list and deal page |
| `/pipeline` | The board |
| anything else | "Page not found" with a link to the dashboard |

**Top bar**
- 64px tall, Midnight background, 32px side padding.
- Logo on the left: a 26px rounded Sea Green square with an "A" in Midnight, then "Accountable" in white, 18px bold.
- Then the five sections with Lucide icons: `LayoutDashboard`, `Building2`, `Users`, `DollarSign`, `Kanban`. Labels in Sea Mist, 8px 14px padding, 8px corners.
- Current section: a background of `rgb(6 214 160 / 0.16)`, white text, and a Sea Green icon.
- Below 1280px wide, hide the labels and keep the icons, with `aria-label`s.

**Page**
- `#F0F4F5` background, 28px top padding and 32px side padding, content up to 1600px wide and centred.
- The header has the title (28px, semibold) on the left and the actions on the right.

**Dashboard** (match `docs/mockups/b-dashboard.png`)
- Header: "Dashboard", with "Last 12 months · Dec 2025 to Nov 2026" in muted text on the right.
- Below, a two-column grid: the main area, and a 380px right-hand column, 16px apart.
- **Main area, panel 1:**
  - On the left (280px):
    - "Revenue won, last 12 months";
    - the figure at 44px in JetBrains Mono, semibold;
    - the best-month sentence in Instrument Serif at 19px;
    - a 2 × 2 grid with Deals won, Win rate, Average deal won and Deals lost.
  - On the right: "Revenue won by month", with revenue bars in Sea Green and a y-axis in short money.
- **Main area, panel 2, "Pipeline":**
  - On the left: open pipeline, expected revenue, and open deals with a soft Raspberry "N late" badge; the stage strip (a 22px stacked bar with the stage name and short value under each segment); the stage bars (value in a 35% tint, the expected part solid, with the value and "expected US$…" on the right).
  - On the right: the funnel, one centred bar per stage, with the value and "N deals · N% of value kept" on the right.
  - "Open the board" at the top right.
- **Main area, row 3:** "Running total" (a Sea Green line with a soft area fill, the only gradient in the app) beside "Deals won and lost" (grouped bars: Won in Sea Green, Lost in Coral, with a legend).
- **Right-hand column, panel 1:** "Follow-ups" with a Raspberry "N overdue" pill and "Show all".
  - The "Overdue" group heading in the Raspberry text color, then the overdue items on a Raspberry 7% tint.
  - The "Next 14 days" heading, then the upcoming items.
  - Each item has a checkbox, the description, the linked record, and the date in mono.
- **Right-hand column, panel 2:** "Recent activity" as a feed. Each entry has a round 28px type icon, the text, and the linked record with its time.

**Pipeline** (match `docs/mockups/b-pipeline.png`)
- Header: "Pipeline", with "Add deal" as the primary button, which opens the deal form with stage New.
- A summary panel with open pipeline, expected revenue, open deals and a 14px stage strip.
- The board is a grid of four equal columns plus a fifth at 0.9 width, 12px apart.
- Each column has a `rgb(7 59 76 / 0.035)` background, 12px corners and 8px padding.
- Column header: an 8px-corner block tinted in the stage color (16%; New uses Sea Mist at 45%), with the name and "N deals", then the value and "exp. US$…".
- **Open deal card:**
  - white, 10px corners, 11px 12px padding;
  - the name in semibold, with the short value on the same line on the right;
  - the organization in muted 12px text;
  - a 4px probability bar in the stage color;
  - a bottom line with the Late badge if late, the close date (Raspberry text when late), the probability and the main contact's 22px initials.
- **Won and Lost** sit stacked in the fifth column, each in its own tinted block (Won at 22%, Lost at 12%).
  - Each row has the name and short value, the organization and close date, and the lost reason in Raspberry text for Lost.
  - Each block has its own "Add deal".
  - Under both: "Won and Lost show deals closed in the last 30 days. Every closed deal is in the Deals table."

**Lists**
- Header with the title and "Add organization", "Add contact" or "Add deal".
- One panel holding:
  - a toolbar: a search box on the left; on Contacts, a status segmented control with counts;
  - the table: 48px rows with dividers in `#E3EAEC`, a hover tint of `#F0F4F5`, and a "⋯" menu with Edit and Delete at the end;
  - the paging bar: "Showing 26–50 of 312" on the left, and Previous, "Page 2 of 13" and Next on the right.
- Numbers are right-aligned in mono.
- A loading state shows skeleton rows. Errors use `ErrorState`, with "Try again".

**Record pages**
- A header panel with the name, key facts and Edit and Delete buttons.
  - Deal: stage badge, value, probability, close date with the Late badge, organization link, main contact link, and the lost reason if Lost.
  - Contact: status badge, organization link, email, phone and job title.
  - Organization: industry, website link and notes.
- Below, two columns: linked records on the left, and the timeline on the right with "Log activity" at the top.
- An organization has no timeline, so its contacts and deals panels sit side by side.
- An unknown id (404) shows "This {record} doesn't exist. It may have been deleted." with a link back to the list.

**Forms** are dialogs, 480px wide (the deal form is 560px).
- Labels sit above the fields, and the error shows under the field in the Raspberry text color.
- Cancel and Save sit at the bottom right. Save is disabled while saving.
- The deal form shows the lost reason field only for Lost. Choosing Won or Lost shows the note "The close date will be set to today."
- Changing the stage in the deal form sets the probability field to that stage's usual value at once, and the form always sends `probability`. The server then keeps what the form sent, so a probability typed after the stage change is kept (D3).
- Close date uses a native `<input type="date">`. When it happened uses `<input type="datetime-local">`.

**Delete dialog wording**

| Record | Wording |
| --- | --- |
| Organization | "Delete {name}? Its {d} deals and their {a} activities will be deleted. Its {c} contacts will be kept, with no organization." When a count is 0, leave out that sentence. If all are 0: "Delete {name}? Nothing else is affected." |
| Contact | "Delete {name}? Their {a} activities will be deleted. Their {d} deals will be kept, with no main contact." |
| Deal | "Delete {name}? Its {a} activities and its stage history will be deleted." |
| Activity | "Delete this {type}? This can't be undone." |

Use "1 deal" and "2 deals" (singular and plural) throughout.

### Messages

| When | Toast |
| --- | --- |
| A record is saved | "{Organization, Contact, Deal or Activity} saved" |
| A record is deleted | "{Record} deleted" |
| A save or delete fails | "Couldn't save the {record}. Try again." |
| A move fails | "Couldn't move the deal. Try again." |

Toasts sit at the bottom right.

### Design

From the brand skill. Fonts: Instrument Sans for headings and text, Instrument Serif only for the best-month sentence, and JetBrains Mono for money, counts, percentages and dates, with tabular figures.

| Token | Value | Use |
| --- | --- | --- |
| `--sea-green` | `#06D6A0` | Primary buttons (Midnight text), Won, revenue charts, current section |
| `--marigold` | `#FFC145` | Proposal |
| `--coral` | `#F78C6B` | Negotiation, lost bars |
| `--cerulean` | `#0E7A9F` | Qualified, focus rings (2px) |
| `--raspberry` | `#D33259` | Lost, Late badge (white text), delete buttons (white text) |
| `--midnight` | `#073B4C` | Text, top bar |
| `--sea-mist` | `#CDD8DB` | New, top bar labels |
| `--sea-green-text` | `#037A5C` | Sea Green as text on light backgrounds |
| `--marigold-text` | `#8A5A00` | Marigold as text |
| `--coral-text` | `#B0472A` | Coral as text |
| `--cerulean-text` | `#0B6A8A` | Links |
| `--raspberry-text` | `#C0264E` | Errors, overdue dates, lost reasons |
| `--muted` | `#4E6A75` | Secondary text |
| `--line` | `#E3EAEC` | Row dividers inside panels |
| `--page` | `#F0F4F5` | Page background |
| `--panel` | `#FFFFFF` | Panels and cards |
| `--shadow` | `0 1px 2px rgb(7 59 76 / 0.06)` | Panels and cards |

**Other values**
- Panel corners: 12px. Cards: 10px. Buttons and inputs: 8px.
- Panels have no outline. There's no border on one edge, and no line across the top of the page.
- Contact status badges: Lead in Cerulean, Qualified in Marigold, Customer in Sea Green. Each is a 15% tint with the color's text version.
- Timeline icons: note in Marigold, call in Sea Green, email in Cerulean, stage change in Midnight at 8%. Each is a tint, with the text version for the icon.
- Charts:
  - gridlines in `--line`, horizontal only;
  - axis text 12px in `--muted`;
  - tooltips in Midnight with white text and the exact value with currency;
  - bars with a 4px rounded top and a 2px gap between neighbours.

### Formats

| Function | Example |
| --- | --- |
| `usd(n)` | `US$12,400` |
| `usdShort(n)` | `US$48k`, `US$41.5k`, `US$1.2M`; below 1,000 it's the full amount |
| `percent(n)` | `75%` |
| `formatDate(d)` | `12 Mar 2026` |
| `formatDateTime(t)` | `12 Mar 2026, 14:30` |
| `relativeDay(d, today)` | "Today", "Yesterday", or `formatDate` |

Use plain labels: "Add deal", "Log activity", "Mark done", "Delete contact". No exclamation marks.
