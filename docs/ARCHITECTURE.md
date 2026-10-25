# Architecture

Stiamo follows Clean Architecture with three layers. Dependencies point inward only: **presentation → domain ← data**.

```
src/
  domain/          Pure TypeScript: entities, repository interfaces, use cases
    auth/
    calendar/
  data/            Repository implementations (currently localStorage)
    auth/
    calendar/
  presentation/    React: providers, hooks, pages, components
    auth/
    calendar/
    pages/
  di/container.ts  Composition root wiring data implementations to use cases
  components/ui/   shadcn/ui primitives
```

## Layers

- **Domain** knows nothing about React, storage or HTTP. It defines entities (`User`, `CalendarItem`), repository contracts (`AuthRepository`, `CalendarRepository`), business rules (validation, month grid building) and use cases.
- **Data** implements the domain's repository interfaces. `LocalAuthRepository` and `LocalCalendarRepository` use `localStorage`; swapping in an HTTP API means adding a new class and changing one line in the container.
- **Presentation** renders UI and calls use cases through hooks/providers. It never touches a repository directly.
- **DI container** (`src/di/container.ts`) is the only place concrete classes are constructed.

## SOLID mapping

| Principle | Where |
| --- | --- |
| Single responsibility | One use case per action; `monthGrid` only builds grids; components split into calendar, dialog, rows |
| Open/closed | New storage backends or features are added by new classes, not by editing use cases |
| Liskov | Any `AuthRepository` / `CalendarRepository` implementation is substitutable |
| Interface segregation | Small repository interfaces; `AuthProvider` receives only the `auth` use cases |
| Dependency inversion | Use cases depend on repository interfaces; concrete classes are injected in the container |

## Auth flow

`AuthProvider` restores the session on mount via `GetCurrentUserUseCase`, exposes `user`, `isLoading`, `login`, `logout` through `useAuth()`. `ProtectedRoute` redirects unauthenticated visitors to `/login` and returns them to the originally requested page after sign-in.
