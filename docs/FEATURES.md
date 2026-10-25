# Features

## Authentication

- Login page with email and password validation (`LoginUseCase`).
- `AuthProvider` context and `useAuth()` hook.
- `ProtectedRoute` guarding every page except `/login`.
- Sign out from the header.
- Backed by a demo account in `LocalAuthRepository` (`demo@stiamo.app` / `password123`). This is a placeholder, not real security.

## Monthly calendar

- Sunday-first month grid, padded with adjacent-month days; today is highlighted.
- Previous / next month and a Today button.
- **Tasks** (blue) and **follow-ups** (amber, prefixed with ↪) shown on their day.
- Add an item from the + button on any day (title required, optional notes).
- Mark items done (strike-through) and delete them.
- Items are stored per user in `localStorage` (`stiamo.calendar-items`).

## Known limitations

- No edit-in-place or drag-and-drop between days yet.
- Data is local to the browser; there is no backend.
