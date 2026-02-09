# Integration tests

Run:

```bash
npm run test:integration
```

## Gemini

Uses `VITE_GEMINI_API_KEY` from `app/.env.local`.

## Firebase (Firestore + Cloud Storage)

These tests use the **Firebase Admin SDK** so they can write/read/delete test data reliably.

You must provide a service account JSON via environment variable (do **not** commit it):

- `FIREBASE_SERVICE_ACCOUNT_JSON` — the full service account JSON object as a string.

Example (macOS/zsh):

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON="$(cat path/to/serviceAccount.json)"
npm run test:integration
```

The tests create data under:
- Firestore collection: `integration_tests`
- Storage prefix: `integration_tests/`

…and always attempt to delete what they create (so the next run starts clean).
