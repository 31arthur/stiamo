# Features

Sign in with the demo account `demo@stiamo.app` / `password123`. A realistic practice is seeded on first run (three S&B cases with hearings, appointments with confirmations, FSA and media meetings, plans and goals). Clear the `stiamo.v2.*` keys in `localStorage` to start fresh.

## Everywhere

- **Sidebar** grouped by intent: Plan (Today, Calendar) · Execute (Tasks, Follow-ups, Meetings) · S&B Legal (Cases) · Direction (Action plans, Goals). Badges show what's slipping: overdue tasks, due follow-ups, meetings without outcomes, hearings not written up.
- **One loading indicator** for every wait: the three bars of the logo filling in turn (`Spinner`). It shows as a full-screen mark while the app starts and you're signed in, a page-sized mark (after a short beat, so quick loads never flash it) while a section or your data loads, shimmering placeholders (`Skeleton`) in the shape of a record's page while it loads, inline beside text ("Loading the page editor…"), and inside any button that starts a save, delete or create — which is also disabled until it finishes. It respects reduced-motion settings. Pages wait for the first snapshot of your data, so a list never flashes "nothing here"; if a table is missing the page shows after a few seconds with the sync banner explaining.
- **Workspace lens** — All, Personal, S&B Consultants, FSA, Media. Filters every list, the calendar and the planner; remembered per browser.
- **New ▾** and **Ctrl/⌘ K** command palette: create anything, jump to any page, search cases, meetings, plans, goals and tasks.
- **Outcome control** on every task, follow-up, meeting, hearing and agenda item: one click to mark done, or record partly done / not done / cancelled with a comment and a further action, optionally created right away as a linked task or follow-up.
- **Linked chips** show where things came from and open them (plan, case, appointment, hearing…).

## Today — day planner (`/today`, `/today/yyyy-MM-dd`)

One timeline for tasks, appointments, meetings, follow-ups and court hearings, coloured by workspace.

| Interaction | What happens |
| --- | --- |
| Drag from **Unplanned** onto the timeline | Schedules it; a live preview shows the exact slot first |
| Drag an **overdue** task (from earlier days) in | Pulls it into this day |
| Drag a block / its bottom edge | Moves / resizes on a 15-minute grid. Moving an appointment re-times its confirmation calls |
| Drag a block back to **Unplanned** | Takes it off the timeline (meetings always keep a time) |
| Click empty time | Add a task, follow-up, appointment or meeting at that time |
| **Reflow from now** (`R`) | Packs flexible blocks back-to-back in their current order, flowing around pinned ones (meetings, hearings, confirmation calls) |
| **Auto-plan** | Same, then fits unplanned work into the free time |
| **Buffer** 0/5/10m | Space between packed blocks |
| Undo (toast button or Ctrl/⌘ Z) | Reverts the last move, resize, plan or reflow |
| Keyboard on a block | ↑/↓ move (Alt = 1h), Shift+↑/↓ resize, Enter opens, Delete unplans |

Plus: the now-line, **Now & Next**, overlap detection, and a **Needs attention** rail (hearings to write up, meetings to record, follow-ups due) you can act on while planning.

## Calendar (`/calendar`)

Monday-first month view of the unified agenda, coloured by workspace with kind icons and times; hearings are outlined. Click an entry to open it, a date to plan that day, + to create on that date.

## Tasks (`/tasks`)

Grouped by date (Overdue, Today, Next 7 days, Later, No date) or by workspace; filter by open / outcome recorded. Priority flags, plan and source chips, the recorded outcome with its comment and further action. Quick add for today.

## Follow-ups (`/follow-ups`)

Overdue, Today, Upcoming and Recently logged. Follow-up wording for outcomes (Reached, Left message, No answer). Confirmation follow-ups are labelled and link to their appointment.

## Meetings & appointments (`/meetings`, `/meetings/:id`)

- List by Upcoming / **Needs outcome** / Past, filter by kind; cards show confirmation status and agenda coverage.
- Detail page: **agenda builder** (drag to reorder, owner, minutes, notes, per-item outcome with further actions, warning when the agenda overruns the slot), **minutes**, **outcome**, **preparation plan** (one click from the agenda), **confirmations**, attendees.

## Cases (`/cases`, `/cases/:id`) — S&B Consultants

- **Opening a case** asks which organization it's filed for (NUMW, TUMWU, PMLU, MRC, TYP, Samrat & Associates) and its type (PoW, Public Interest, Industrial Disputes, MW, Workmen Compensation, Other), who handles it (us by default, or outside counsel with terms), previews the generated case number (`TUMWU-2026-004`) and assigns it on save. The court's own number is an optional extra field.
- Register with next hearing (relative date), last hearing result, plan progress, and a red flag for hearings not yet written up.
- Detail: case summary (autosaves), **hearing timeline**, **Record hearing** (the diary write-up: what happened → order → result → next listing → work due → action plan → stage/status, all in one dialog), the **case diary**, action plans with inline steps and outcomes, upcoming appointments, open follow-ups and tasks for the matter.

## Case diary (`/diary`, and on every hearing)

Indian advocates keep a **court diary**: the date, the case, the bench, what was argued, the authorities cited, the order, the next date and what it is fixed for. There is no prescribed format for an advocate's own diary (the Bar Council rules only require trainees to keep one, with the date, case number, arguments, case law cited and result), so this follows that practice and adds what it is for: **turning each date into the work for the next**.

**The diary is the hearing record — there is no second thing to keep in step.** Writing up a hearing *is* writing its diary entry, and it shows in the case's hearing timeline and on the Case diary page from the same data. *Record hearing* asks: what happened, the **order and directions**, the result, then (collapsed) bench, submissions, **authorities cited**, evidence (witnesses examined or still to come, exhibits) and your own **reflections**, the next listing, and the **work due before the next date** (each action with an optional deadline — a court direction is just an action with a date), and an action plan. The next date and what it is listed for come from the next hearing, not typed twice.

- **Actions follow their tasks.** The actions become the plan's **steps (tasks), each due by its own date** (or the next hearing's). On a recorded hearing an action shows its task's state (done ones are ticked off). Actions with no task yet have **Make tasks** and **Start a plan**.
- **One record for several cases.** When connected matters are taken up together, a hearing can be **heard together with** other cases — choose them in the hearing form **or right in *Record hearing***. If a chosen case already has its own listing for the same day that hasn't been written up, it is **folded into this hearing** (its plans, the hearing it led to, tasks, follow-ups and documents move across); one that has already been written up on its own stays separate, and the form says which will happen before you save. The pencil on a hearing (and on the diary page) edits the cases at any time. It is listed once, on every one of those cases; it is written up once; the next hearing it leads to and the plan made from it cover all of them; it appears once on the diary page. Deleting a case leaves a shared hearing with the others.
- **Revising** a hearing reopens the same record, and doesn't list or plan a second time by default.
- **Search**: the diary page searches every entry (orders, authorities, notes, actions, case numbers and titles) and filters by case.
- Chamber work isn't tracked separately.

## Counsel (`/counsel`, `/counsel/:id`)

A directory of the outside **advocates and law firms** you know, with filters (advocates / firms / pro bono) and search. Each profile has contact buttons, the courts they appear before, what they're good for, notes, **every case they're briefed on with the terms** (fee or pro bono, scope, date), documents and a thread. On a case, **Handled by** shows "us" or the counsel with the terms; *Brief counsel* / *Change brief* / *Take it back* manage it, and the case list shows who is on each case.

## Clients (`/clients`, `/clients/:id`) and Projects (`/projects`, `/projects/:id`) — FSA

Two separate places in the FSA part of the sidebar. **Clients** (a company or an individual, with a contact person, phone, email, status prospect / active / past) are cards showing their projects in progress and their next meeting. **Projects** are the work done for them (planned, in progress, on hold, completed, cancelled; start and due dates), listed across every client with a client filter, search, open-task counts and a *Show finished* switch. A client can have any number of projects.

A client's page gathers everything: its projects, the **meetings and appointments** with them (coming up, then earlier) with a *Schedule* button, the **tasks**, documents and a thread. A project's page is the same for that one piece of work, with a status switch. Scheduling from there files the meeting under FSA and ties it to the client or project (and fills in who it's with). Any meeting or task in the FSA workspace also has a *Client / project* field in its form.

## Action plans (`/plans`, `/plans/:id`)

Cards with progress, due date, origin, case and linked goals. Detail: reorderable steps with outcomes — **each step is a task, a follow-up or an appointment** (change the kind from the chip on the step; the step keeps its place, day, notes and outcome) and **has its own due date**, editable on the step, separate from the plan's deadline (a step due after the plan's deadline says so). New steps start from the plan's date, which you can change before adding. Follow-ups and appointments show up in Follow-ups, Meetings, Calendar and Today like any other, and count towards the plan's progress. Also: outcome breakdown, the further actions noted on steps, and one-click linking to any number of goals.

## Goals (`/goals`, `/goals/:id`)

Portfolio counts by health and cards with a progress ring, **progress vs time** bar, and key results. Detail: health breakdown (key results / plans / time elapsed), key results with +/- updates, linked plans (link existing, create new, unlink), check-ins with confidence 1–5, mark achieved.

## Cloud sync and accounts

Email/password accounts (create account, sign in, reset password) backed by Supabase, with live sync across devices. Without a Supabase config the app runs fully offline with a demo account. See [SUPABASE.md](SUPABASE.md).

## Threads, links and history

- Open a **task or follow-up** anywhere to get a side sheet with Overview, Files and **Thread & history**.
- Cases, meetings, plans and goals have the same thread view: what it belongs to, a collapsible tree of everything that grew out of it, records you've linked by hand, and a merged timeline (created, outcome recorded, rescheduled, linked, files attached, notes).
- A case lists **every connected meeting**; link existing ones with *Link*.
- Follow-ups can be **anytime**, on a day, or at a time.

## Documents

Attach to tasks, follow-ups, meetings, appointments, cases, each hearing, plans, goals, counsel, clients and projects — **upload** (drop, paste or browse, 25 MB each) or **link** a Google Doc, Sheet, Slides, Drive file or folder, or any web address (*Add link*, or paste a Google address onto the panel). A paperclip count shows on rows.

Every document opens in the same previewer, with arrow-key navigation across the record's files:

| What | How it shows |
| --- | --- |
| Google Docs / Sheets / Slides / Drive files and folders | framed in place from Google. They show for anyone Google would let open them: shared "anyone with the link", or with the Google account that's signed in. If the frame is blank or asks to sign in, the file isn't shared with you yet — *Open* goes to Google. |
| Images | in place, click to zoom |
| PDF | in the browser's viewer |
| Word `.docx` | read in the browser and shown as a document (scripts blocked) |
| Excel `.xlsx`, CSV / TSV | as tables, one tab per sheet (first 1,000 rows) |
| Video, audio, text | in place |
| PowerPoint, old `.doc` / `.xls`, anything else | open or download. For a stored file there is an opt-in *Preview with Microsoft Office online*, which sends them a temporary link — nothing is sent unless you choose it. |

A linked document stores only the address; nothing is uploaded.

## Plan pages

**New action plan** doesn't open a form: it creates the plan and opens its page straight away, with the cursor in the title (from a case or goal it arrives already linked to it). Everything on the page saves as you go — title, objective and properties on commit, the block editor 0.7 s after you stop typing and again when you leave the page — with a *Saving… / Saved* indicator at the top. A plan is a page: cover, editable title and objective, a properties table (status, due, workspace, progress, origin, goals), tracked steps, then a **Notion-style editor** (`/` for headings, lists, to-dos, toggles, tables, quotes, code, images, video, audio, files) and a **Drawing** block (Excalidraw) that re-opens for editing.

**Working a plan out.** Plans are written the way you'd think on paper. Type `??` and a space (or `/` → Question) to ask a question; press Enter to answer it; Enter again adds another line of the answer; Enter on an empty answer starts the next question. A question marks itself **Answered** once it has an answer beneath it, or you can **park** it for later. Type `!!` (or `/` → Insight) to mark an insight once something is concrete. A **Working it out** panel beside the page (above it on a phone) counts answered questions, lists what's still open (click to jump to it) and gathers all the insights, each with *Add as a step*.

**What a plan applies to.** The *Applies to* row lists what the plan covers, and one plan can cover **several cases and several hearings** — the same approach reused across a batch of matters, or across the dates of one case. It stays *one* page with *one* set of steps, shared by all of them; hearings sit under their case, a case with no hearings listed is covered as a whole, and a plan about a single task is exclusive of cases and hearings. *Add* picks from hearings, cases and tasks; each chip has a ×.

From the other side, a case's **Action plans** has *Reuse* and each open hearing has *Use a plan for this hearing*: pick an existing plan and it now covers that too (plans already on the case are offered first). When each hearing needs its own progress instead, **Make a copy** on the plan page duplicates the page and steps (all reset to open), covering nothing until you link it.

A plan made when you write up a hearing is for the next hearing and shows under that hearing; a plan for a task appears in that task's thread.

**Back.** Every detail page has a Back button that returns to where you came from, falling back to its list if you opened it directly.

## Mobile

Bottom tab bar with a create button; dialogs become bottom sheets with a pinned action bar; the calendar shows dots plus a selected-day list; planner drag uses long-press so scrolling still works; nothing scrolls sideways at 375 px. The app is installable (web manifest, icons, theme colour).

## Known limitations

- Cloud mode needs the one-time console setup in [SUPABASE.md](SUPABASE.md); until then the app runs offline on this device.
- No recurring events, reminders/notifications or time zones.
- Drag and drop is pointer-based; keyboard users move blocks with arrow keys.
