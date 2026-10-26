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
