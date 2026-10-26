# Firebase setup

Stiamo runs in two modes, chosen at start-up:

| Mode | When | Data lives in |
| --- | --- | --- |
| **Cloud** | `.env.local` contains a Firebase web config | Firebase Auth + Firestore (+ Cloud Storage for big files) |
| **Offline demo** | no Firebase config | this browser's storage; demo login `demo@stiamo.app` / `password123` |

## 1. Configure the app

Copy `.env.example` to `.env.local` and fill in the values from Firebase console → Project settings → Your apps. `.env.local` is git-ignored. Restart `npm run dev` after changing it (Vite reads env files at start-up).

The Firebase web config identifies your project; it isn't a secret. **Security comes from the rules** below, which only let a signed-in user read and write `users/{their uid}/…`.

## 2. Switch on the services (one-time, in the console)

1. **Authentication** → Get started → Sign-in method → enable **Email/Password**.
2. **Firestore Database** → Create database (production mode is fine; the rules below replace the defaults).
3. *(Optional)* **Storage** → Get started. This needs the Blaze plan. Without it, attachments are stored in Firestore in chunks — it works, but files are limited to 10 MB.

## 3. Deploy the rules

```bash
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,storage
```

`firestore.rules` and `storage.rules` are in the repo root; `firebase.json` and `.firebaserc` point at project `stiamo-62b4b`.

## How the data is laid out

```
users/{uid}/tasks/{id}          users/{uid}/links/{id}
users/{uid}/meetings/{id}       users/{uid}/activity/{id}
users/{uid}/followUps/{id}      users/{uid}/attachments/{id}
users/{uid}/cases/{id}          users/{uid}/fileChunks/{fileId}_{n}   (only without Cloud Storage)
users/{uid}/hearings/{id}
users/{uid}/plans/{id}          Storage: users/{uid}/attachments/{fileId}/{name}
users/{uid}/goals/{id}
```

## Live sync and offline

- Every collection is subscribed with `onSnapshot`; the UI reads from that live cache, so a change on one device appears on the others immediately.
- Firestore's persistent cache (IndexedDB, shared across tabs) keeps the app usable offline; writes queue and sync when you reconnect. The sidebar shows **Synced / Offline — will sync / Sync problem**.
- Setup mistakes (Auth or Firestore not enabled, rules not deployed) show up as a banner with what to fix, instead of a blank screen.

## Hosting (optional)

```bash
npm run build
npx firebase-tools deploy --only hosting
```
