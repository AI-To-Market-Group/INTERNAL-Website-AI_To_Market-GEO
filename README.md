# AI To Market — GEO Content Creation Agent

Full-stack content creation platform for **AI To Market**. Combines a Content Radar (opportunity discovery) with an AI-powered Article Builder that produces GEO-optimised articles ready to publish to WordPress.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | Description |
|---|---|
| `/dashboard` | Content Radar — opportunity cards and tables |
| `/dashboard/article-builder` | Article Builder — outline → draft → publish |
| `/dashboard/geo` | GEO Analytics — citation ranking per prompt |
| `/dashboard/analytics` | GA4 analytics dashboard |
| `/dashboard/structured-data` | JSON-LD structured data generator |
| `/dashboard/wordpress-sent` | Articles sent to WordPress |

## Environment variables

Create a `.env.local` at the root:

```bash
# Required for article generation, outline, refinement, GEO
OPENAI_API_KEY=sk-your-openai-key

# Required for session persistence (outline, draft, metadata)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Required for WordPress publishing
WP_URL=https://your-site.com
WP_USER=your-wp-username
WP_APP_PASSWORD=your-wp-app-password

# Required for auth (Supabase Auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: set to "true" to force mock data everywhere (no API calls)
NEXT_PUBLIC_USE_MOCKS=false
```

## Models

| Step | Model | Notes |
|---|---|---|
| Generate outline | `gpt-5.4-nano` | Fast, cheap |
| Generate article | `gpt-5.4-mini` | Streamed token-by-token |
| Refine to industry level | `gpt-5.4` | Full flagship for quality |
| Revise section / paragraph | `gpt-5.4-nano` | Single section, fast |
| GEO citation check | `gpt-4o-mini-search-preview` | Web search enabled |

## Article Builder — how it works

The builder is a 3-step flow:

### Step 1 — Outline
- Generates a 5–7 section GEO-optimised outline via LLM
- Mandatory sections: `introduction`, `faq`, `stats`, `conclusion`
- Each section has a 3-bullet description: *What to cover / Angle / Avoid*
- Outline warnings surface if structure rules are violated
- Sections are drag-and-drop reorderable; each can be regenerated with an instruction

### Step 2 — Article
- Sends outline to LLM and streams tokens live to the UI
- Blurred text builds up behind a frosted overlay while the blob animation runs
- Full article targets 1,200–1,800 words with per-section word count rules
- FAQ section renders as an interactive **accordion** (click to expand/collapse)
- Quality flags surface thin sections, attribution overuse, and missing keywords
- Inline AI revision: select any text → floating toolbar → rewrite with instruction
- "Refine to industry level" runs a second LLM pass (gpt-5.4) to elevate tone, add specificity, and inject thought-leadership angles

### Step 3 — Publish
- Auto-generates WordPress metadata: slug, SEO title, meta description, focus keyword, tags
- SEO warnings flag character limits and missing keyword in title/slug
- One-click send to WordPress as a draft post

## GEO optimisation

Every article is written to maximise citation by AI search engines (ChatGPT, Perplexity, Claude, Gemini):

- Definition-opener format: *"X is Y because Z."*
- FAQ structured as `Q: / A:` — Perplexity extracts these verbatim
- Stats section with named sources per data point
- Anchor phrases: *"In summary:", "The key point is:", "Bottom line:"*
- Attribution cap: generic phrases (`"Studies show"`) limited to 2 per article

## Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, Radix UI
- **State:** TanStack Query
- **Auth & DB:** Supabase (Auth + PostgreSQL)
- **Validation:** Zod
- **Drag & drop:** dnd-kit

## Key files

```
src/
├── app/
│   ├── api/builder-sessions/[opportunityId]/
│   │   ├── generate-outline/route.ts   # Step 1 LLM
│   │   ├── validate-plan/route.ts      # Step 2 LLM (streaming SSE)
│   │   ├── refine-draft/route.ts       # Refinement pass
│   │   ├── revise-section/route.ts     # Single section regeneration
│   │   ├── generate-metadata/route.ts  # WordPress metadata
│   │   └── send-to-wordpress/route.ts  # WP publish
│   └── dashboard/article-builder/page.tsx
├── components/
│   ├── article-builder/draft/
│   │   ├── UnifiedArticleEditor.tsx    # Contenteditable editor + FAQ accordion
│   │   ├── DraftEditor.tsx             # Editor shell + floating toolbar
│   │   └── FloatingSelectionToolbar.tsx
│   ├── radar/                          # Opportunity radar components
│   └── ui/
│       └── organic-loader.tsx          # Animated blob loaders (7 variants)
├── hooks/
│   └── useGenerateArticle.ts           # SSE streaming hook
├── lib/
│   ├── openai-article.ts               # chatJson + chatJsonStream helpers
│   ├── article-quality.ts              # Deterministic quality checker
│   ├── builder-sessions-store.ts       # Supabase session CRUD
│   └── api.ts                          # Client API (including streamValidatePlan)
└── types/index.ts
```
