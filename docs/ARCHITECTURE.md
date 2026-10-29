# Architecture

Stiamo follows Clean Architecture with three layers. Dependencies point inward only: **presentation → domain ← data**, wired together in one composition root.

```
src/
  domain/                     Pure TypeScript — no React, no storage
    shared/                   Entity, Outcome, Workspace, time helpers, Repository port,
                              CrudUseCases, validation, RecordOutcomeUseCase, registry
    tasks/ meetings/ followups/ cases/ plans/ goals/
                              Aggregates + their use cases (MeetingUseCases, CaseUseCases, PlanUseCases)
    agenda/                   Agenda read model, month grid, AgendaUseCases (schedule, reflow, undo)
    planner/                  dayPlan: overlaps, layout, packing
    auth/                     User, AuthRepository port, login/logout use cases
    domain.test.ts            Domain + use-case tests
  data/
    storage/                  LocalRepository<T> (Web Storage), clock, id generator
    seed/                     Demo practice, created through the use cases
    auth/                     Demo auth repository
  di/container.ts             Composition root: createContainer(storage)
  presentation/
    app/                      ServicesProvider (DI + TanStack Query), EditorHost (create/edit dialogs),
                              workspace filter, attention selector
    data/hooks.ts             useEntities, useAgenda, useAction (mutations), useSave/useRemove
    components/               Outcome editor/controls, forms kit, layout, progress, workspace & kind visuals
    forms/                    One form per aggregate
    layout/                   App shell (sidebar), command palette, logo
    planner/                  Timeline, blocks, tray, drag ghost, Now & Next, useDayPlanner
    pages/                    Today, Calendar, Tasks, Follow-ups, Meetings(+detail), Cases(+detail),
                              Action plans(+detail), Goals(+detail), Login
  components/ui/              shadcn/ui primitives (Base UI)
```

See [DOMAIN.md](DOMAIN.md) for the model and [SUPABASE.md](SUPABASE.md) for the backend.

Additional pieces since v2:

- `domain/relations` (links + `RelationGraph`), `domain/activity` (history), `domain/attachments` (files and the `FileStore` port).
- `data/supabase` (Auth, a JSON-document Postgres repository kept current by Realtime, error messages), `data/files` (Supabase Storage and IndexedDB stores). Schema + row-level security: `supabase/migrations/0001_init.sql`.
- `di/backends.ts` (offline) and `di/supabaseBackend.ts` (cloud, lazy-loaded) feed `createContainer(backend)`.
- `presentation/data/live.tsx` subscribes to every collection and pours snapshots into the query cache; screens never fetch on their own.
- `presentation/relations`, `presentation/attachments`, `presentation/editor` (BlockNote + Excalidraw, both lazy-loaded).

## Layers

- **Domain** defines entities, rules and use cases. Repositories are **ports** (`Repository<T>`); time and ids come from injected `Clock` and `IdGenerator`, so logic is deterministic under test.
- **Use cases** come in two shapes:
  - `CrudUseCases<K>` — generic list/get/create/update/remove per aggregate with a per-kind **normalizer** for validation (`validation.ts`).
  - Dedicated use cases wherever there's real behaviour: `MeetingUseCases` (confirmation sync), `CaseUseCases.recordHearing`, `PlanUseCases` (steps, goal links, safe delete), `RecordOutcomeUseCase` (outcome + spawned further action), `AgendaUseCases` (unified agenda, scheduling, reflow, undo).
- **Data** implements the ports. `LocalRepository<T>` stores each aggregate as a JSON array under `stiamo.v2.*`. Replacing it with an HTTP API means writing one class per port and changing `createContainer`.
- **Presentation** never touches a repository. Components read through TanStack Query hooks that call use cases, and write through `useAction`, which surfaces errors as toasts and refreshes all reads after any change (records are heavily linked: a hearing write-up touches cases, hearings, plans, tasks and the agenda).

## SOLID

| Principle | Where |
| --- | --- |
| Single responsibility | Aggregates hold data and pure rules; each use case does one job; components split by concern (OutcomeEditor, PlanSteps, AgendaEditor…) |
| Open/closed | New behaviour is new use cases or normalizers; `CrudUseCases` is reused, not edited, per aggregate |
| Liskov | Any `Repository<T>` implementation is substitutable — tests use the same container on in-memory storage |
| Interface segregation | Narrow ports (`Repository`, `Clock`, `IdGenerator`); the seed depends on a minimal `SeedTarget` slice, not the whole container |
| Dependency inversion | Use cases depend on ports; concrete classes are created only in `createContainer`, which the app receives as a prop |

## State & motion

- **TanStack Query** caches reads (`staleTime: Infinity`; mutations invalidate). The planner patches the agenda cache **optimistically** so drops land instantly, then persists and refetches.
- **Undo** in the planner stores prior snapshots (`AnyEntity`) returned by `AgendaUseCases` and writes them back with `restore`.
- **Motion** (`motion/react`) for transitions and layout animation; **dnd-kit** for timeline drag and drop; `Reorder` for agenda/step ordering. `MotionConfig reducedMotion="user"` respects OS settings.
- Pages are **lazy-loaded** per route.

## Testing

`npm test` runs Vitest. `domain.test.ts` covers confirmation timing and sync, agenda building, reflow, overlap layout, outcome-weighted progress, goal health, and use-case flows (recording a hearing, spawning further actions, rescheduling with undo, seed consistency) against the real container on in-memory storage.

## Backends

`main.tsx` picks one at start-up, in this order: **Stiamo backend** (`VITE_API_URL`), **Supabase** (`VITE_SUPABASE_*`),
otherwise **offline** (browser storage). All three produce the same `Container`, so no screen knows which it has.

The Stiamo backend runs the domain rules on the server, so `data/api/` holds *remote use cases* with the same signatures
the screens already call (`RemotePlans.addStep`, `RemoteCases.recordHearing`, …): each is one request, and the server's
answer is what the screen shows. The browser keeps the live views fresh by refetching after its own writes, on a timer,
and when the tab or network returns (`ChangeBus`, `ApiRepository.subscribe`).

### Sign-in and tokens (`data/api/ApiHttp.ts`)

- `login`/`register` return an **access token** (JWT, ~15 min) and a **refresh token** (30 days). Both are stored in one
  `Session` (`localStorage`, shared by tabs). The access token goes in `Authorization: Bearer`; the refresh token is only
  ever sent to `/v1/auth/refresh`.
- A request renews the access token first when it has under 30 s left, and if the server still answers 401 it renews once
  and repeats the request. A second 401 ends the session.
- Renewing **rotates** the refresh token and the server treats a second use of an old one as theft (it revokes the whole
  sign-in). So renewal is single-flight within a tab and serialised across tabs with the Web Locks API; a tab that waited
  re-reads the stored session and uses what the winner saved.
- Only a refresh the server **rejects** (401) signs the user out. Offline or a 5xx keeps the session and retries later.
- `logout` revokes the refresh token on the server, then clears the session. Tabs follow each other through the
  `storage` event. Old Supabase sessions are removed on start-up.
- Trade-off: tokens in `localStorage` are readable by any script on the page, so the app avoids third-party scripts and
  keeps access tokens short. Moving the refresh token to an httpOnly cookie is the next step if the backend and app share a site.

### Searching Google Drive (`domain/drive`, `data/api/RemoteDrive`, `presentation/drive`)

With the Stiamo backend, the app can search the owner's Drive by file **name and content** without copying anything: the
backend's `drive` service asks Google, and the app receives only each match's name, date and link. `container.drive`
(`DriveApi`) is `NO_DRIVE` offline and with Supabase, and `useDriveStatus()` hides every Drive control unless the server
says it is available (connected, and this account's email is allowed).

- **Command palette** (Ctrl/⌘+K): from three characters, a "Letters in Drive" group (debounced); choosing one opens it in Drive.
- **Find in Drive** on any record's Documents panel: search, or, on a case, suggestions first. `caseSearchTerms` turns the
  case number, court number, title, client and opposing party into exact-phrase searches, and a letter that matches more
  of them ranks higher. **Link** attaches the file as an ordinary link attachment (`attachLink`), so it previews in place.
