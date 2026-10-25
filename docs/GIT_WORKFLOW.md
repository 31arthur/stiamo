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
