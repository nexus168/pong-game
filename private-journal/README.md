# Marginalia — a private, single-user-per-account journal

A responsive web journal with email/password login (Firebase Authentication)
and entries stored per-user in Firestore. No framework or build step required —
plain HTML/CSS/JS using the Firebase modular SDK loaded from a CDN.

```
journal-app/
├── index.html          # markup: auth screen + journal screen
├── css/style.css        # responsive styling
├── js/
│   ├── firebase-config.js   # your Firebase project config (fill this in)
│   └── app.js                # auth + Firestore logic
├── firestore.rules      # backend access-control rules (deploy these!)
└── README.md
```

## 1. Create a Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com/) and create a project (2 minutes, no billing required for this).
2. In the project, click **Build → Authentication → Get started**, go to the **Sign-in method** tab, and enable **Email/Password**.
3. Click **Build → Firestore Database → Create database**. Choose a region close to your users and start in **production mode** (the rules file below will handle access control — do not use test mode, which is open to anyone).
4. In **Project settings → General → Your apps**, click the web icon (`</>`) to register a web app. Firebase will show you a `firebaseConfig` object.

## 2. Add your config

Paste the values Firebase gave you into `js/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

These values are public identifiers (they're visible in any Firebase web app's
network traffic) — they are **not** secrets. Real access control is enforced
by Firebase Authentication plus the security rules below, not by hiding this file.

## 3. Deploy the security rules — this is what makes the backend secure

This is the most important step. Without deploying `firestore.rules`, your
database defaults to fully locked (if created in production mode) or fully
open (if created in test mode) — neither of which is what you want.

**Option A — Firebase console (fastest, no CLI needed)**
1. Firestore Database → **Rules** tab.
2. Paste the contents of `firestore.rules` in this repo, replacing what's there.
3. Click **Publish**.

**Option B — Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # point it at this existing project, use firestore.rules
firebase deploy --only firestore:rules
```

### What the rules actually do

Entries are stored at `/users/{uid}/entries/{entryId}`. The rules:

- Require `request.auth.uid == uid` for every read/write — a signed-in user
  can only ever touch documents nested under their **own** UID. There is no
  path a user can request another user's entries from, even by guessing IDs.
- Validate the shape of every write (field names, types, string length caps)
  so the database can't be filled with unexpected data even by a
  legitimate, authenticated client with a bug or by direct API calls.
- Deny everything else by default (`match /{document=**} { allow read, write: if false }`).

This means access control is enforced **server-side by Firebase**, not just
hidden by the app's UI — someone with browser dev tools cannot see another
user's entries no matter what they try, because Firestore itself refuses the
request.

## 4. Run it locally

Any static file server works, e.g.:

```bash
cd journal-app
npx serve .
# or: python3 -m http.server 8080
```

Then open the printed URL. Firebase Auth requires `http://localhost` or a
real domain — opening `index.html` directly via `file://` will not work.

## 5. Deploy it

Any static host works (Firebase Hosting, Netlify, Vercel, GitHub Pages, S3 + CloudFront...).
With Firebase Hosting:

```bash
firebase init hosting   # public directory: journal-app
firebase deploy
```

If you deploy to a custom domain, add that domain under
**Authentication → Settings → Authorized domains** in the Firebase console,
or sign-in will be rejected.

## Security notes / recommended hardening

- **Enforce strong passwords** — Firebase's default minimum is 6 characters;
  this app requires 8 client-side. For stricter policy, enable a
  [password policy](https://firebase.google.com/docs/auth/web/password-policy) in the console.
- **Enable App Check** (Firebase console → App Check) to ensure only your
  actual web app — not a scripted client — can call your Firebase backend.
- **Rate limiting**: Firebase Auth already throttles repeated failed sign-in
  attempts automatically.
- **Email verification**: consider calling `sendEmailVerification()` after
  sign-up and gating write access on `request.auth.token.email_verified`
  in the rules if you want to confirm real addresses.
- **Backups**: enable scheduled Firestore backups for the project once it
  holds real data (Firestore console → Backups).
- Never commit a real `firebaseConfig` with billing enabled to a public repo
  without App Check / budget alerts — while the values aren't secret, an
  abusive client could still generate usage if rules or App Check were missing.

## How the app works

- **Auth**: `js/app.js` uses `signInWithEmailAndPassword`,
  `createUserWithEmailAndPassword`, `signOut`, and `sendPasswordResetEmail`
  from Firebase Auth. `onAuthStateChanged` drives which screen is shown.
- **Data**: entries are a live `onSnapshot` query against
  `users/{uid}/entries`, ordered by `updatedAt`. Edits autosave 500ms after
  you stop typing (`updateDoc`), and a save indicator shows the state.
- **Responsive layout**: a two-pane grid (entry list + editor) on desktop
  collapses to a stacked, scrollable single column under 780px, with the
  entry list capped to 40% viewport height so the editor stays reachable
  on mobile.
