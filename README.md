# Stiamo

A personal operating system for a practitioner working across **S&B Consultants (legal)**, **FSA (tech)**, **media duties** and **personal** life.

- **Cases & hearings** — running case summaries, hearing write-ups, and an action plan for every next stage
- **Appointments & meetings** — automatic confirmation calls (day before / hour before), agendas, preparation plans, minutes
- **Tasks & follow-ups** with recorded **outcomes** — done, partly done, not done, cancelled, with comments and further actions
- **Action plans** that roll up into **goals** with key results and health tracked against time
- A **day planner** to drag the day into shape, reflow it, and undo; a month **calendar** of everything

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Base UI), TanStack Query, Motion, dnd-kit, React Router, date-fns, sonner, Vitest. Clean Architecture (domain / data / presentation) with SOLID use cases.

## Getting started

```bash
npm install
npm run dev
```

Sign in with `demo@stiamo.app` / `password123`. A demo practice is seeded on first run.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run domain and use-case tests (Vitest) |

## Documentation

- [Domain model](docs/DOMAIN.md) — workspaces, outcomes, aggregates, how they link
- [Architecture](docs/ARCHITECTURE.md) — layers, use cases, SOLID mapping, state and motion
- [Features](docs/FEATURES.md) — every screen and interaction
- [Git workflow](docs/GIT_WORKFLOW.md) — branching and merge conventions
- [Roadmap](docs/ROADMAP.md)
