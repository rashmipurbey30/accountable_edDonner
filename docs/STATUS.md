# Status

## How to run

You need three things on your computer first. Each is a one-off install.

1. **Node.js** (the LTS version, 24 or later). Download it from https://nodejs.org and run the installer.
2. **uv**, which runs the Python part of the app. Use the one-line install command at https://docs.astral.sh/uv/getting-started/installation/. uv downloads Python 3.12 by itself the first time it's needed.
3. **Google Chrome**, from https://www.google.com/chrome/. It's only needed to run the tests.

Close and reopen your terminal after installing, then go to this folder in it.

- **Once, to set up:** `npm install`
- **To start the app:** `npm run dev`, then open http://localhost:5173 in your browser. Press Ctrl+C in the terminal to stop it.
- **To reset to the sample data:** `npm run seed`. Your previous data is copied to `data/accountable.backup.db` first.
- **To run all the tests:** `npm test`. The tests use their own database, so they never change your data.

Your data lives in `data/accountable.db`. The first time the app starts, it creates that file and fills it with sample data.

**If `npm run dev` says an address is in use,** another program already uses port 5173 or 8000 (often an earlier copy of the app still running). Close that terminal, or on Windows run `netstat -ano | findstr :8000` to find the process number and end it in Task Manager.

**Behind a company proxy:** if `npm install` or uv fail with certificate errors, clear the Miniconda certificate variables for that terminal first (Git Bash: `unset SSL_CERT_FILE SSL_CERT_DIR`; PowerShell: `Remove-Item Env:SSL_CERT_FILE, Env:SSL_CERT_DIR`).

## Progress

- 2026-11-25: `docs/intent.md` refined after an interview (delete rules, required fields, stage probabilities, Won/Lost handling, dashboard range, scale, sample data business).
- 2026-11-26: `docs/spec.md` written: requirements, design and open concerns for the MVP.
- 2026-11-26: Decided: deleting an organization deletes its deals (contacts kept); reopening a lost deal deletes its lost reason. `docs/intent.md` and `docs/spec.md` updated.
- 2026-11-26: Brand colors adjusted for contrast: Cerulean `#0E7A9F`, Raspberry `#D33259`, muted ink `#4E6A75`, and text versions of all five colors added to the brand skill. `docs/spec.md` updated.
- 2026-11-26: Three dashboard and pipeline mockups (A, B, C) in `docs/mockups/`, each with a Playwright screenshot.
- 2026-11-26: Mockup B chosen; `docs/spec.md` updated with the choice, the reasons, and the top-bar layout, dashboard and five-column pipeline.
- 2026-11-26: `docs/plan.md` written: files that change, eight phases of work, risks, and the tests that prove it.
- 2026-11-26: `docs/plan.md` revised so it can be built from alone: ground rules, the full data model, rules, API shapes, sample data recipe and design values, plus "What this could break", the riskiest step and "Decided against". `docs/spec.md` move endpoint now takes `before_id`.
- 2026-11-27: Checked docs/plan.md against every requirement ID in docs/spec.md: all 63 are built in a phase and proved in Proof.
- 2026-11-27: Phase 0 done: uv project, Vite React frontend, root npm scripts (`dev`, `seed`, `test`), Playwright on the installed Chrome, one trivial test per suite. `npm test` fails when any suite fails (G5, checked). `uv sync` and `npm install` worked behind the proxy once `SSL_CERT_FILE`/`SSL_CERT_DIR` were cleared. Installed majors are newer than the plan assumed (React Router 8, TanStack Table 9, TypeScript 7, Vite 8, Vitest 5, Zod 4). pytest prints a Starlette deprecation warning about `httpx` (it now prefers `httpx2`); harmless, left as is.
- 2026-11-27: Phase 1 done: tables, stage rules and positions (`services/deals.py`), sample data and `npm run seed` with backup, create-and-seed on first start. For later phases: the engine opens sqlite3 with `autocommit=False`, so DDL runs inside transactions. That makes the seed's drop, create and reseed one real transaction, and cut table setup in tests from 0.4s to 0.02s. `backend.app.main:app` is built lazily, so importing `main` never touches a database. Write endpoints should use the `Conn` dependency in `db.py`, which commits before the response is sent (FastAPI `scope="function"`).
- 2026-11-27: Phase 2 done: every endpoint in the plan's API table, with lists (search, sort, paging), delete-impact, options, timelines, the pipeline board and move, and the dashboard. 152 backend tests pass. Additions beyond the plan's shapes: dashboard `recent` entries also carry `id`, and services raise `NotFound`/`Invalid` (`backend/app/errors.py`), which `main.py` turns into 404 and 422 in FastAPI's shape. A `before_id` that isn't in the target stage is 422 on `before_id`.
- 2026-11-27: Phase 3 done: fonts, brand tokens, top bar, routes, API client and query hooks with toasts and cache invalidation, format/stage/URL-state helpers, and the shared components (DataTable, Dialog, ConfirmDialog, EntityPicker, badges, Timeline, ActivityForm) with their Vitest tests. Deal changes also invalidate `timeline`, because a deal's timeline shows its stage changes (the plan's table left that out). The drag-and-drop spike worked and is deleted. What it showed, for Phase 5: dnd-kit's multi-container pattern (move the item between containers in `onDragOver`, reorder in `onDragEnd`) handles Won and Lost stacked in one column; an empty block needs `useDroppable` on its list; with `closestCorners`, keyboard ArrowRight moves a card to the next column and ArrowDown moves it from Won into Lost; Playwright drags need a small first move past the 6px activation distance, then stepped moves.
- 2026-11-27: Phase 4 done: organization, contact and deal lists, forms and record pages, delete with impact dialogs, and activities (log, edit, delete, mark done) on the timelines. E2e fixture (reset before each test, fail on console errors) and API helpers; specs `organizations`, `contacts`, `deals`, `timelines` pass, plus `DealForm` and `ContactForm` unit tests. Test fixed, not the app: `organizations` "sort by name" assumed the first click sorts A–Z, but the list already starts A–Z, so the first click correctly sorts Z–A. Ticking a follow-up done now updates the timeline at once and rolls back on failure (before, it only ticked after the refetch). For later phases: sample deal names can repeat across organizations, so e2e tests should pick rows by name and organization, or go by id; `LostReasonDialog` is left for Phase 5, where the board needs it.
