# Testing Zod and Supabase

This guide explains how to verify that **Zod validation** and **Supabase (PostgreSQL)** are working correctly.

---

## Prerequisites

- `.env.local` with `POSTGRES_URL` set (Supabase connection string)
- Dev server running: `npm run dev`
- Schema applied in Supabase (see Step 1)

---

## 1. Supabase / PostgreSQL

### 1.1 Apply the schema

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Copy the contents of `src/lib/db/schema.sql`
3. Run the SQL to create `builder_sessions`, `ga4_connections`, and `settings`

### 1.2 Check health endpoint

```bash
curl http://localhost:3001/api/health
```

Expected when `POSTGRES_URL` is set and DB is reachable:

```json
{
  "ok": true,
  "db": "connected",
  "timestamp": "2026-03-04T..."
}
```

| `db` value       | Meaning                                      |
|------------------|----------------------------------------------|
| `"connected"`    | PostgreSQL works; schema should be applied    |
| `"unconfigured"`| `POSTGRES_URL` not set in `.env.local`        |
| `"error"`        | `POSTGRES_URL` set but connection failed     |

### 1.3 Test builder sessions persistence

1. Open the app: http://localhost:3001/dashboard
2. Pick an opportunity → **Create article** (opens Article Builder)
3. Generate an outline or add minimal content
4. Refresh the page or close and reopen the browser
5. **Success**: The session (outline, draft, step) is still there

Without PostgreSQL, sessions are in-memory and lost on restart.

### 1.4 Test settings persistence

1. Open the Dashboard → **Saisonnier** or **Tendance** tab
2. Add a seed keyword or a big date
3. Restart the dev server: stop `npm run dev`, then run it again
4. Reload the page
5. **Success**: Keywords and dates are still present

---

## 2. Zod validation

Zod validates API request bodies. Invalid data should return `400` with a validation error.

### 2.1 Health check (no body validation)

```bash
curl -s http://localhost:3001/api/health
```

Should always return `200` (health does not use Zod).

### 2.2 Builder sessions – valid vs invalid

**Valid request:**

```bash
curl -X POST http://localhost:3001/api/builder-sessions ^
  -H "Content-Type: application/json" ^
  -d "{\"topic_title\": \"Test article title\"}"
```

Expected: `200` with session data.

**Invalid request (missing `topic_title`):**

```bash
curl -X POST http://localhost:3001/api/builder-sessions ^
  -H "Content-Type: application/json" ^
  -d "{}"
```

Expected: `400` and body like:

```json
{
  "error": "topic_title required",
  "code": "VALIDATION_ERROR"
}
```

**Invalid request (empty `topic_title`):**

```bash
curl -X POST http://localhost:3001/api/builder-sessions ^
  -H "Content-Type: application/json" ^
  -d "{\"topic_title\": \"\"}"
```

Expected: `400` with `VALIDATION_ERROR`.

### 2.3 GEO run – invalid body

**Invalid (missing required `prompts`):**

```bash
curl -X POST http://localhost:3001/api/geo/run ^
  -H "Content-Type: application/json" ^
  -d "{\"mode\": \"single\"}"
```

Expected: `400` and a validation error, not `500`.

### 2.4 Insights – invalid schema

**Invalid (missing `title` or `category`):**

```bash
curl -X POST http://localhost:3001/api/insights/create ^
  -H "Content-Type: application/json" ^
  -d "{\"category\": \"blog\"}"
```

Expected: `400` with `VALIDATION_ERROR`.

---

## 3. Quick verification checklist

| Test                        | How to verify                                      |
|----------------------------|----------------------------------------------------|
| Health + DB connected      | `GET /api/health` → `db: "connected"`              |
| Builder sessions in DB     | Create session → restart server → session persists|
| Settings in DB             | Add keyword/date → restart → data persists         |
| Zod rejects invalid body   | POST invalid JSON → `400` + validation error       |
| Zod accepts valid body     | POST valid JSON → `200` + expected response        |

---

## 4. PowerShell examples (Windows)

```powershell
# Health
Invoke-RestMethod -Uri "http://localhost:3001/api/health"

# Valid builder session
Invoke-RestMethod -Uri "http://localhost:3001/api/builder-sessions" -Method POST -ContentType "application/json" -Body '{"topic_title":"Test"}'

# Invalid builder session (should get 400)
try { Invoke-RestMethod -Uri "http://localhost:3001/api/builder-sessions" -Method POST -ContentType "application/json" -Body '{}' }
catch { $_.Exception.Response.StatusCode.value__ }  # Should be 400
```

---

## 5. Troubleshooting

### `db: "unconfigured"`
- Set `POSTGRES_URL` in `.env.local` (or `DATABASE_URL`)
- Restart the dev server after changing env vars

### `db: "error"`
- Check connection string (Supabase: Settings → Database → Connection string)
- Ensure the schema has been run in the Supabase SQL Editor
- Confirm Supabase project is not paused

### Zod passes invalid data
- Confirm the route uses `parseBody(req, someSchema)` and handles `parsed.error`
- Check the schema in `src/lib/api-schemas/` for the route in question
