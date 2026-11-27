# Spec: the Accountable MVP

This spec turns `docs/intent.md` into requirements and a design that can be built and tested. If this spec and the intent disagree, the intent wins and this spec gets fixed. The look follows the brand skill (`.claude/skills/brand/SKILL.md`).

## Concerns

Each concern says how this spec resolves it.

1. **Installing needs the internet and some technical setup.** "Needs no internet connection to use" holds once it's installed. But the first `npm install` and `uv sync` download packages, and Node.js and uv must already be on the computer. That's a lot to ask of a non-technical person (success criterion 1). This spec keeps the one command and writes step-by-step setup in `docs/STATUS.md`. To keep the app working offline, fonts are bundled with the app (`@fontsource`) rather than loaded from Google Fonts.
2. **The funnel needs stage history.** "How much value reaches each stage" can't be worked out from current stages alone, because a Lost deal may have reached Negotiation first. This spec records every stage change in its own table. The funnel uses the furthest stage each deal has reached. The sample data writes a believable history for every deal.
3. **Editing a close date can hide a deal from the board.** Won and Lost show deals closed in the last 30 days, judged by close date. If someone backdates a Won deal's close date, it leaves the board. That's expected, and the deal is still in the Deals table.
4. **Stage-change entries aren't activities.** They can't be edited or deleted on their own. They go when their deal is deleted.
5. **Which timeline an activity on a deal shows in is worked out when the timeline is read.** If a deal's main contact changes, the deal's activities move to the new main contact's timeline. Stage-change entries show only on the deal.
6. **"Today" means the date on the computer running the backend.** Dates are stored without a time zone.
7. **`docs/BRAND.md` doesn't exist.** `AGENTS.md` points to it for UI work, but the brand guidelines live in the brand skill. This spec uses the skill. Copying the skill into `docs/BRAND.md`, or fixing the pointer, would avoid confusion.
8. **Sample data dates are relative to the day it's seeded**, so the dashboard and follow-ups always look current. Seeding again moves them.
9. **Marigold and Coral are hard to tell apart.** Proposal (Marigold) and Negotiation (Coral) sit side by side in every chart and on the board, and a palette check found them too close even for normal color vision. Every place they appear also names the stage in text, so color is never the only cue.

## Requirements

Requirement IDs are used by the tests.

### General

- **G1** `npm run dev` starts the backend and the frontend together and prints the address to open. Opening it lands on the dashboard.
- **G2** If the database file doesn't exist, the backend creates it and fills it with the sample data.
- **G3** `npm run seed` deletes all the data and loads the sample data again.
- **G4** Every change is saved to the database straight away. A browser refresh or a restart shows it.
- **G5** `npm test` runs the frontend, backend and end-to-end tests against a test database, and fails if any test fails.
- **G6** Lists, the pipeline and the dashboard load in under half a second with 5,000 records of each kind on a typical laptop.
- **G7** The browser's console shows no errors or warnings during normal use.
- **G8** Money is in US dollars and always shown with its currency (see Formats).

### Tables (Organizations, Contacts, Deals)

- **T1** A search box filters the rows as you type (after a 250 ms pause). It matches any of the searched columns, ignoring case.
- **T2** Clicking a column heading sorts by it, ascending. Clicking again sorts descending. One column is sorted at a time. The default is name, ascending, except Deals, which defaults to close date ascending.
- **T3** Paging shows 25 rows a page, with previous and next buttons, the page number, and "Showing 26–50 of 312". Searching or sorting goes back to page 1.
- **T4** An "Add" button opens a form in a dialog. Saving adds the record and shows it in the table.
- **T5** Each row has edit and delete actions in a menu at the end of the row. Clicking anywhere else on a row opens the record's page.
- **T6** Delete asks first, in a dialog that names the record and says what will happen to linked records, with their counts, for example: "Delete Northwind Supply? Its 3 deals and their 12 activities will be deleted. Its 4 contacts will be kept, with no organization." The delete button in the dialog is Raspberry.
- **T7** Search, sort and page live in the URL, so a refresh keeps them.
- **T8** A table with no rows says so, for example "No contacts match 'zz'", with a button to clear the search.

### Organizations

- **O1** Columns: name, industry, website, number of contacts, number of deals, open pipeline value. Search covers name, industry and website.
- **O2** Form fields: name (required), website, industry, notes.
- **O3** The organization's page shows its details, its contacts (name, job title, status) and its deals (name, stage, value, close date), each linking to its page, plus edit and delete buttons.
- **O4** Deleting an organization deletes its deals, with their activities and stage-change entries (D9). It keeps its contacts and clears their organization.

### Contacts

- **C1** Columns: name, organization, job title, email, phone, status. Search covers name, email, phone, job title and organization name.
- **C2** A status filter above the table: All, Lead, Qualified, Customer, with a count on each. It's kept in the URL and combines with search.
- **C3** Form fields: name (required), email (checked to be a valid address if given), phone, job title, organization (optional, searchable picker), status (required, default Lead).
- **C4** The contact's page shows their details, a link to their organization, their deals as main contact, a "Log activity" button, and their timeline.
- **C5** Deleting a contact keeps the deals they were main contact on and clears the main contact. It deletes the activities logged on the contact.

### Deals

- **D1** Columns: name, organization, main contact, stage, value, probability, close date. Search covers name, organization name and main contact name.
- **D2** Form fields: name (required), organization (required, searchable picker), main contact (optional, searchable picker; contacts of the chosen organization are listed first), stage (required, default New), value in US dollars (required, 0 or more, whole dollars), probability (0–100, filled from the stage), close date (optional), lost reason (shown only when the stage is Lost, up to 200 characters; cleared when the stage changes away from Lost, per D4a).
- **D3** Probability: choosing or moving to a stage sets the probability to that stage's usual value (New 10, Qualified 25, Proposal 50, Negotiation 75, Won 100, Lost 0). A probability typed by hand is kept until the stage changes again.
- **D4** Moving a deal to Won or Lost, by drag or by form, sets its close date to today. It can be edited afterwards.
- **D4a** Moving a deal from Lost to any other stage, by drag or by form, deletes its lost reason. Its close date stays as it was, and it takes the new stage's probability (D3). The "Moved to Lost" entry in its timeline keeps the reason it was given, as a record of what happened.
- **D5** Moving a deal to Lost on the pipeline opens a small dialog asking for an optional lost reason, with "Save" and "Skip" buttons. Escape or Cancel puts the card back where it was and changes nothing.
- **D6** A deal is late when its stage is open (not Won or Lost), it has a close date, and that date is before today. A late deal shows a Raspberry "Late" badge next to its close date in the table, on its page and on its pipeline card.
- **D7** Every stage change adds a stage-change entry, for example "Moved from Proposal to Negotiation", or "Moved from Negotiation to Lost: price too high" when there's a lost reason. Creating a deal adds "Created in New" (or whichever stage).
- **D8** The deal's page shows its details, links to its organization and main contact, its lost reason if Lost, a "Log activity" button and its timeline.
- **D9** Deleting a deal deletes its activities and stage-change entries.

### Pipeline

- **P1** One column for each open stage, in order: New, Qualified, Proposal, Negotiation. A fifth column holds Won above Lost, each with its own header and its own drop area (see Design choice). Each header shows the stage name, its number of deals, its total value and its expected revenue (value × probability).
- **P2** Won and Lost show only deals with a close date in the last 30 days, including today. Their headers count and total only the deals shown.
- **P3** Above the board: total value and expected revenue of all open deals, and the number of open deals.
- **P4** A card shows the deal name, organization, value, close date, probability, main contact's initials, and the Late badge if late. Clicking a card opens the deal's page.
- **P5** Dragging a card to another column changes its stage (D3, D4, D5, D7). Dragging within a column changes its place. A card stays exactly where it's dropped, including after a refresh.
- **P6** Totals update as soon as a card is dropped, before the server replies. If the server refuses the change, the card goes back and a message says the change wasn't saved.
- **P7** Each column has an "Add deal" button that opens the deal form with that stage chosen. The new deal goes to the top of the column.
- **P8** Drag and drop works with a mouse and with the keyboard (space to pick up, arrows to move, space to drop, Escape to cancel).

### Activities and timelines

- **A1** "Log activity" opens a form: type (Note, Call or Email; required), description (required, up to 2,000 characters), when it happened (required, date and time, default now), follow-up date (optional).
- **A2** An activity belongs to one contact or one deal, never both.
- **A3** A timeline lists entries newest first, by when they happened. Each shows an icon for its type, the description, the date, a link to the related record when the entry comes from somewhere else, and its follow-up date and done state if it has one.
- **A4** A contact's timeline shows activities logged on the contact and activities logged on deals where they're the main contact. A deal's timeline shows its activities and its stage-change entries.
- **A5** Activities can be edited and deleted from the timeline, with a confirmation for delete. Stage-change entries have no edit or delete.
- **A6** An activity with a follow-up date has a checkbox to mark it done, in the timeline and on the dashboard. Marking it done keeps the activity and removes it from the dashboard's follow-ups.

### Dashboard

- **H1** The dashboard covers a rolling 12 months: the current month and the 11 before it. It has no date picker.
- **H2** Headline figures: revenue won in the last 12 months (the largest figure on the page), deals won, win rate (won ÷ won and lost), average deal won and deals lost. With the pipeline visual: open pipeline value, expected revenue, number of open deals and how many are late.
- **H3** A bar chart of revenue won per month over the 12 months, by Won deals' close date, and a line chart of the running total of revenue won over the same months. One short sentence names the best month, for example "April was the best month, with US$41,500 from two deals."
- **H4** A bar chart of deals won per month, with deals lost per month beside them.
- **H5** A pipeline visual: a funnel of value reaching each stage, New to Won, for deals created in the 12 months. A deal counts towards every stage up to the furthest it has reached, Lost deals included up to the stage they reached before Lost.
- **H6** Open pipeline by stage: a horizontal stacked bar of open value split by stage, labelled with each stage's name and value, and a bar per stage showing its value with the expected part solid.
- **H7** Follow-ups: overdue ones first, under an "Overdue" heading with a Raspberry tint and a count by the panel title, oldest first; then those due in the next 14 days, under their own heading. Each shows the description, its contact or deal, the date, and a done checkbox. Shows at most 10, with "Show all" opening the full list.
- **H8** Recent activity: the 10 newest activities and stage-change entries across everything, each linking to its record.
- **H9** Every figure matches the data. Marking a deal Won or adding a follow-up shows on the dashboard as soon as you go back to it.

### Sample data

- **S1** A small wholesale business selling products to other businesses. About 20 organizations across at least six industries (for example restaurants, hotels, retail, offices, gyms, schools), 60 contacts, 40 deals and 150 activities.
- **S2** Contacts at every status. Some contacts with no organization (leads on their own).
- **S3** Deals between US$1,000 and US$40,000 at every stage: deals won and lost across the past 12 months, deals expected to close in the next few months, and three or four late deals. Each deal has a stage history that matches its current stage.
- **S4** Activities spread over the past 12 months, on contacts and on deals, with several follow-ups overdue, several due in the next two weeks and some done.
- **S5** Generated from a fixed random seed, with dates relative to the day of seeding, so it's the same each time apart from the dates.

### Out of scope

As the intent says: sign-in, user accounts or several users; dark mode or a phone layout; AI features; email, calendar or phone integrations; currencies other than US dollars; reports beyond the dashboard, including any report on lost reasons; tags or custom fields; changing the pipeline stages; importing or exporting data.

## Design

### Architecture

```
browser ── React app (Vite, port 5173) ── /api proxy ──> FastAPI (uvicorn, port 8000) ──> SQLite file
```

- `npm run dev` uses `concurrently` to run `uv run uvicorn backend.app.main:app --port 8000` and `npm run dev -w frontend`. Vite proxies `/api` to the backend, so the browser talks to one address, `http://localhost:5173`.
- The database file is `data/accountable.db` (git-ignored). The path comes from the `ACCOUNTABLE_DB` environment variable, so the tests use their own file.
- `npm run seed` runs `uv run python -m backend.app.seed`.
- `npm test` runs `npm run test -w frontend` (Vitest), then `uv run pytest`, then `npx playwright test`. Playwright's `webServer` starts the backend and frontend on other ports (8100, 5273) with a fresh seeded test database.

### Libraries

| Need | Library |
| --- | --- |
| Routing | React Router |
| Server data, caching, optimistic updates | TanStack Query |
| Tables (sorting, paging state) | TanStack Table |
| Charts | Recharts |
| Drag and drop | dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`) |
| Forms and checks | React Hook Form with Zod |
| Dialogs, menus, pickers | Radix UI primitives |
| Icons | Lucide |
| Dates | date-fns |
| Toast messages | Sonner |
| Fonts | `@fontsource` Instrument Sans, Instrument Serif, JetBrains Mono |
| Backend | FastAPI, Pydantic, SQLAlchemy Core, uvicorn |
| Sample data | Faker, with a fixed seed |

### Data model

All tables have `id` (integer primary key), `created_at` and `updated_at`.

**organizations**: `name` text not null, `website` text, `industry` text, `notes` text.

**contacts**: `name` text not null, `email` text, `phone` text, `job_title` text, `organization_id` → organizations (null on delete), `status` text not null in (`lead`, `qualified`, `customer`).

**deals**: `name` text not null, `organization_id` → organizations, not null (cascade delete), `main_contact_id` → contacts (null on delete), `stage` text not null in (`new`, `qualified`, `proposal`, `negotiation`, `won`, `lost`), `value` integer not null ≥ 0 (whole US dollars), `probability` integer not null 0–100, `close_date` date, `lost_reason` text, `position` integer not null (order within its stage column).

**activities**: `type` text not null in (`note`, `call`, `email`), `description` text not null, `occurred_at` datetime not null, `follow_up_date` date, `done` boolean not null default false, `contact_id` → contacts (cascade delete), `deal_id` → deals (cascade delete). A check constraint makes exactly one of `contact_id` and `deal_id` set.

**stage_changes**: `deal_id` → deals (cascade delete), `from_stage` text (null when the deal was created), `to_stage` text not null, `lost_reason` text, `changed_at` datetime not null.

Indexes on every foreign key, on `deals(stage, position)`, on `activities(follow_up_date, done)`, and on `name` for the three main tables. SQLite foreign keys are turned on for every connection.

Moving a deal renumbers `position` in the columns it left and joined, in one transaction. Positions are 0, 1, 2… top to bottom. With a few hundred deals per column at most, renumbering is cheap.

### API

JSON over `/api`. Errors use FastAPI's standard shape; a check that fails returns 422 with the field that failed.

| Method and path | Purpose |
| --- | --- |
| `GET /api/organizations?q=&sort=&dir=&page=&page_size=` | Paged list, with contact and deal counts and open value. Returns `{items, total, page, page_size}`. |
| `POST /api/organizations` | Create |
| `GET /api/organizations/{id}` | Details with contacts and deals |
| `PATCH /api/organizations/{id}` | Update |
| `GET /api/organizations/{id}/delete-impact` | Counts of linked contacts and deals, for the delete dialog |
| `DELETE /api/organizations/{id}` | Delete |
| `GET /api/organizations/options?q=` | Up to 20 `{id, name}` for pickers |
| `GET /api/contacts?q=&status=&sort=&dir=&page=&page_size=` | Paged list, plus counts per status |
| `POST`, `GET`, `PATCH`, `DELETE /api/contacts/{id}`, `GET /api/contacts/{id}/delete-impact`, `GET /api/contacts/options?q=&organization_id=` | As for organizations |
| `GET /api/contacts/{id}/timeline` | Merged timeline (A4) |
| `GET /api/deals?q=&sort=&dir=&page=&page_size=` | Paged list, with `is_late` |
| `POST`, `GET`, `PATCH`, `DELETE /api/deals/{id}`, `GET /api/deals/{id}/delete-impact` | As above. `PATCH` with a new stage applies D3, D4 and D7. |
| `GET /api/deals/{id}/timeline` | Activities and stage changes |
| `GET /api/pipeline` | Deals for the board by stage, in position order (Won and Lost limited per P2), with per-column and board totals |
| `POST /api/deals/{id}/move` | `{stage, before_id, lost_reason?}`: change stage and place in one step. `before_id` is the deal the card was dropped above, or null for the bottom of the column, because Won and Lost hide older deals and a visible index wouldn't match the stored order |
| `POST /api/activities` | Create, with `contact_id` or `deal_id` |
| `PATCH /api/activities/{id}`, `DELETE /api/activities/{id}` | Edit (including `done`) and delete |
| `GET /api/dashboard` | Everything the dashboard shows, in one response |
| `GET /api/follow-ups?scope=open` | Full list for "Show all" |

Sorting, searching and paging happen in the database, so the tables stay quick as records grow. Search uses `LIKE` with `lower()` on the searched columns. Every query is written with SQLAlchemy Core.

### Frontend structure

```
frontend/src/
  main.tsx, App.tsx          routes and layout
  api/                       typed fetch functions and TanStack Query hooks
  components/                DataTable, ConfirmDialog, RecordForm fields, Money, StageBadge, Timeline, EntityPicker, EmptyState
  features/dashboard/        figures, charts, follow-ups, recent activity
  features/organizations/    list, page, form
  features/contacts/         list, page, form
  features/deals/            list, page, form, lost reason dialog
  features/pipeline/         board, column, card
  lib/                       formatting, stage constants, dates
  styles/                    brand tokens as CSS variables
```

Routes: `/` dashboard, `/organizations`, `/organizations/:id`, `/contacts`, `/contacts/:id`, `/deals`, `/deals/:id`, `/pipeline`.

One `DataTable` component, built on TanStack Table in manual mode, serves all three lists. The stage list, labels, colors and usual probabilities live in one shared constants file in the frontend and one in the backend, and a test checks they match.

### Design choice

Three mockups of the dashboard and pipeline are in `docs/mockups/`, each with a screenshot: A (the first draft of this spec, with a Midnight sidebar), B (a Midnight top bar) and C (a light sidebar, opening with what needs attention). **B was chosen** on 26 Nov 2026. The reasons:

- **The board gets the full width.** With no sidebar, and Won and Lost sharing one column, the pipeline fits five columns on a 1280px screen without scrolling sideways, and cards have room for a deal name and its value on one line.
- **It answers "how are sales going?" first.** Revenue won is the largest thing on the dashboard, with the figures that explain it (deals won, win rate, average deal) beside it and the months behind it in a bar chart.
- **What needs doing stays in view.** Follow-ups and recent activity sit in a column on the right, beside the figures rather than below them, with overdue follow-ups grouped and tinted so they're hard to miss.
- **The pipeline is shown in one place.** Open value, expected revenue, late deals, the split by stage and the funnel sit together in one panel, which is the "visual of the pipeline" the intent asks for.
- **Closed deals stay secondary.** Won and Lost show only the last 30 days and usually hold a few deals, so they share a column as short rows, while open deals get full cards.

What changes from the first draft, and what B's mockup shows that the MVP leaves out:

- The pipeline has five columns, with Won above Lost in the last one (P1). Both stay drop targets. Won scrolls inside its own area after five rows, so Lost is always in reach while dragging.
- Revenue won by month is a bar chart, and the line chart shows the running total (H3).
- The mockup's search box in the top bar, and the board's "Filter this board" box and "Late only" chip, aren't in the intent, so they're not in the MVP. The top bar keeps that space empty for now.

### Layout

- A top bar across the page, 64px tall, with a Midnight `#073B4C` background: the Accountable logo and wordmark on the left, then the five sections with Lucide icons: Dashboard, Organizations, Contacts, Deals, Pipeline. Labels are Sea Mist `#CDD8DB`. The current section has a soft Sea Green fill (16%) behind it, white text and a Sea Green icon.
- The main area has the page background `#F0F4F5`, 32px padding, and a page header: the title (Instrument Sans, 28px, semibold, Midnight) and the page's main action on the right.
- Content sits in white panels with 12px corners, no outline and a very soft shadow (`0 1px 2px rgb(7 59 76 / 0.06)`). No border on one edge, no line across the top of the page.
- Designed for screens 1280px wide and up. Narrower than that, the section labels in the top bar hide and only their icons show. Wide tables scroll sideways inside their panel.

### Colors

Brand colors from the brand skill. Cerulean and Raspberry were darkened so white text on them passes 4.5:1, and every text version passes 4.5:1 on white and on `#F0F4F5`:

| Role | Fill | Text on the fill | Text version on white or `#F0F4F5` |
| --- | --- | --- | --- |
| Primary, Sea Green | `#06D6A0` | Midnight | `#037A5C` |
| Secondary, Marigold | `#FFC145` | Midnight | `#8A5A00` |
| Tertiary, Coral | `#F78C6B` | Midnight | `#B0472A` |
| Information, Cerulean | `#0E7A9F` | white | `#0B6A8A` |
| Alert, Raspberry | `#D33259` | white | `#C0264E` |
| Ink | Midnight `#073B4C` | | |
| Muted ink | `#4E6A75` | | |
| Lines inside panels (row dividers) | `#E3EAEC` | | |

Primary buttons are Sea Green with Midnight text. Secondary buttons are white with Midnight text on a `#E3EAEC` fill on hover. Destructive buttons are Raspberry with white text. Focus rings are 2px Cerulean.

**Stage colors** (badges, pipeline column markers, chart series):

| Stage | Color | Why |
| --- | --- | --- |
| New | Sea Mist `#CDD8DB`, Midnight text | Neutral start |
| Qualified | Cerulean `#0E7A9F` | |
| Proposal | Marigold `#FFC145` | |
| Negotiation | Coral `#F78C6B` | |
| Won | Sea Green `#06D6A0` | Success |
| Lost | Raspberry `#D33259` | Alert |

**Contact status**: Lead is Cerulean, Qualified is Marigold, Customer is Sea Green. Shown as soft badges: a 15% tint of the color with the text version of the color.

**Charts**: revenue won is Sea Green; deals won are Sea Green bars and deals lost are Coral bars; the funnel and pipeline bar use the stage colors. Axis text is muted ink at 12px, gridlines `#E3EAEC`, horizontal only. A single gradient is allowed under the revenue line (Sea Green at 25% fading to 0%), and nowhere else.

### Type

- Instrument Sans for headings, labels and body. Sizes: page title 28px semibold, panel title 16px semibold, body 14px, small 12px.
- JetBrains Mono for money, counts, percentages, dates in tables and record IDs, with tabular figures so columns line up. Numbers in tables are right-aligned.
- Instrument Serif only for the dashboard greeting line (for example "Good morning. Here's how sales are going.") and empty-state lines. Nowhere else.

### Formats

- Money: `US$12,400` in full. Big figures and chart axes use the short form `US$1.2M` and `US$48k`. Whole dollars only.
- Percentages: `75%`.
- Dates: `12 Mar 2026`; with time, `12 Mar 2026, 14:30`. Timelines show "Today", "Yesterday" for the last two days.
- Labels are short and plain: "Add deal", "Log activity", "Mark done", "Delete contact". No exclamation marks.

### Screens

**Dashboard** (`docs/mockups/b-dashboard.png`). Page header with the title and "Last 12 months · Dec 2025 to Nov 2026" on the right. Below, a main area and a 380px right-hand column.
- Main area, first panel: on the left, "Revenue won, last 12 months" with the figure at 44px in JetBrains Mono, the best-month sentence in Instrument Serif, and four smaller figures (deals won, win rate, average deal won, deals lost). On the right, the revenue by month bar chart.
- Main area, second panel, "Pipeline": open pipeline, expected revenue and open deals with a "3 late" badge; the stacked bar by stage; the per-stage bars. To the right, the funnel. An "Open the board" link goes to the pipeline.
- Main area, third row: the running total line chart beside the deals won and lost bar chart.
- Right-hand column: follow-ups (H7) with "Show all", then recent activity as a vertical feed with a type icon per entry.
- Charts have hover tooltips showing the exact value with currency.

**Lists.** Page header with title and "Add" button. One panel holding a toolbar (search box on the left; on Contacts, the status filter as a segmented control with counts) then the table, then the paging bar. Rows are 48px tall with dividers, a hover tint of `#F0F4F5`, and a "⋯" menu at the end with Edit and Delete.

**Record pages.** A header panel with the record's name, key facts (for a deal: stage badge, value, probability, close date with Late badge, organization, main contact), and Edit and Delete buttons. Below, two columns: on the left, linked records in panels (contacts and deals for an organization; deals for a contact); on the right, the timeline with "Log activity" at the top. An organization has no timeline, so its linked records use the full width.

**Timeline.** A vertical list. Each entry has a round icon in a tint of its type color (note: Marigold, call: Sea Green, email: Cerulean, stage change: Midnight tint), the description, the date in muted text, and for activities a "⋯" menu with Edit and Delete. Follow-ups show "Follow up 14 Mar 2026" with a checkbox; overdue ones in Raspberry text.

**Pipeline** (`docs/mockups/b-pipeline.png`). Page header with the title and "Add deal" on the right. Below, a panel with open pipeline, expected revenue, open deals and the stacked bar by stage. Then five columns that share the width. Each column sits on a faint Midnight tint (3.5%) with 12px corners. Its header is a block tinted in the stage color, with the stage name, the deal count, total value and expected revenue. Open deals are white cards, 10px corners: the deal name in semibold with the value (short form) on the same line, the organization in muted text, a 4px probability bar in the stage color, and a bottom line with the Late badge if late, the close date (Raspberry text version when late), the probability and the main contact's initials. The fifth column holds Won and Lost, each with its own tinted header, a short row per deal (name, value, organization, close date, and the lost reason for Lost), and its own "Add deal", with a note under them: "Won and Lost show deals closed in the last 30 days. Every closed deal is in the Deals table." A dragged card lifts with a stronger shadow and a 2° tilt; the drop place shows as a dashed outline. "Add deal" sits at the bottom of each column.

**Dialogs.** Centered, 480px wide (deal form 560px), white, 16px corners. Title, fields with labels above, checks shown under the field in Raspberry text version, Cancel and the main action at the bottom right. Escape closes. The first field has focus when it opens.

**Messages.** Toasts at the bottom right after saving or deleting ("Deal saved", "Contact deleted"), and when something fails ("Couldn't save the deal. Try again.").

### Accessibility

- Text meets 4.5:1 contrast, large text 3:1 (see Colors).
- Everything works with the keyboard, including drag and drop (P8), menus and dialogs. Focus is always visible.
- Charts have a short text summary for screen readers, for example "Revenue won rose from US$31k in December to US$58k in November."
- Form fields have labels; checks are announced.

### Testing

- **Backend (pytest)**: every endpoint, checks and errors; delete rules (O4, C5, D9); stage changes (D3, D4, D4a, D7) and positions; late rules; pipeline 30-day window; dashboard figures against hand-built data; the funnel; seed produces the right counts and a history for every deal.
- **Frontend (Vitest)**: money, date and percentage formatting; stage constants; probability rules in the deal form; table state in the URL; timeline ordering.
- **End-to-end (Playwright with installed Chrome)**: start on the dashboard with sample data; add, search, sort, page, edit and delete in each table, including the delete dialog text; contact status filter; log an activity and a follow-up and see it on the timeline and dashboard, then mark it done; drag a card to another column and within a column, refresh and check it stayed; drag to Lost with a reason; add a deal in a column; mark a deal Won and see the dashboard change; check the console has no errors on every page.
- Then a person goes through every section and action in a real browser, as success criterion 8 asks.
