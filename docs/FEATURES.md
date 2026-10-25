# Features

Sign in with the demo account `demo@stiamo.app` / `password123`. A realistic practice is seeded on first run (three S&B cases with hearings, appointments with confirmations, FSA and media meetings, plans and goals). Clear the `stiamo.v2.*` keys in `localStorage` to start fresh.

## Everywhere

- **Sidebar** grouped by intent: Plan (Today, Calendar) · Execute (Tasks, Follow-ups, Meetings) · S&B Legal (Cases) · Direction (Action plans, Goals). Badges show what's slipping: overdue tasks, due follow-ups, meetings without outcomes, hearings not written up.
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

- Register with next hearing (relative date), last hearing result, plan progress, and a red flag for hearings not yet written up.
- Detail: case summary (autosaves), **hearing timeline**, **Record hearing** (summary → result → next listing → action plan with steps → stage/status, all in one dialog), action plans with inline steps and outcomes, upcoming appointments, open follow-ups and tasks for the matter.

## Action plans (`/plans`, `/plans/:id`)

Cards with progress, due date, origin, case and linked goals. Detail: reorderable steps with outcomes, outcome breakdown, the further actions noted on steps, and one-click linking to any number of goals.

## Goals (`/goals`, `/goals/:id`)

Portfolio counts by health and cards with a progress ring, **progress vs time** bar, and key results. Detail: health breakdown (key results / plans / time elapsed), key results with +/- updates, linked plans (link existing, create new, unlink), check-ins with confidence 1–5, mark achieved.

## Known limitations

- Data lives in the browser; there is no backend or multi-device sync yet.
- No recurring events, reminders/notifications or time zones.
- Drag and drop is pointer-based; keyboard users move blocks with arrow keys.
