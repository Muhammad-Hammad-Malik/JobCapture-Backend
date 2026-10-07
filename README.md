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
| GET | `/api/jobs` | none | Public, paginated, filterable. Only `open`, non-cleared jobs. Multi-value filters take comma-separated lists and match ANY value; different filters combine with AND. Params: `track` (`tech`/`non-tech`), `categories`, `skills` (+ `skillsMatch=all`), `cities`, `remoteType`, `experience` (buckets `unspecified`,`0-1`,`2-3`,`4-6`,`7+`), `search`, `page`, `limit`. Legacy: `stack`, `minExperience`, `maxExperience`. |
| GET | `/api/jobs/facets` | none | Filter options with live counts (categories, skills, cities, tracks, remote types, experience buckets). |
| GET/PUT/PATCH/DELETE | `/api/admin/jobs...` | JWT | Full CRUD. `DELETE /api/admin/jobs/:id` is a hard delete. |
| DELETE | `/api/admin/jobs/bulk?olderThanWeeks=N` | JWT | Soft-deletes (hidden, not removed) jobs older than N weeks. |
| GET | `/api/admin/emails` | JWT | Deduplicated list of collected contact emails with inferred company names, including from cleared jobs. |

## Job classification

Each job has `categories[]` (primary first), `skills[]`, `cities[]`, `track` (`tech`/`non-tech`) and `experienceYears` (`null` = not specified in the post). The closed lists live in `src/taxonomy/` (categories, skills with aliases, city normalization); the LLM prompts in `src/prompts/` are generated from them, so they can't drift. The old single-value `stack` is kept as a derived legacy field for older clients (e.g. the mobile app). Technologies the model sees that aren't in the skills list are saved in `unknownSkills` so the list can grow from real data.

## Scripts

- `src/scripts/reclassifyJobs.js` — re-classifies existing jobs into the taxonomy. Dry run by default (writes a reviewable report to `reports/`, changes nothing); `--apply --from <report.json>` writes exactly what the report says and refuses non-local databases unless `--allow-remote`. `--resume <report>` redoes only failed entries. See the header of the script for options.

- `src/scripts/seedTestJobs.js` — inserts a few dated dummy jobs for exercising the bulk-clear feature locally (`node src/scripts/seedTestJobs.js`).
