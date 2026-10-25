# Features

## Authentication

- Split-screen login with an animated brand panel; the form shakes on a failed sign-in.
- `AuthProvider` context and `useAuth()` hook; `ProtectedRoute` guards every page except `/login`.
- Backed by a demo account in `LocalAuthRepository` (`demo@stiamo.app` / `password123`). This is a placeholder, not real security.

## Monthly calendar (`/`)

- Sunday-first month grid with direction-aware slide/blur transitions between months.
- **Tasks** (indigo), **follow-ups** (amber) and **meetings** (teal); timed items show their start time and sort first.
- Add from the + on any day; complete (animated check + strike-through) or delete inline.
- Month summary: counts per type and done/total.
- Click a day number (or "+N more") to open that day in the planner.

## Day planner (`/day`, `/day/yyyy-MM-dd`)

The planner turns a day's items into a timeline you can shape by hand.

| Interaction | What happens |
| --- | --- |
| Drag a card from **Unplanned** onto the timeline | It's scheduled; a live preview shows the exact slot and time range before you drop |
| Drag a block | Moves it, snapping to 15 minutes |
| Drag a block onto **Unplanned** | Unschedules it |
| Drag a block's bottom edge | Resizes it with a live duration badge |
| Click empty time | Opens "New entry" pre-set to that time, with duration chips |
| **Reflow from now** (`R`) | Packs unpinned blocks back-to-back from now (or 09:00 on other days) in their current order, flowing around pinned meetings and finished/completed blocks |
| **Auto-plan** | Same as reflow, then fits every unplanned item into the remaining free time |
| **Buffer** 0 / 5 / 10m | Breathing room inserted between packed blocks (remembered per browser) |
| Pin (hover icon or `P`) | Pinned blocks never move during reflow. Meetings are pinned by default |
| Undo (toast button or `Ctrl/⌘+Z`) | Reverts the last move, resize, plan, pin or reflow |
| Keyboard on a focused block | `↑/↓` move 15m (`Alt` = 1h), `Shift+↑/↓` resize, `Enter` complete, `Delete` unplan |

Also on the page:

- **Now line** with a pulsing marker; the elapsed part of the day is shaded and the timeline scrolls to the current time.
- **Now & Next** card: the current block with a progress bar and time left, or how long you're free, plus what's next.
- **Overlap detection**: overlapping blocks sit side by side, get a red ring, and the header counts them.
- Header stats: progress ring (done/total), planned time, time still ahead.
- Quick add in the tray (click the dot to cycle task → follow-up → meeting).

## Motion & accessibility

- One motion language (`presentation/motion/presets.ts`): fast springs and blur-fades.
- `MotionConfig reducedMotion="user"` respects the OS reduced-motion setting.
- Dark mode follows the OS colour scheme.
- Timeline blocks are focusable, labelled with their times, and fully keyboard operable.

## Demo data

On first load in a browser, a lived-in day is seeded for the demo account (meetings, tasks, follow-ups around today). Clear the `stiamo.*` keys in `localStorage` to start fresh.

## Known limitations

- Data is local to the browser; there is no backend.
- No recurring events, time zones, or multi-day blocks yet.
- Drag and drop is pointer-based. Keyboard users move blocks with the arrow keys instead of dragging.
