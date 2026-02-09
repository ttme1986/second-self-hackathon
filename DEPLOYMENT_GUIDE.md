# Deployment Guide (POC)

This guide covers running the app-only POC. Backend features are now embedded in the frontend and persist to localStorage.

---

## 1) Prerequisites

- Node.js + npm
- (Optional) Gemini API key for summaries, embeddings, and claim/action extraction
- (Optional) Firebase project if you want Google sign-in and cloud sync
- Firebase CLI (`npm install -g firebase-tools`) for hosting deployment

---

## 2) Environment Variables (`app/.env`)

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_DEV_USER_ID=optional_dev_user_id
VITE_DISABLE_AI=false
```

These are baked into the JS bundle at build time. Set them **before** building.

---

## 3) Run the app locally

```bash
cd app
npm install
npm run dev
```

---

## 4) Build + Deploy

### Option A: Firebase Hosting (one command)

```bash
cd app
npm run deploy
```

This builds the app and deploys to Firebase Hosting. Your app will be available at `https://<project-id>.web.app`.

### Option B: Manual steps

```bash
cd app
npm run build
cd ..
firebase deploy --only hosting
```

### Option C: Other static hosts

```bash
cd app
npm run build
```

Deploy the `app/dist/` directory to any static host (Vercel, Netlify, etc.).

### First-time Firebase Hosting setup

If you haven't initialized Firebase Hosting yet:

```bash
firebase login
firebase init hosting
```

When prompted:
- **Public directory**: `app/dist`
- **Single-page app**: Yes
- **Auto builds with GitHub**: No

This creates `firebase.json` and `.firebaserc` in the project root.

### Redeployment

After code changes, just run `npm run deploy` from the `app/` directory again. Each deploy replaces the previous version. Firebase keeps a release history so you can roll back from the [Firebase console](https://console.firebase.google.com).

---

## 5) Notes

- Data is stored in the browser via localStorage. Clear site data to reset.
- Gemini features require `VITE_GEMINI_API_KEY` unless you disable AI with `VITE_DISABLE_AI=true`.
- Firebase Hosting serves the app over HTTPS, which is required for microphone access (Gemini Live API).
