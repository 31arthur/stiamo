# Supabase setup

Stiamo runs in two modes, chosen at start-up:

| Mode | When | Data lives in |
| --- | --- | --- |
| **Cloud** | `.env.local` has the Supabase URL and publishable key | Supabase Auth + Postgres (+ Storage for files) |
| **Offline demo** | no Supabase config | this browser's storage; demo login `demo@stiamo.app` / `password123` |

## 1. Configure the app

Copy `.env.example` to `.env.local` and fill in your project's values (Dashboard → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

`VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` work too. `.env.local` is git-ignored; restart `npm run dev` after editing it.

The **publishable key is designed to be public** — it only identifies the project. What protects your data is row-level security (below). Never put the `service_role` / secret key in this app.

## 2. Create the tables (one time)

Open the Supabase dashboard → **SQL Editor → New query**, paste the contents of each file in [`supabase/migrations`](../supabase/migrations) in order (`0001_init.sql`, `0002_counsel.sql`, then `0003_clients_projects.sql`) and **Run**. They are safe to run again.

It creates, for each collection, a table of JSON documents (`id`, `user_id`, `data`), turns on **row-level security** so each signed-in user can only read and write their own rows, enables **Realtime** on the table, and creates a private **`attachments`** storage bucket whose policies confine each user to their own folder.

| Table | Holds |
| --- | --- |
| `tasks`, `follow_ups` | tasks and follow-ups |
| `meetings` | meetings and appointments (with agendas) |
| `cases`, `hearings` | legal cases and hearings (a hearing's write-up and the cases it concerns are inside its document) |
| `counsel` | outside advocates and law firms |
| `clients`, `projects` | FSA's clients and the projects done for them |
| `plans`, `goals` | action plans (incl. page content) and goals |
| `links`, `activity` | hand-made links and the history trail |
| `attachments` | file metadata (bytes are in Storage; a linked Google Doc is just a row, with no bytes) |

## 3. Add your account (sign-up is off)

The app does not show account creation by default, so nobody can register themselves. Add yourself in the dashboard instead: **Authentication → Users → Add user → Create new user**, enter your email and a password, and tick **Auto Confirm User** (no email needed). Then sign in with those details on the login page.

To make this airtight, also turn off **Authentication → Sign In / Providers → Allow new users to sign up** — hiding the form only hides the form; this setting is what stops anyone calling the sign-up API directly. To bring the form back, set `VITE_ALLOW_SIGNUP=true` in `.env.local` (and re-enable sign-ups in the dashboard).

## 4. Authentication settings

Dashboard → **Authentication**:

- **Sign In / Providers → Email** must be enabled (it is on by default).
- **Confirm email** is a choice. If it's **on**, new accounts must click the link in an email before first sign-in (the app tells them). For personal use you can switch it off for instant sign-up.
- **URL Configuration**: set *Site URL* to where the app runs (e.g. `http://localhost:5173` while developing, your hosted address later) and add it to *Redirect URLs* — confirmation and password-reset links use it.

## How it behaves

- **Live sync.** Each table is subscribed through Realtime; a change on one device shows up on the others straight away. The app refetches whenever the connection (re)opens, so nothing is missed after being offline.
- **Files.** Uploads go to the private `attachments` bucket (25 MB each) and open through short-lived signed links.
- **Setup problems are explained**, not silent: a missing table, an unrun migration or an expired session shows a banner with what to do. The sidebar shows **Synced / Offline / Sync problem**.
- **Local mode** still works with no config, so you can develop and demo without a backend.

## Moving data in

Rows are `(user_id, id, data jsonb)`. To import existing records, insert them with the owner's `user_id` (find it under Authentication → Users) and the record JSON in `data` — the JSON shape is the domain model described in [DOMAIN.md](DOMAIN.md). Dates are `yyyy-MM-dd` strings and times are minutes from midnight.

## Deploying to Netlify

`netlify.toml` at the repo root holds the build (`npm run build` → `dist`) and a catch-all redirect to `index.html`, so deep links such as `/plans/<id>` and page reloads work.

In Netlify → Site configuration → Environment variables, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

They are read at build time, so redeploy after changing them. Never add the `service_role` key.
