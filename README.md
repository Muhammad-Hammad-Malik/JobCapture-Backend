# JobCapture Backend

Express + MongoDB backend for the JobCapture job board: ingests LinkedIn job posts (structured via an LLM through OpenRouter), exposes an admin CRUD API, a public read API for the frontend, and an emails/leads aggregation endpoint.

## Stack

- Node.js + Express
- MongoDB (Mongoose)
- JWT auth (single admin account, credentials from environment variables — no admin DB collection)
- OpenRouter (LLM structuring, default model `google/gemini-2.5-flash-lite`)

## Setup

```bash
npm install
cp .env.example .env
# fill in .env: MONGODB_URI, JWT_SECRET, OPENROUTER_API_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
npm run dev   # nodemon, auto-reload
# or
npm start
```

Health check: `GET /api/health`

## Environment variables

See `.env.example` for the full list. Notable ones:

- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the single admin login. Not stored in the database; checked directly against these env vars.
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` — used for structuring raw post text into job fields.
- `MONGODB_URI` — local Mongo or Atlas connection string.

## API overview

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | none | Returns a JWT |
| POST | `/api/jobs/ingest` | JWT | Raw post text → structured job(s). A single post can yield multiple job entries if it lists several openings. Hybrid duplicate detection (source URL, then company+title). |
| GET | `/api/jobs` | none | Public, paginated, filterable (stack, experience range, remote type, search). Only `open`, non-cleared jobs. |
| GET/PUT/PATCH/DELETE | `/api/admin/jobs...` | JWT | Full CRUD. `DELETE /api/admin/jobs/:id` is a hard delete. |
| DELETE | `/api/admin/jobs/bulk?olderThanWeeks=N` | JWT | Soft-deletes (hidden, not removed) jobs older than N weeks. |
| GET | `/api/admin/emails` | JWT | Deduplicated list of collected contact emails with inferred company names, including from cleared jobs. |

## Scripts

- `src/scripts/seedTestJobs.js` — inserts a few dated dummy jobs for exercising the bulk-clear feature locally (`node src/scripts/seedTestJobs.js`).
