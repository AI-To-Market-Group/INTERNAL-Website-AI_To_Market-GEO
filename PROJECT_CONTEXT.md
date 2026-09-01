# AI To Market — GEO Optimiser Tool: Full Project Context

> Use this document to brief any AI on the full state of this project. Every section is current as of July 2026.

---

## 1. What This Project Is

An internal Next.js web application built for **AI To Market** (aitomarketgroup.com) to:
1. **Generate GEO-optimised articles** that get cited by AI assistants (ChatGPT, Perplexity, Claude, Gemini)
2. **Publish them to the AI To Market website** via Sanity CMS
3. **Track citation performance** across LLMs
4. **Surface content opportunities** using Google Trends + AI analysis

**The two goals:**
- Make AI To Market **appear in LLM responses** when the ICP asks about AI strategy, marketing automation, sales AI, or supply chain AI
- **Rank higher on Google** for those same topics

**The ICP (Ideal Customer Profile):** CMOs, heads of marketing, VP Sales, revenue operations leads, supply chain managers, and digital transformation directors at mid-to-large enterprise/mid-market companies.

---

## 2. There Are TWO Separate Projects

### Project 1 — GEO Optimiser Tool (internal app)
- **Path:** `C:\Users\Photo\Documents\internal-agent-geo_optimiser-master`
- **What it is:** Internal tool with 5 nav sections (Content Atelier, Content Forge, AI Echo, Authority, Structured Data)
- **Runs on:** `http://localhost:3001` (or 3000 if nothing else running)
- **Start command:** `cd /c/Users/Photo/Documents/internal-agent-geo_optimiser-master && npm run dev`

### Project 2 — AI To Market Website (public-facing)
- **Path:** `C:\Users\Photo\Documents\INTERNAL-Website-AI_To_Market-Official`
- **What it is:** The actual aitomarketgroup.com website (Next.js + Sanity)
- **Runs on:** `http://localhost:3000`
- **Start command:** `cd /c/Users/Photo/Documents/INTERNAL-Website-AI_To_Market-Official && npm run dev`

These two projects are separate. The GEO tool writes articles to Sanity CMS. The website reads from Sanity CMS and displays them.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | Supabase SSR auth + cookie UUID fallback |
| Database | Supabase (PostgreSQL) |
| CMS | Sanity CMS (project ID: `sbn0mu5t`, dataset: `production`) |
| LLM – articles | OpenAI GPT-4o |
| LLM – GEO analysis | `gpt-4o-mini-search-preview` (web search enabled) |
| LLM – citation judge | `gpt-5.4-nano` |
| LLM – outlines | `gpt-4o` via `chatJson()` |
| Trends data | SerpAPI (`google_trends` engine) |
| Styling | Tailwind CSS + shadcn/ui components |
| State | React Query (TanStack) |
| Toasts | Sonner |

---

## 4. Environment Variables

**File:** `C:\Users\Photo\Documents\internal-agent-geo_optimiser-master\.env.local`

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://mirxrffgxngvlzcvemhw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=***REDACTED***
SUPABASE_ANON_KEY=***REDACTED***
SUPABASE_URL=https://mirxrffgxngvlzcvemhw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=***REDACTED***

# OpenAI
OPENAI_API_KEY=***REDACTED***

# Sanity CMS
SANITY_PROJECT_ID=sbn0mu5t
SANITY_DATASET=production
SANITY_API_TOKEN=***REDACTED***
SANITY_API_VERSION=2024-01-01
```

**Important:** `.env.local` overrides `.env`. The OPENAI_API_KEY must be in `.env.local` or it will be blank (blank overrides real value in `.env`).

There is also a `.env` file in the same directory with some of the same variables — `.env.local` always wins.

---

## 5. Supabase Database Tables

| Table | Purpose |
|---|---|
| `builder_sessions` | Stores in-progress article builder state (outline, draft, metadata) per user per opportunity |
| `ga4_connections` | Stores Google Analytics 4 OAuth tokens and property info per user |
| `opportunities` | Stores content opportunities (from trends or dates) |
| `insights` | (Legacy) Stores article insights |
| `rate_limits` | Rate limiting per user per feature |
| `geo_history` | Stores past AI Echo (GEO) runs |
| `user_settings` | Stores `seed_keywords` (array) and `seasonal_dates` (JSONB array of BigDate objects) per user |

**Auth note:** Supabase auth uses SSR cookies. Some routes fall back to a cookie UUID (`ga4_oauth_uid`) when Supabase session is absent.

**Service role key** (`***REDACTED***`) bypasses RLS — only used server-side via `supabaseAdmin` in `src/lib/supabase/admin.ts`.

**user_settings note:** If the table has no rows for a user, the app falls back to mock settings stored in `localStorage` under key `"dashboard_settings_mock"`. The mock defaults are defined in `src/lib/mock-dashboard-data.ts → getDefaultMockSettings()`.

---

## 6. Navigation Sections (what each page does)

### 6.1 Content Atelier (`/atelier`) — Main Dashboard
- Shows a radar of content opportunities in 3 tabs: **All**, **Seasonal**, **Trends**
- Filter by theme (AI in Marketing, AI in Sales, AI in Supply Chain, AI Strategy & Governance)
- Shows "Rising Opportunities" with Google Trends sparklines and score
- Shows "Key Dates" (B2B industry events now — see section 9)
- Each opportunity card can be clicked → goes to Article Builder
- Add/delete opportunities manually
- Data comes from `/api/opportunities` (Supabase) or mock fallback

### 6.2 Content Forge (`/content-forge`)
- Full list of all content opportunities with filtering
- Separate route from Content Atelier main dashboard
- Links to the Article Builder for each opportunity

### 6.3 Content Atelier — Article Builder (`/atelier/article-builder?opportunityId=X`)
**3-step workflow:**

**Step 1 — Plan (Outline)**
- GPT-4o generates a 5–7 section outline
- Structure enforced by `enforceOutlineStructure()`: always has intro → [sections] → stats → conclusion → FAQ
- User can edit/reorder sections
- Keywords per section

**Step 2 — Article**
- GPT-4o writes each section based on the outline
- Brand voice injected via `getBrandVoicePrompt()` from `src/lib/brand-voice.ts`
- User can edit inline, regenerate sections, refine with AI

**Step 3 — Publish**
- Shows full article preview
- Right sidebar = `WpMetadataPanel` with:
  - **GEO Score** (0–100, based on 5 checks: word count ≥800, FAQ present, stats with sources, non-generic intro, named tools/vendors)
  - Title, slug, tags, SEO title, meta description fields
  - **"Save as draft in Sanity"** button → sends to Sanity as `drafts.geo-{sessionId}`
  - **"Publish live on website"** button → copies draft to published state, deletes draft, returns live URL on aitomarketgroup.com

### 6.4 AI Echo (`/atelier/ai-echo`)
**3-tab GEO analytics tool:**

**Tab 1 — AI Echo Ranking**
- Enter prompts (default: 10 ICP-specific queries about AI strategy/consulting)
- Select LLMs to test against (GPT, Perplexity, Claude — Gemini disabled)
- Enter target URL (`https://www.aitomarketgroup.com`), company name (`AI To Market`)
- Enter competitors (default: McKinsey, Accenture, Deloitte Digital, Gartner)
- Enter brand entities for smart citation detection
- Modes: Single run / Repeat (5x) / Variant
- Results: citation rate per LLM, answer position, share of voice, competitor comparison
- Export as CSV/JSON
- History tab shows past runs

**Tab 2 — Identity Analysis**
- Analyzes how AI perceives the brand
- Enter URL + company name + key messages

**Default prompts (as of July 2026):**
```
best AI consultancy for B2B companies 2025
how to implement AI in a marketing team
what is generative engine optimization (GEO)?
AI tools for B2B sales prospecting
how AI improves supply chain forecasting
best AI marketing automation platforms compared
what does an AI strategy consultant do?
AI agents for sales and marketing use cases
how to measure AI ROI in B2B marketing
generative AI for enterprise sales teams
```

**API:** `POST /api/geo/run` — uses `gpt-4o-mini-search-preview` for responses, `gpt-5.4-nano` as citation judge

### 6.5 Authority (`/atelier/authority`)
**2-tab analytics:**

**Tab 1 — Web Analytics** (LIVE when GA4 connected)
- Shows real GA4 data: sessions, page views, top pages, AI referrals
- GA4 connected via OAuth: `/api/auth/google/ga4/start` → Google → `/api/auth/google/ga4/callback`
- GA4 property: `G-44QSLG3KVQ` on `aitomarketgroup.com`
- If not connected: shows amber banner with "Connect GA4 →" button
- If OAuth fails: shows red error banner with specific error code

**Tab 2 — AI Authority** (DISABLED — shows "Q4" badge)
- Was showing mock data (bot crawlers, share of voice, citation moments)
- Disabled because all data was fabricated — real integrations don't exist yet
- Will be re-enabled in Q4 2026 when real LLM tracking integrations are built

### 6.6 Structured Data (`/atelier/structured-data`)
- Generates JSON-LD schema markup
- Types: Organization, WebSite, Article, FAQPage, Product, BreadcrumbList, SpeakableSpecification
- User enters URL + content → AI generates the schema → copy to clipboard
- Founding year set to **2022** (not 2023)
- Important for both SEO and LLM knowledge graph recognition

---

## 7. Key Files and Their Purpose

### Core Pipeline Files

| File | Purpose |
|---|---|
| `src/lib/brand-voice.ts` | Brand voice injected into ALL LLM prompts. Single source of truth for tone, forbidden phrases, style. |
| `src/lib/sanity-publish.ts` | `publishToSanity()` — creates Sanity draft. `publishLiveToSanity()` — promotes draft to published. |
| `src/lib/mock-dashboard-data.ts` | Mock defaults for when Supabase has no data. B2B industry dates now set here. Auto-migrates old retail dates. |
| `src/lib/api.ts` | All frontend API fetch functions. Add new endpoints here as `postXxx()` functions. |
| `src/lib/settings-store.ts` | Gets/sets user settings (keywords, dates) from Supabase with mock fallback. |

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/opportunities` | GET | Lists all opportunities from Supabase |
| `/api/opportunities/generate-from-trends` | POST | Generates opportunities from seed keywords + Google Trends |
| `/api/opportunities/generate-for-date` | POST | Generates seasonal opportunities for a B2B industry date |
| `/api/opportunities/add` | POST | Manually adds an opportunity |
| `/api/opportunities/delete` | DELETE | Deletes an opportunity |
| `/api/trends/refresh` | POST | Fetches fresh Google Trends data via SerpAPI |
| `/api/geo/run` | POST | Runs AI Echo GEO analysis (citation rate check) |
| `/api/identity/analyze` | POST | Runs AI identity/brand perception analysis |
| `/api/dates` | GET/PATCH | Gets/sets user's Key Dates from Supabase |
| `/api/keywords` | GET/PATCH | Gets/sets user's seed keywords from Supabase |
| `/api/builder-sessions` | GET | Lists all builder sessions |
| `/api/builder-sessions/[id]` | GET/PATCH | Gets/updates a specific session |
| `/api/builder-sessions/[id]/generate-outline` | POST | Generates article outline with GPT-4o |
| `/api/builder-sessions/[id]/generate-metadata` | POST | Generates SEO metadata for article |
| `/api/builder-sessions/[id]/revise-section` | POST | Regenerates a single section |
| `/api/builder-sessions/[id]/refine-draft` | POST | AI refinement of draft content |
| `/api/builder-sessions/[id]/send-to-wordpress` | POST | Saves article as Sanity draft (despite the route name — it uses Sanity, not WordPress) |
| `/api/builder-sessions/[id]/publish-live` | POST | Promotes Sanity draft to published, returns live URL |
| `/api/auth/google/ga4/start` | GET | Starts GA4 OAuth flow |
| `/api/auth/google/ga4/callback` | GET | Handles GA4 OAuth callback |
| `/api/structured-data/generate` | POST | Generates JSON-LD schema markup |
| `/api/analytics` | GET | Fetches GA4 analytics data |

### Component Files

| File | Purpose |
|---|---|
| `src/components/layout/Header.tsx` | Nav header. Has 5 nav links. No week date label (removed). |
| `src/components/article-builder/BuilderStepper.tsx` | Step indicator: 1 Plan / 2 Article / 3 Publish |
| `src/components/article-builder/publish/WpMetadataPanel.tsx` | Publish sidebar: GEO score + Save as draft + Publish live |
| `src/components/article-builder/publish/PublishPreview.tsx` | Full article preview at publish step |
| `src/app/atelier/ai-echo/GeoAnalyticsClient.tsx` | Full AI Echo UI (large file ~1300 lines) |
| `src/app/atelier/authority/page.tsx` | Authority page — GA4 analytics + disabled AI Authority tab |

---

## 8. Sanity CMS Integration

**Project:** `sbn0mu5t` | **Dataset:** `production`
**Studio URL:** `https://sbn0mu5t.sanity.studio`

### Document Structure
- Document type: `blogPost`
- Fields: `title`, `slug`, `category` (always `"news"`), `excerpt`, `author` (always `"AI To Market"`), `publishedAt`, `readTime`, `contentNews`
- `contentNews` is a custom object: `{ lead, secondParagraph, sections: [{ _type: "newsSection", heading, level: "h2", body }] }`

### Draft vs Published
- **Draft ID:** `drafts.geo-{sessionId}` — visible only in Sanity Studio, not on website
- **Published ID:** `geo-{sessionId}` — appears on aitomarketgroup.com/news/{slug}

### Publishing Flow (current)
1. Write article in GEO tool
2. Click "Save as draft in Sanity" → creates `drafts.geo-{sessionId}` via Sanity Mutation API
3. Click "Publish live on website" → copies draft to `geo-{sessionId}`, deletes the draft
4. Article appears at `https://www.aitomarketgroup.com/news/{slug}`

### AITOM Website — Sanity Fetch
- File: `C:\Users\Photo\Documents\INTERNAL-Website-AI_To_Market-Official\lib\sanity.ts`
- In development (`NODE_ENV=development`): uses `perspective: 'previewDrafts'` + `cache: 'no-store'` — shows drafts locally
- In production: uses `perspective: 'published'` + `cache: 'force-cache'` — only shows published docs

---

## 9. Content Configuration (AI To Market specific)

### Brand Voice (`src/lib/brand-voice.ts`)
- **Tone:** Practitioner-to-practitioner, specific and commercial, sceptical of AI hype
- **Audience:** CMOs, VP Sales, RevOps leads, supply chain managers, digital transformation directors
- **Forbidden phrases:** "leverage", "synergize", "transformative", "game-changing", "cutting-edge", "seamlessly", "in today's fast-paced world", + 15 more
- **Style:** Name specific tools (Claude, GPT-4o, Salesforce Einstein, n8n, Make), real business outcomes with numbers, client scenarios

### Content Themes (4 fixed)
```
AI in Marketing
AI in Sales
AI in Supply Chain
AI Strategy & Governance
```

### Seed Keywords (in Supabase / mock defaults)
```
AI marketing automation
AI for sales teams
generative AI supply chain
AI content strategy
GEO generative engine optimization
```

### Key Dates (B2B industry moments — updated July 2026)
Old retail dates (Valentine's Day, Back to school) have been replaced with:
```
Q1 Strategy Season (Jan)
Gartner Data & Analytics Summit (Mar)
Google Cloud Next (Apr)
HubSpot INBOUND (Sep)
Salesforce Dreamforce (Sep)
Year-End AI Budget Push (Nov)
AWS re:Invent (Dec)
```
Auto-migration: if old dates (IDs `mock-date-1`, `mock-date-2`) are in localStorage, they're automatically replaced with the B2B dates on next page load.

### AI Echo Default Competitors
```
McKinsey & Company — https://www.mckinsey.com
Accenture — https://www.accenture.com
Deloitte Digital — https://www.deloittedigital.com
Gartner — https://www.gartner.com
```

---

## 10. Article Outline Structure (enforced)

Every article outline is auto-fixed to this structure before saving:

```
1. Introduction  (type: "introduction") — NOT a generic "What is X" opener
2. [section/how_to/comparison] — main body sections
3. Stats section (type: "stats") — 3+ data points with named sources
4. [more sections if needed]
5. Key Takeaways (type: "conclusion") — 3–5 bulleted action points
6. Frequently Asked Questions (type: "faq") — ALWAYS last, 3–5 Q: format questions
```

Total sections: 5–7 (enforced).
Stats sections are the #1 LLM citation trigger — they must have named sources.

The `enforceOutlineStructure()` function in `src/app/api/builder-sessions/[opportunityId]/generate-outline/route.ts` auto-repairs non-compliant outlines from the LLM before they reach the user.

---

## 11. GEO Score (new feature)

Displayed in the publish sidebar (`WpMetadataPanel`) before publishing.

**5 checks, 20 points each (0–100 total):**
1. **800+ words** — minimum length for LLM citation
2. **FAQ section present** — People Also Ask extraction + LLM Q&A source
3. **Statistics with sources** — regex detects `%`, billions/millions + study/research/report/survey
4. **Non-generic intro** — not starting with "In today's...", "In the world of...", etc.
5. **Named tools or vendors** — mentions ChatGPT, OpenAI, Claude, Salesforce, HubSpot, etc.

Score colour: ≥80 green / ≥60 amber / <60 red.

---

## 12. GA4 Integration

**Property:** `G-44QSLG3KVQ` on `aitomarketgroup.com`

**OAuth flow:**
1. User clicks "Connect GA4 →" on Authority page
2. → `GET /api/auth/google/ga4/start` — stores `userId` in state cookie
3. → Google OAuth consent screen
4. → `GET /api/auth/google/ga4/callback` — exchanges code for tokens, discovers GA4 property, saves to `ga4_connections` table
5. → Redirects back to `/atelier/authority?success=true`

**Fallback:** If Supabase auth is absent, the callback falls back to a cookie UUID (`ga4_oauth_uid`) stored by the start route.

**GCP OAuth client:** Must have `http://localhost:3001/api/auth/google/ga4/callback` in authorized redirect URIs.

---

## 13. What Has Been Fixed (history)

| What | Fix |
|---|---|
| No GA4 Connect button on Authority page | Added "Connect GA4 →" link + error/success banners |
| `NextResponse.redirect` with relative URL crashing | Added `absoluteUrl(req, path)` helper for absolute redirects |
| GA4 callback required Supabase auth | Added cookie UUID fallback so non-Supabase sessions work |
| `no_ga4_property_found` error | Created GA4 property G-44QSLG3KVQ (user had no GA4 account) |
| "No LLM API keys available" | `.env.local` had blank `OPENAI_API_KEY=` overriding `.env`. Fixed by copying real key |
| Send to Sanity returned mock URL | `send-to-wordpress/route.ts` was a stub. Wired to `publishToSanity()` |
| Outline validation warnings (4 issues) | Added `enforceOutlineStructure()` post-processing before validation |
| 20 Essilor opportunities in database | Deleted via Supabase REST API |
| Draft not visible on local AITOM website | Added `perspective: 'previewDrafts'` in dev mode |
| Founding year wrong (2023) | Changed to 2022 in JSON-LD generator |
| Essilor competitors in AI Echo | Replaced Safilo/Zeiss/Hoya with McKinsey/Accenture/Deloitte/Gartner |
| Default vertical "Retail" in AI Echo | Changed to "Technology" (reordered `GEO_VERTICALS` array) |
| Retail seasonal dates (Valentine's, Back to school) | Replaced with 7 B2B industry event dates + auto-migration |
| "WordPress" label in step 3 | Changed to "Publish" |
| Week label in nav header | Removed entirely |
| AI Authority tab showing mock data | Disabled with "Q4" badge — no longer clickable |

---

## 14. Pending / Planned Work

| Priority | Feature | Why |
|---|---|---|
| High | Topic cluster map | Biggest SEO lever — shows which pillar topics are covered vs missing |
| High | Competitor citation tracker in AI Echo | Shows WHO is cited instead of AI To Market — most actionable GEO signal |
| Medium | Internal linking assistant | Suggests bidirectional links on publish — top-3 Google ranking factor |
| Medium | GA4 redirect URI confirmation | Verify `http://localhost:3001/api/auth/google/ga4/callback` is in GCP OAuth client |
| Low | "Publish live" button smoke test | Test the full draft→live Sanity flow end-to-end |
| Low | AITOM website GA4 deploy | GA4 script added to layout.tsx — needs commit + deploy |
| Future | AI Authority tab (Q4 2026) | Real bot crawler data + LLM citation tracking integrations |

---

## 15. How to Run Everything

### GEO Tool (internal app)
```bash
cd /c/Users/Photo/Documents/internal-agent-geo_optimiser-master
npm run dev
# → http://localhost:3001
```

### AITOM Website (public site)
```bash
cd /c/Users/Photo/Documents/INTERNAL-Website-AI_To_Market-Official
npm run dev
# → http://localhost:3000
```

**Note:** Use Git Bash / MSYS2 with forward slashes (`/c/Users/...`), not PowerShell backslash paths.

### Full article publish flow (when both running)
1. Open GEO tool at `http://localhost:3001`
2. Go to Content Atelier → pick an opportunity → Build Article
3. Step 1: Generate outline → edit if needed
4. Step 2: Generate article → edit if needed
5. Step 3: Check GEO score → fill metadata → "Save as draft in Sanity"
6. Click "Publish live on website" → article goes live
7. Open `http://localhost:3000/news` → article appears (draft preview in dev mode)

---

## 16. Important Naming Inconsistencies to Know

The codebase has some variable names that say "WordPress" but mean "Sanity" — this is because the project was originally built for WordPress and migrated to Sanity. Don't let this confuse you:

| Variable name | What it actually means |
|---|---|
| `sentToWordPressAt` | Timestamp when article was saved as Sanity DRAFT |
| `handleSendToWordPress` | Function that saves to Sanity as draft |
| `postSendToWordPress()` | API call to `/api/builder-sessions/[id]/send-to-wordpress` → saves Sanity draft |
| `isSendingToWordPress` | Loading state for Sanity draft save |
| `send-to-wordpress/route.ts` | API route that calls `publishToSanity()` — creates the draft |

The new function `postPublishLive()` / `publish-live/route.ts` is correctly named — it promotes a draft to published.

---

## 17. Architecture Diagram (text)

```
User (browser)
    │
    ├── Content Forge / Atelier Dashboard
    │       │
    │       └── /api/opportunities → Supabase opportunities table
    │       └── /api/trends → SerpAPI Google Trends
    │
    ├── Article Builder (3 steps)
    │       │
    │       ├── Step 1: /api/builder-sessions/[id]/generate-outline
    │       │           → OpenAI GPT-4o → outline JSON
    │       │           → enforceOutlineStructure() → save to Supabase
    │       │
    │       ├── Step 2: /api/builder-sessions/[id]/generate-draft (via hook)
    │       │           → OpenAI GPT-4o + brand-voice.ts → full article
    │       │
    │       └── Step 3: /api/builder-sessions/[id]/send-to-wordpress
    │                   → sanity-publish.ts → Sanity Mutation API → drafts.geo-{id}
    │                   /api/builder-sessions/[id]/publish-live
    │                   → sanity-publish.ts → copies to geo-{id}, deletes draft
    │                   → returns https://www.aitomarketgroup.com/news/{slug}
    │
    ├── AI Echo
    │       └── /api/geo/run
    │               → gpt-4o-mini-search-preview → web search responses
    │               → gpt-5.4-nano (judge) → citation detection
    │               → results saved to geo_history table
    │
    ├── Authority
    │       └── /api/analytics → GA4 Data API → real traffic data
    │       └── /api/auth/google/ga4/* → OAuth flow → ga4_connections table
    │
    └── Structured Data
            └── /api/structured-data/generate → GPT-4o → JSON-LD schema

Sanity CMS (sbn0mu5t)
    └── blogPost documents → AITOM Website reads via sanityFetch()
            └── dev: perspective: 'previewDrafts' (shows drafts locally)
            └── prod: perspective: 'published' (live only)
```

---

## 18. Sanity Studio Access

- Studio URL: `https://sbn0mu5t.sanity.studio`
- After "Save as draft": document appears in Studio as a draft (not yet published)
- After "Publish live": document is published and visible on aitomarketgroup.com
- Document type in Studio: `Blog Post` → category `news`

---

*Last updated: July 2026 by AI To Market. This is the internal GEO optimiser tool built for aitomarketgroup.com.*
