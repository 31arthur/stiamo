# Git workflow

The repository's default branch is `dev`; it acts as the trunk.

1. Branch from `dev`: `feature/<name>`, `fix/<name>` or `docs/<name>`.
2. Commit with Conventional Commit messages (`feat:`, `fix:`, `docs:`, `chore:`).
3. Make sure `npm run build` passes.
4. Merge into `dev` with `--no-ff` and push both the feature branch and `dev`.

## History so far

| Branch | Content |
| --- | --- |
| `feature/project-scaffold` | Vite, TypeScript, Tailwind, shadcn/ui |
| `feature/auth` | Login, `AuthProvider`, `ProtectedRoute` |
| `feature/calendar` | Monthly calendar with tasks and follow-ups |
| `docs/project-documentation` | These documents |
| `feature/ui-motion-polish` | Motion system, app shell, animated login and calendar |
| `feature/day-planner` | Day planner with drag and drop, reflow, undo; Vitest |
| `feature/firebase-backend` | (superseded) Firebase backend |
| `feature/supabase-backend` | Supabase Auth, Postgres + RLS, Realtime, Storage replace Firebase |
| `feature/relationships-threads` | Links, activity history, thread views, flexible follow-ups |
| `feature/attachments` | Files on every record with preview |
| `feature/plan-block-editor` | Notion-style plan pages and drawings |
| `feature/mobile-and-meta` | Mobile layouts, icons, manifest |
| `feature/v2-practice-model` | Domain rebuilt: workspaces, outcomes, appointments/meetings, follow-ups, cases & hearings, action plans, goals; new shell and every screen |
| `feature/api-backend` | Connect to the Stiamo backend: JWT sign-in with refresh rotation, server-run use cases, live views by polling |
