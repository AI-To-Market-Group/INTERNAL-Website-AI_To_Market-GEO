# AI TO MARKET — GEO Engine

### Complete project record: inheritance, rebuild, and the system as it stands

**Document version:** 2.0 — supersedes the 12 August 2026 log entirely
**Last updated:** Tuesday, 15 September 2026
**Build owner:** Manoj Kumar Gunasekaran — **solo build, end to end**
**Environment:** Claude Code + VS Code, Next.js 16 / React 19 / TypeScript / Supabase / Sanity

---

## 0. What this document is

The August log was a status note. This is the full record: what was inherited, why almost none of it survived, what was researched, what was built in its place, and what the system actually does today. It is written so that anyone picking this up cold — or Manoj six months from now — can reconstruct the reasoning, not just the feature list.

**One sentence:** an internal enterprise-grade content engine that turns a buyer's question into a brand-compliant, illustrated article **carrying real citations found by live web search and hyperlinked to the source page**, scores it against evidence-based GEO criteria, publishes it to the live AI To Market website, and pushes it onward to LinkedIn — with the whole run costed, budgeted, and attributable to a named team member.

---

## 1. Business objective

Two goals, unchanged since day one:

1. **Get AI To Market cited in LLM answers** when the ICP asks about AI strategy, marketing automation, sales AI, or supply chain AI — ChatGPT, Perplexity, Claude, Gemini.
2. **Rank on Google** for those same topics.

Everything in the tool exists to serve one of those two, or to make serving them repeatable without a human babysitting each step.

**The ICP:** CMOs, heads of marketing, VP Sales, revenue operations leads, supply chain managers, digital transformation directors at mid-to-large companies. People who already understand their own business problem and do not need AI explained to them.

---

## 2. The inheritance — what Ayman's code actually was

The tool was originally written by Ayman for the **Essilor account**, a retail/eyewear use case. It was git-cloned and handed over for AI To Market. What arrived was not a product with a different brand on it. It was a prototype with one working screen.

### 2.1 The handover instruction

> *Only the Content Atelier page works. Do not touch any of the other sections.*

That was the operating constraint at handover. Every other route in the application was either non-functional, wired to nothing, or actively misleading — screens that rendered but did not do the thing they claimed to do.

### 2.2 No architecture

There was no structure to build on. No separation between generation logic, scoring logic, brand logic, and persistence. No consistent API response contract. No auth boundary on routes that wrote to the database. No typed schema between the client and the server. Adding a feature meant editing the same file everything else lived in, and hoping.

### 2.3 The only path to a blog was seasons and trends

The single functioning generation flow started from **seasonal events and Google Trends data**. For a retail eyewear brand that is defensible — sunglasses sell in summer, back-to-school drives frames, Black Friday matters.

For an enterprise AI consultancy it is **irrelevant to the point of being harmful**:

- Enterprise AI buying is not seasonal. A CFO does not procure a supply chain AI pilot because it is November.
- Google Trends measures *consumer search volume spikes*. The ICP here is a few thousand people worldwide making six- and seven-figure decisions. They do not move the Trends needle, and the Trends needle does not describe them.
- It produced topics nobody in the target market would ever type into an LLM.

Worse: the seasons and trends pipeline was **buggy**. Date handling, event keys, and the opportunity generation that hung off them threw errors regularly and produced duplicate or empty opportunities.

### 2.4 The scoring was measuring the wrong things

The inherited "GEO score" was a set of **proxies with no evidence behind them**. It looked for the presence of a `%` character. It looked for the literal word "study". Text containing "studies show that 40% of companies" scored well — which is precisely the *generic, unattributable* writing that LLMs decline to cite.

So the score was not merely imprecise. It was **inversely correlated with the outcome it claimed to predict**. An article could pass every check and be structurally incapable of earning a citation.

### 2.5 The model was not citing articles

The most important finding. The engine generated text that read fine and cited nothing — no named organisations, no attributed statistics, no quotations, no sources, and **no links to anything**. Prompt-level instructions asking for sources did not hold over long generations.

This is fatal for GEO specifically. An answer engine synthesising a response needs something to attribute. Unsourced prose is exactly what it drops.

There was no mechanism anywhere in the inherited code for **finding a real source on the live web**. Nothing searched. The model was simply asked to produce citations from memory, which is the one thing a language model must never be trusted to do. The replacement for this is §9, and it is the single most consequential thing built.

### 2.6 Residue

Literal Essilor data, retail-shaped assumptions, and naming from an even earlier era were still baked in — `sentToWordPressAt`, `handleSendToWordPress`, `send-to-wordpress/route.ts`, from before the migration to Sanity. These have been found and corrected progressively; some legacy names survive deliberately where renaming would risk live data (see §12).

### 2.7 Honest assessment

What was inherited was worth roughly one thing: proof that the *shape* of the idea — prompt in, article out, publish to CMS — could work. The implementation of that shape was replaced almost entirely.

---

## 3. The research foundation

Before rebuilding, the criteria were sourced from evidence rather than intuition. The rebuild is grounded in:

- **The Princeton GEO paper** (*Generative Engine Optimization*, Aggarwal et al.) — the primary source. Its central finding drove the entire scoring rebuild: the content changes that measurably increase visibility in generative engine responses are **adding citations from credible sources, adding quotations, and adding statistics**. Keyword stuffing, the SEO-era reflex, does not help and can hurt.
- **Google Search Central's own guidance** on AI features, helpful content, and what surfaces in AI Overviews.
- **A body of supporting research and practitioner writing** on answer-engine behaviour, retrieval, and source selection — read to separate what is demonstrated from what is marketing.

Three design rules fell out of that reading, and the whole engine is built on them:

1. **Attribution is the product.** Named sources, attributed statistics, real quotations. Not "experts say". And crucially — the sources must be **real**, found on the live web and linked, not generated from a model's memory (§9).
2. **Fluency and structure matter as much as facts.** An answer engine lifts passages it can drop into a response cleanly.
3. **Anticipate the follow-up.** Google's "fan-out" concept — a query implies further questions. Content that answers them holds the citation across the whole exchange, not just the first turn.

---

## 4. The rebuild — architectural decisions

A complete architectural change, made deliberately rather than incrementally.

### 4.1 Keywords space — the new entry point

Seasons and trends were removed as the origin of an article. In their place: **a prompt/keyword library** — the actual question set AI To Market is trying to own, organised into clusters, owned and edited by the team.

An article now starts from *a question a buyer types into an answer engine*. That is the only origin that makes sense when the goal is being cited in the answer.

### 4.2 Google Search Console — live ground truth

GSC is connected via OAuth (`/api/auth/gsc/start` → `/callback`, tokens refreshed automatically) and queried for **real 90-day query data** on `aitomarketgroup.com` — impressions, clicks, position, per query.

This matters because it replaces guessing with measurement. The prompt library is informed by what the site *already* surfaces for, and where it surfaces weakly. GA4 is wired the same way for traffic truth.

### 4.3 Deterministic code over API calls, wherever possible

A deliberate and consistently applied rule: **anything that can be computed reliably in code is computed in code, not sent to a model.**

Every LLM call costs money, adds latency, and introduces non-determinism. So:

- Brand voice violation *detection* is a regex pass over the text. Only the *correction* uses a model.
- **The entire GEO scorer is LLM-free** — all five signals computed synchronously in code, including the fan-out check that used to need a model (§8).
- Illustration palette compliance is validated by parsing hex codes out of the SVG and checking them against a fixed set. No model is asked whether it followed the rules; it is checked.
- Citation anchor tags are added **in code**, never by the model, because models mangle HTML inside JSON strings (§9.2).
- HTML sanitisation, read-time estimation, heading extraction, slug generation, word counts, FAQ block parsing — all deterministic.

This is why the engine is cheap to run and why its guarantees are guarantees rather than hopes.

### 4.4 API management

The inherited code had no API discipline at all — no consistent response shape, no validation, no auth boundary on routes that wrote to the database. All of it was built. There are **66 API routes** under `src/app/api/`, and every one of them goes through the same layers.

**One response contract** — `src/lib/api-response.ts`. Every route returns `ok(data, status)` or `err(message, status, code)`. Errors always carry a machine-readable `code` (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `INVALID_JSON`, `NOT_FOUND`, `BAD_REQUEST`) alongside the human message, so the client can branch on the code and display the message.

**Typed errors** — `src/lib/api-errors.ts` provides `ApiError` and subclasses `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), each with a `toResponse()` producing the same JSON shape. **Written but currently unused** — every route uses the `ok()` / `err()` helpers instead. It is a ready alternative for routes that would rather throw than return, not something in the hot path today (§20.7).

**Schema validation at the boundary** — `parseBody(req, schema)` parses JSON and validates it with **Zod** in one call, returning either typed data or a ready-made 400 response. Invalid JSON and schema violations are distinguished by code. Schemas live in `src/lib/api-schemas/` split by domain: `geo-run`, `insights`, `article-builder`, `builder-sessions`, `identity`, `ai-suggest`, `structured-data`.

**Auth as a precondition, not a suggestion** — `src/lib/api-auth.ts`:
- `getAuthUser()` resolves the Supabase session user.
- `requireUser()` returns `{ user }` or a ready 401 — the first line of essentially every route.
- `getUserRole()` reads `admin` / `editor` from `team_members`.
- `requireAdmin()` chains on `requireUser()` and returns a 403 for non-admins.

The pattern is uniform and one line: `const { user, error } = await requireUser(); if (error) return error;`. Uniformity is the point — a boundary that is easy to apply correctly is one that actually gets applied.

**Rate limiting** — `src/lib/rate-limit.ts`, a sliding 1-hour window with explicit per-route ceilings: `geo/run` 20, `insights/generate` 50, `identity/analyze` 30. Currently **in-memory**; the Postgres-backed implementation is written but commented out (see §20 — in-memory is per-instance, so it limits per serverless instance rather than globally).

**Outbound resilience** — `src/lib/fetch-with-retry.ts` wraps external calls with exponential backoff: two retries at ~1s and ~2s, retrying **only on 5xx and network errors**. A 4xx is a real answer and is returned immediately rather than retried pointlessly.

**Budget enforcement before spend** — `checkBudget()` runs *before* expensive routes execute, not after (§11).

**Observability** — `src/lib/api-log.ts` keeps a rolling 100-entry client-side log of every call (section, path, method, status, duration, error) with a listener API so the UI can surface it live. `src/lib/logger.ts` handles structured server-side error logging. `GET /api/health` reports service and database status.

**Cost attribution on every model call** — `logAiUsage()` records feature, model, token counts and estimated USD (§11). Every route that touches a model passes an `AiCallCtx` carrying `{ userId, feature }`, so spend is attributable to both a person and a purpose rather than landing in an undifferentiated bill.

**Client-side layer** — `src/lib/api.ts` wraps `fetch` with base-URL resolution, automatic logging, and a `NEXT_PUBLIC_USE_MOCKS` switch that routes the whole app to mock data when the backend is unavailable — useful for UI work without burning tokens.

**The data model** — thirteen Supabase tables, each with a clear owner:

| Table | Holds |
| :--- | :--- |
| `builder_sessions` | Every article card: plan, outline, draft, score, metadata, `batchQueuedAt`, `sentToWordPressAt`, soft-delete `trashed_at` |
| `opportunities` | Prompt/topic candidates |
| `user_settings` | Seed keywords and per-user configuration |
| `brand_voice` | The editable brand voice configuration (§7) |
| `ai_usage_log` | Every model call: feature, model, tokens, estimated USD |
| `user_budget_settings` | The org-wide rolling call budget |
| `team_members` | Role assignments (`admin` / `editor`) |
| `user_presence` | Who is active right now |
| `activity_logs` | Who did what, when |
| `geo_history` | AI Echo run results over time |
| `gsc_connections` · `ga4_connections` | OAuth tokens and refresh state for Search Console and Analytics |
| `insights` | The Content Forge insight library |

Schema lives in `src/lib/db/schema.sql`, with typed accessors per table under `src/lib/db/` rather than raw queries scattered through routes.

### 4.5 Rebrand to the AI To Market palette

The interface was rebuilt on the official brand system, and the palette is enforced in code, not left to discipline:

| Hex | Role |
| :--- | :--- |
| `#163D26` | Deep forest — primary dark, surfaces and type |
| `#185F00` | Mid green — structural fill |
| `#F7F5F2` | Off-white — light ground |
| `#FFFFFF` | White — detail and contrast |
| `#F93943` | Red — accent, **light surfaces only** |
| `#F88379` | Coral — accent, **dark surfaces only** |

The red/coral split is a real constraint, not a preference, and the illustration validator rejects any SVG that violates it (§6.4).

---

## 5. The generation pipeline as it works today

End to end, a prompt becomes a published article through these stages. Each is a real route in `src/app/api/`.

| # | Stage | What happens |
| :--- | :--- | :--- |
| 1 | **Prompt / opportunity** | Starts from the prompt library, a GSC query, or a manual brief. `opportunities`, `keywords` |
| 2 | **Brief chat** | Conversational refinement of angle, audience and format before any drafting. `brief/chat` |
| 3 | **Outline** | Structured plan — headings, answer blocks, FAQ structure enforced at outline time. `generate-outline` |
| 4 | **Plan validation** | The outline is checked and repaired before it is allowed to become a draft. `validate-plan` |
| 5 | **Draft** | Full article generation against brand voice and length targets. `openai-article.ts`, `article-length-controller.ts` |
| 6 | **Brand voice gate** | Detect → correct → verify. `brand-voice.ts`, `check-brand-voice` |
| 7 | **Live web search citation** | Real source found on the open web, embedded and hyperlinked. `citation-finder.ts` — see §9 |
| 8 | **GEO score** | Five signals, four deterministic, one model-assisted. `geo-score.ts`, `rescore` |
| 9 | **Auto-fix** | Targeted repair of failing signals and quality flags. `fix-geo`, `refine-draft`, `fix-section-v2` |
| 10 | **Titles** | Three title options generated and chosen by a human. `title-variants` |
| 11 | **Illustrations** | Palette-locked SVG hero and section images. `illustration-generate`, `illustration-generate-claude` |
| 12 | **Metadata** | SEO title, slug, meta description, category. `generate-metadata` |
| 13 | **Structured data** | Schema markup generation. `structured-data/generate` |
| 14 | **Publish** | Sanity draft → live blog post. `publish-draft`, `publish-live` |
| 15 | **Distribution** | RSS → LinkedIn. Website `/feed.xml` |

Every step writes back to the session store, so a card can be closed and reopened at any stage without losing work.

---

## 6. Enterprise features — studied, then built

These were not invented on the spot. Each came from looking at how content operations actually run at scale in an enterprise, and what breaks when they do not.

### 6.1 Batch queue — parallel generation from approved outlines

**The problem it solves:** one-at-a-time generation makes the human the bottleneck. A content lead approves an outline, then waits eight minutes watching a progress bar, then approves the next.

**What was built:** approved outlines are queued (`batch-queue` route, `batchQueuedAt` stamp on the session) and processed **in parallel**. The queue screen shows live per-card progress through real stages — **Drafting (33%) → Scoring (80%) → Illustrating (90%) → done** — with each card independently tracked.

On completion a card:
- lands immediately in **Articles in progress** in the draft editor, ready for review,
- is recorded in a **History** section with the timestamp of when it was generated,
- carries its generated illustrations with it, persisted to the card cache so they survive a reload and reach Sanity on publish.

The human approves outlines in a batch, walks away, and comes back to finished drafts. That is the enterprise pattern.

### 6.2 Title selection — three options, human choice

**The rationale, and it is load-bearing:** the title and the image are **the first and often only things anyone sees** — in a feed, in a search result, in a LinkedIn card. By working weight, the title carries roughly **60% of whether the article gets opened at all**. The remaining body quality only matters to people who already clicked.

So the title is not left to a single model output. `title-variants` generates **two alternatives alongside the original**, deliberately varied along three axes:

- **different emotional hook** — curiosity vs. authority vs. urgency
- **different length** — one short and punchy, one fuller
- **different framing** — question, bold claim, how-to, or result-first

Constrained to 80 characters, no clickbait, B2B register. The human picks. The choice persists per card, and older cards are backfilled with variants on open so nothing is stuck with a single option.

### 6.3 Image generation with model selection

Articles get a hero image and per-section illustrations. **The model is selectable** — the engine supports both OpenAI and Anthropic paths (`illustration-generate`, `illustration-generate-claude`), so image generation is not hostage to one vendor's availability, pricing, or refusal behaviour.

Images can be regenerated, removed (leaving a labelled **"Add image"** placeholder that can be refilled), and are uploaded to Sanity as real assets on publish.

### 6.4 The illustration engine — on-brand by construction

This is not a raster image model. It generates **SVG**, then **validates it in code**:

- Every `fill` and `stroke` hex is extracted and checked against the six-colour brand palette. **Any off-palette colour rejects the SVG outright.**
- **Red and coral may never both appear** — one accent per surface.
- **Coral is forbidden on light surfaces. Red is forbidden on dark surfaces.** Enforced, not requested.
- Valid SVGs are rasterised via `sharp` for CMS upload.

The result is an illustration system that *cannot* produce an off-brand image. It either produces a compliant one or it retries. This was the design goal from the original Vusion-newsletter-inspired concept: on-brand by construction, not by review.

---

## 7. Brand voice — enforced, not requested

**The problem:** brand rules forbid dashes, hyphens and contractions in copy. Prompt-level instructions do not hold over a 1,500-word generation — proven by an early published article that was full of hyphens despite the rule being explicit in the prompt.

**The architecture, three stages:**

1. **Detect** — a fast deterministic pass flags every em dash, en dash, hyphen and contraction, with narrow exceptions for URLs and genuine number ranges. No model involved, no cost, no ambiguity.
2. **Correct** — if and only if violations are found, one targeted model rewrite removes exactly those things while preserving meaning. Capped at two attempts.
3. **Gate** — a **Brand Voice badge** sits beside the GEO Score badge in the publish panel, green or red. A failing article cannot quietly reach publish.

**Beyond punctuation**, the brand voice system is a full editable configuration stored in Supabase and applied to every generation (`src/lib/brand-voice.ts`, Brand voice screen in the UI):

- **Company identity and audience** — written for people who already understand their own business problem.
- **Tone rules** — practitioner-to-practitioner; specific and commercial; sceptical of AI hype and honest about limitations; decisive, no hedging.
- **Preferred style** — name real tools and models (Claude, GPT-4o, Perplexity, n8n, Salesforce Einstein) rather than "AI solutions"; active voice; outcomes with numbers; concrete client scenarios; acknowledge that implementations overrun and adoption is slow; never open with a definition like "AI is transforming X".
- **Forbidden phrases** — a maintained blocklist: *leverage, synergize, holistic approach, game-changing, revolutionary, cutting-edge, best-in-class, in today's fast-paced world*, and the internal abbreviations `AITOM` / `AI2M` which must never appear in public copy.
- **Per-section word count targets** — introduction 100, stats 100, FAQ 200, how-to 150, section 150, conclusion 80.

Defaults are hardcoded as a fallback so the system degrades safely if the database is unreachable, and the UI exposes tone dials — formality, claim strength, technical depth, sentence length — so the configuration is tunable without touching code.

---

## 8. GEO scoring — deterministic, testable, zero LLM calls

The proxy checks were deleted and replaced with five signals drawn from the Princeton findings. But the single most important property of the rebuilt scorer is architectural, not editorial:

> ### `src/lib/geo-score.ts` makes **no network calls and no model calls whatsoever.**
> It is pure, synchronous TypeScript. Text in, score out.

Verified: there is not one `fetch`, one `await`, or one API key in the file. `computeGeoScore(text, topic, response?)` returns `{ score, checks, wordCount }` **synchronously**.

### 8.1 Why that matters

- **It is free.** Scoring an article costs nothing. It can run on every keystroke, on every save, on every section edit, as often as the UI wants.
- **It is instant.** No network round trip, so the score moves the moment the text does. This is what makes live scoring in the editor possible at all.
- **It is deterministic.** The same article always produces the same score. A score that drifts between runs is not a measurement, it is a mood.
- **It is testable.** Every check is a pure function over a string. You can feed it a fixture and assert the result — no mocking an API, no flaky network, no token spend in CI. This was a deliberate design goal, not a side effect.
- **It cannot fail open.** There is no external dependency that can 404, rate-limit, or time out and silently return "everything passed" (compare §9.4, where exactly that happened to a feature that *did* depend on a network call).

The last fan-out check used to call a model. **It was deliberately converted to a structural heuristic** and the LLM removed — see 8.2, signal 5.

### 8.2 The five signals

Score is simply **passes × 20**, so the scale is 0 / 20 / 40 / 60 / 80 / 100. No weighting, no partial credit, no opaque formula — five things either hold or they do not.

| # | Signal | How it is judged, in code |
| :--- | :--- | :--- |
| 1 | **Named sources** | ≥2 explicit named attributions ("according to McKinsey", "MIT Sloan (2024)", "(Pew Research Center, 2024)"), **and** generic phrases must not outnumber the named ones |
| 2 | **Statistics with sources** | ≥2 numeric claims each co-occurring with a named attribution **in the same or an adjacent sentence** |
| 3 | **Cited claims** | At least one attributed quotation, em-dash attribution ("… — Gartner"), or inline "according to Source" construction |
| 4 | **AI-tell density** | Five categories of machine-sounding prose, counted per 1000 words, **fails above 2.0/1000** — see 8.3 |
| 5 | **FAQ fan-out coverage** | ≥2 question-style headings (*What / How / Why / When / Can / Should…*), **or** an explicit FAQ section with ≥2 interrogative sentences |

Signal 5 is the one worth explaining. The Princeton-adjacent "fan-out" idea says content should answer the follow-up questions a query implies. The first implementation asked a model to generate 3–5 likely follow-ups and then checked coverage. That worked, but it cost money, added latency, and made the score non-deterministic.

The insight that removed it: **a question-style heading *is* the follow-up question, and the section under it *is* the answer.** If an article has two or more question headings, or a real FAQ block, it demonstrably covers the fan-out. No model needed to confirm what the structure already proves. That change is what made the whole scorer LLM-free.

`wordCount` is measured and returned but **deliberately not scored** — length is not a citation signal, and scoring it would reward padding.

### 8.3 The AI-tell detector

Signal 4 is a sub-system in its own right, built because generated prose has recognisable habits that make it read as machine-written and, worse, make it unquotable. Five categories:

1. **Significance inflation** — asserting importance instead of making a claim: *"serves as a testament"*, *"marks a pivotal moment"*, *"underscores the importance of"*, *"paves the way for"*, *"sheds light on"*.
2. **Dangling participials** — comma-anchored trailing clauses that restate rather than extend: *", highlighting…"*, *", underscoring…"*, *", demonstrating…"*. Bare gerunds are *not* flagged; only the comma-attached trailing form. *"suggesting"* is deliberately excluded — too many legitimate uses in analytical writing.
3. **Vague attribution** — *"experts say"*, *"analysts note"*, *"it is widely believed"*, *"the consensus is"*. Overlaps intentionally with signal 1: that check penalises vagueness by reducing the named-source count, this one flags it directly as a tell.
4. **Signposting** — YouTube-script openers wrongly applied to written articles: *"let's dive in"*, *"here's what you need to know"*, *"without further ado"*, *"read on to learn"*. Listed in **both contracted and expanded forms**, because brand voice correction expands contractions *before* this check runs.
5. **Fragmented headers** — a first sentence that merely restates its own heading. Detected **structurally** (heading vs. first sentence) when the full article object is available, falling back to a phrase list (*"this section covers…"*, *"in this section, we…"*) when only plain text is.

**Threshold: 2.0 flags per 1000 words.** Chosen precisely — it tolerates one genuine slip in a 900-word article (1.1/1000) but fails at two (2.2/1000), because two is a pattern and one is an accident.

### 8.4 Errors you can fix by hand, or let the model fix

The scorer and the quality reviewer both return **evidence, not just a verdict** — the actual offending phrase, the actual word count, the actual missing keyword. That is what makes the two repair paths possible:

**Manual.** Every failing check names what failed and shows the text that caused it. A writer can read *"AI-tell density: 3 tells at 2.4/1000 words — exceeds threshold: serves as a testament; , underscoring; experts say"* and fix those three phrases by hand in thirty seconds. **No LLM is involved in finding the problem, and none is needed to solve it.** This is the default and the cheapest path.

**Automatic.** If the writer would rather not, **auto-fix calls an LLM** — and this is the only place a model enters the scoring loop. `fix-section-v2` (and `fix-geo` / `refine-draft` in the v1 app) take the specific failing check and its evidence and repair only that, rather than regenerating the article and hoping the score moves. The evidence is what makes targeted repair possible; without it the only option would be a blind rewrite.

**With one exception that is worth its own line: fixing "AI-tell density" calls no LLM either.** `fixAiTells()` in the UI applies roughly **ninety regex replacement pairs** across the same five categories the detector uses. So the most commonly failing check is also the cheapest to repair — zero tokens, instant, deterministic. A model is only reached for the checks that genuinely require new content: finding a source, adding a statistic, writing a quotation.

**And one safety rule:** any auto-fix other than "Cited claims" is **forbidden from overwriting a paragraph that already contains a real `<a href>` citation**. Without that guard a later repair could silently destroy the verified source that §9 spent a web search finding.

Alongside the score, **`article-quality.ts` produces quality flags** by the same deterministic method — thin sections against per-type word count targets, generic attribution used more than twice, target keywords missing from the text, and malformed content where a model returned the wrong shape. Each flag carries its section and message, and each can be dismissed, fixed by hand, or auto-fixed individually from the editor.

### 8.5 Precision fixes worth recording

Both were real defects, found and closed:

- **Statistic/source pairing** originally used a character window, which let a source two paragraphs away satisfy the check whenever the raw character distance happened to be short. Replaced with **sentence-boundary detection**.
- **The bare word "per"** was excluded from source matching — *"per quarter"*, *"per store"*, *"per user"* all false-positived. It now counts as attribution only when followed by a capitalised name (*"per Microsoft"*, *"per Stanford HAI"*).

Both are the kind of bug that only surfaces when the scorer is deterministic enough to be reasoned about. A model-based scorer would have hidden them in noise.

---

## 9. Live web search — real, verifiable, clickable citations

This is the feature that closes the gap between *knowing* the Princeton finding and *acting* on it. Everything in §8 measures whether an article has credible attribution. This is what puts it there.

**The problem.** A model asked to "cite a source" will happily invent one. It produces a plausible publisher, a plausible year, a plausible statistic, and — worst of all — a plausible URL that goes nowhere or goes somewhere unrelated. A fabricated citation is strictly worse than no citation: it passes a naive scorer, it looks authoritative, and it destroys credibility the moment a reader clicks it.

**The solution: search the live web, and trust only what the search tool returns.**

`src/lib/citation-finder.ts` runs a real web search via the **OpenAI Responses API `web_search` tool** with `search_context_size: "high"`, constrained to a whitelist of credible B2B publishers — **Gartner, Forrester, McKinsey, HubSpot, Salesforce, LinkedIn, IDC, Deloitte, PwC, Harvard Business Review, MIT Sloan, Bain, BCG, Accenture** — and to material **published 2022 or later**.

### 9.1 The anti-hallucination guard

The critical design decision, and the reason this can be trusted:

> **The URL is taken only from the search tool's `annotations[].url_citation` — never from text the model wrote.**

A URL the model types into its prose is frequently wrong or invented. A URL in the search tool's citation annotation is a page the tool actually retrieved. So if there is no annotation, the function returns `null` and the article ships **without** a citation rather than with a fake one. **No verifiable source means no source.** That rule is absolute and enforced in code.

The model is also given an explicit escape hatch — respond `NOT_FOUND` — so it is never cornered into inventing something to satisfy the request.

### 9.2 Embedding it so both the reader and the scorer are served

A found citation goes through two steps:

1. **`rewriteWithCitation()`** rewrites the paragraph to embed the attribution **as plain text**, in one of exactly three GEO-scorer-recognised formats: *"According to Publisher (Year), …"*, *"per Publisher (Year), …"*, or *"… — Publisher (Year)"*. All other sentences in the paragraph are left untouched.
2. **`linkifyAttribution()`** then wraps that attribution in a real anchor tag pointing at the verified URL — **in code, deterministically**, with `target="_blank" rel="noopener noreferrer"`.

The split is deliberate and was learned the hard way: **small models regularly drop, escape or mangle an anchor tag when told to reproduce it verbatim inside a JSON string**, silently losing the link. So the model is never asked to emit HTML. It produces plain text; the code adds the markup. The regex handles *"Source (Year)"*, *"Source, Year"* and *"Source Year"*, and falls back to linking the publisher name alone if the year formatting drifts.

This also means the article satisfies **both** audiences at once: the GEO scorer strips HTML before checking, so the plain-text attribution still registers as a named source — while the human reader gets a **clickable link to the actual page** to verify the claim.

### 9.3 Where it runs

| Pathway | Behaviour |
| :--- | :--- |
| **`validate-plan`** — main generation | Runs automatically as its own pipeline stage (`sendEvent({ stage: "citation" })`), after brand voice correction and before scoring |
| **`fix-section-v2`** — targeted repair | Runs on demand when a section needs a real source added |

In the main pipeline it takes the **two longest body paragraphs** as candidates — excluding intro, FAQ and conclusion — and stops at the first success. Two attempts rather than one because the search genuinely fails to verify a source for many claims, and a single silent attempt meant **most articles were shipping with zero clickable citations**.

The whole step is **non-fatal**. If every candidate fails, the article still ships; it just ships without a hyperlinked citation, and the GEO score reflects that honestly rather than hiding it.

### 9.4 The bug that made this invisible for weeks

Recorded because it is the most instructive failure in the project.

The feature was originally built against **`gpt-4o-search-preview`** via the Chat Completions API. OpenAI **deprecated and removed that model**. Every call began returning **HTTP 404** — and because the function is wrapped in a `try/catch` that returns `null` on failure, the 404 was swallowed exactly like a legitimate "no source found".

**The feature failed silently and completely.** It did not error, it did not log loudly, it did not block a publish. It simply never found a citation, ever, while appearing to work. Articles shipped with no real sources and nobody was told why.

The fix was to move to the **Responses API `web_search` tool** on a current model, verified by a **live test call before shipping** — not by assuming the documentation was accurate.

**The lesson, generalised:** a `catch` that returns a falsy "not found" value cannot distinguish *"this legitimately does not exist"* from *"the entire integration is broken"*. Any external dependency whose failure mode is indistinguishable from its empty result needs either explicit error logging or a periodic live health check. This is now the standing rule for outbound integrations in this codebase.

---

## 10. Team management

Multi-user from the ground up, because a content engine used by one person is a script.

- **Supabase Auth** is the identity layer. Every route resolves a real user.
- **Roles: `admin` and `editor`**, stored in a `team_members` table and merged with the auth user list so the team screen shows everyone who has ever signed in, whether or not they have an explicit role assignment.
- **Admin-only actions** are gated server-side by `requireAdmin()` — invitations, role changes, removals. Not hidden in the UI and left open on the API.
- **Invite by email**, with pending invitations visibly marked (`invited: true` until first sign-in) so it is obvious who has been asked and has not yet arrived.
- **Presence** (`/api/presence`) shows who is active, so two people do not unknowingly work the same card.
- **Activity log** (`/api/activity`, `log-activity.ts`) records who did what — generation, publish, deletion, role change.
- **Per-user session ownership** — cards, saved plans and drafts belong to a user, and the card cache is scoped by user ID so one person's local state never leaks into another's view.

---

## 11. Credit and cost management

Every model call in the system is metered. This was built because an AI content engine with no cost ceiling is an unbounded liability, and because per-feature cost data is the only way to know which parts are worth their price.

**Token-level logging** (`src/lib/ai-usage-logger.ts`): every call writes `feature`, `model`, `inputTokens`, `outputTokens`, and an **estimated USD cost** to an `ai_usage_log` table, with a live pricing table covering both vendors:

| Model | Input $/1M | Output $/1M |
| :--- | ---: | ---: |
| gpt-4o | 2.50 | 10.00 |
| gpt-4o-mini | 0.15 | 0.60 |
| gpt-4o-mini-search-preview | 0.15 | 0.60 |
| gpt-5.4-nano | 0.15 | 0.60 |
| gpt-5.4-mini | 0.40 | 1.60 |
| gpt-5.4 | 2.50 | 10.00 |
| claude-sonnet-5 | 2.00 | 10.00 |
| claude-sonnet-4-5 | 3.00 | 15.00 |
| claude-haiku-4-5 | 0.80 | 4.00 |

Unknown models fall back to a conservative estimate rather than logging zero.

**Budget guard** (`src/lib/budget-guard.ts`): an **organisation-wide rolling 30-day call budget**, default 200, adjustable from the UI. `checkBudget()` runs *before* expensive operations — the GEO benchmark checks it before spending anything — and returns `allowed`, `count`, `budget`, and `pct`. When the budget is exhausted the run is refused rather than silently overspending.

**Usage screen** (`/api/usage`, `atelier/usage`): token consumption and estimated spend broken down by feature, so it is visible which part of the pipeline is expensive.

Deliberately **org-scoped rather than per-user** — the company has one AI bill, and a per-user quota would just push work onto whoever had headroom left.

---

## 12. The application, screen by screen

The v2 interface (`/atelier-v2`) is a single client-rendered surface with a persistent sidebar. `src/app/atelier-v2/page.tsx` is **8,313 lines** in one file, plus `components/KeywordWorkspace.tsx`.

**Read this section honestly.** Several screens are finished, real and load-bearing. Several others are high-fidelity shells built to establish the layout and hold the place for a data source that is not connected yet. Both are recorded below, because a document that presents a mock as working is worse than no document.

### 12.0 The shell

| Feature | Behaviour |
| :--- | :--- |
| **Sidebar** | Collapses 248px ↔ 64px. Workspace/version dropdown switches between **V2** and the **V1** app at `/atelier`. Live queue-count badge on the Batch queue entry. |
| **Credits bar** | **Real.** Bottom of sidebar — `GET /api/usage?days=30` against the budget, gradient green→red. Click opens the Usage screen. |
| **Presence** | **Real.** `POST /api/presence` on mount, 30-second heartbeat, `sendBeacon` on unload; `GET /api/presence` polled every 8 seconds. Drives card locking and "X, Y editing" banners. |
| **Role gating** | **Real.** `GET /api/team/me` → `admin` / `editor`; gates brand voice editing, budget editing, team administration. |
| **Activity logging** | **Real.** `POST /api/activity` — logs login, delete, restore, batch build, publish. |
| **URL state** | `?screen=`, `?card=`, `?flow=` round-tripped via `history.replaceState`, so a screen or card is linkable and survives reload. |
| **Per-user cache** | localStorage keys namespaced by Supabase user id (`v2_card_<uid>_<oppId>`) so one person's local state never appears in another's session. |

### 12.1 Real and complete

**Create** — three working flows.
- **One-shot brief** — free-text brief, format (explainer / how-to / comparison / listicle / opinion), length (600–800 up to 1800–2200), and four toggles (inject FAQ schema, add comparison table, require 3 citable sources, answer block per section). Double-submit guarded by a **synchronous ref**, added after duplicate session rows appeared in production.
- **Conversational** — a real chat against `/api/brief/chat`, with a live "BRIEF SO FAR" sidebar that fills progressively and a CTA that only enables when the API reports `readyToGenerate`.
- **Keyword workspace** — four columns: **Search Console** (real, `/api/gsc/top-queries`), **AI Echo** (real, `/api/geo/history`, deduped), **Seeded** (static list), **Custom** (user-added, persisted). Select keywords, add instructions, and combine them into a topic — which infers intent (decision / consideration / awareness) from the keyword text and assembles a full GEO brief.

**Batch queue** — covered in §6.1. Real throughout; the stage machine, the parallel `Promise.all` build, the 2.5-second illustration stagger, the History section in localStorage (newest first, capped at 50), and per-row Open / Retry / Undo.

**Draft editor** — the core screen, and the largest. Three views: card grid → plan step → article step. Detailed in §12.2.

**Brand voice** — real, backed by `/api/brand-voice`, read-only for editors. Company identity, description, audience, tone list, style list, per-section minimum word counts, forbidden-phrase chips, guardrail checkboxes. Save is enabled only when genuinely dirty (deep comparison).

**Usage** — real. 7d / 30d / 90d ranges, estimated spend / total tokens / API calls tiles, a daily spend bar chart with per-bar hover tooltips, and a **cost-by-feature table** across 16 mapped features with share-of-total bars. Monthly budget editable by admins only, persisted to both localStorage and the server, with an approaching-limit warning.

**Team** — real. Live status dots (green active < 2 min, amber idle < 15 min, grey offline) polled every 10 seconds for admins, role badges with an admin-only role selector, remove behind a confirm, an invite form, and an **expandable per-member activity log** lazily fetched on expand with human-readable action labels.

**Trash** — real. Soft-deleted cards (`trashed_at`) sorted newest first, with Restore and permanent Delete, plus Empty trash.

### 12.2 The draft editor in detail

**Card grid.** Filter tabs — All / Plans / Article / Build / Sanity — with counts. Four sections: **Saved plans**, **Articles in progress**, **Ready to build**, **Sent to Sanity** (deliberately last). Every section sorts by `_cardStamp`, the max of the server's `updatedAt` and the local cache's `savedAt`, so the ordering always matches the timestamp actually displayed. Badge precedence is explicit: **IN USE** (locked by presence) → SENT TO SANITY → ARTICLE SAVED → IN BATCH QUEUE → PLAN SAVED → READY TO BUILD.

**Plan step.** The outline is resolved through five sources in priority order — preloaded saved plan, localStorage cache, server restore, another team member's shared plan, then fresh generation. Sections support **HTML5 drag-and-drop reordering**, inline title editing, per-section regenerate, duplicate, delete, and a **per-section image toggle** (`noImage`) that excludes it from illustration. Description bullets are auto-sizing editable textareas.

**Article generation.** Streams over SSE. The progress bar is a **single requestAnimationFrame easing loop** toward a target that real events only ever raise, with per-phase ceilings — so it never jumps backwards and never sticks at a fake 99%. A stream that closes without delivering an article produces an explicit error rather than a frozen bar.

**What is editable in the article:** the title (click the masthead), the **title variants** via a ‹ › switcher, every paragraph (`contentEditable`, preserving HTML and intercepting clicks on citation links so they open rather than edit), section headings, conclusion bullets, FAQ questions and answers independently, the pull quote, and every image.

- **Stats sections** — the first three paragraphs containing a real figure become dark stat cards with the number in coral.
- **FAQ** — parsed from `Q: … A: …` with three fallback strategies, one item open at a time, rotating `+` → `×`.
- **Conclusion** — a dark "KEY TAKEAWAYS" card, bullets derived from structured bullets, then `<li>` extraction, then sentence splitting.
- **Pull quote** — auto-extracted as the longest 60–160 character sentence from the *middle* body section. A user edit beats the auto-pick; a removal beats both, and publishes as `""` rather than `undefined` so "deleted" is distinguishable from "never set".
- **Images** — per-section version arrays newest-first, auto-generation into empty slots only, keyed on the generation id rather than the title so renaming never wipes them. The modal offers version thumbnails, custom upload, a reprompt box, and a **Claude / GPT-4o model picker**. Uploaded raster images get Fit/Fill plus a click-and-drag focal point. Removal leaves a placeholder and excludes that slot from both the SEO panel and the publish payload.
- **Brand voice highlighting** — a DOM `TreeWalker` wraps each residual violation in an amber `<mark>`; clicking the violation in the sidebar scrolls to it and flashes it.

**The quality sidebar.** This is the real diagnostic surface. Brand Voice badge with an expandable violation list; GEO score with colour thresholds; the five GEO checks where **failing checks are clickable** and expand to reveal ⚡ Auto fix and Skip; content quality flags as `E1, E2…` chips that **scroll to and outline the offending section for 2.2 seconds**; and both "Auto fix all failing" buttons.

**Two details in the auto-fix logic worth recording:**

1. **"AI-tell density" is fixed entirely locally — no LLM call.** `fixAiTells()` applies roughly ninety regex pairs across the five tell categories. The most common failing check is therefore also the cheapest to repair: zero tokens, instant.
2. **A citation guard.** Any fix other than "Cited claims" is forbidden from overwriting a paragraph that already contains a real `<a href>` citation. Without it, a later repair could silently destroy the verified source that §9 worked to find.

**Autosave runs in two layers** — an immediate localStorage write on every state change with no early-exit guard, plus a debounced Supabase save three seconds after the article last changed. Title variants are backfilled whenever fewer than two exist.

**SEO metadata** is gated behind an explicit **Finalise Article** step, then generated on demand — title, slug, tags, category, SEO title with a live `n/60` counter, meta description with `n/160`, and per-image alt text, caption and force-slugified filename.

**Publish** offers Preview, Save, **Save as draft in Sanity**, and **Publish live** — which explicitly refuses unless a draft was saved first.

### 12.3 Shells — built, not yet connected

Recorded plainly. These render fully and look finished, but their data is hardcoded:

| Screen | State |
| :--- | :--- |
| **Overview (dashboard)** | **All mock.** Answer share by engine, prompt coverage gaps, drafts in flight, four stat tiles. Loading and empty states are written but unreachable — `dataState` is pinned to `"normal"`. |
| **Prompt library (keywords)** | **All mock, read-only.** Cluster cards and a prompt table with coverage bars. The *working* keyword tooling is the Keyword Workspace inside Create (§12.1). |
| **Visibility (analytics)** | **All mock.** Dual-line SVG chart, citation log, headline card. Only the 4w / 12w / 12m toggle does anything, and it swaps between three hardcoded series. |
| **Publishing** | **All mock, and deliberately disabled** — a fixed **"COMING SOON"** card over blurred, `pointerEvents: none` content listing WordPress / Webflow / HubSpot / Contentful / Schema injector / Slack. Real publishing lives in the editor. |
| **GEO diagnostic (score)** | **All mock AND unreachable.** The component exists — dial, dimension bars, section heatmap, recommendation cards — but both the nav entry and the router line are commented out, with the note *"score lives inside the article editor"*. The real diagnostic is the editor's quality sidebar. |

### 12.4 Two apps coexist — v1 and v2

The version dropdown in the sidebar is not decorative. **Both applications are live and routable:**

- **V2** — `/atelier-v2`, the rebuilt single-surface app described above. This is the working tool.
- **V1** — `/atelier/*`, the earlier multi-page app: `ai-echo`, `article-builder`, `authority`, `drafts`, `structured-data`, `usage`, `wordpress-sent`.

V1 is kept deliberately, not by neglect. Several capabilities **only exist there** — most importantly the **AI Echo** citation tracker (§14) and the **structured data generator** (§13.4). Those screens are real and in use; they simply have not been ported into the v2 shell yet.

This is why a number of API routes appear unused when read against v2 alone. They are not dead — they serve V1: `/api/analytics`, `/api/keywords`, `/api/opportunities/*`, `/api/insights/*`, `/api/structured-data/generate`, `/api/article-builder/chat`, `/{id}/refine-draft`, `/{id}/revise-section`, `/{id}/revise-selection`, `/{id}/check-brand-voice`, `/{id}/fix-geo`, `/{id}/send-to-wordpress`.

**The consolidation work** is to port AI Echo and structured data into v2, then retire `/atelier` and the routes only it uses. Until then, anyone auditing route usage should check both apps before deleting anything.

There is also a third surface, **Content Forge** (`/content-forge`), an insights library backed by Supabase and user-scoped — separate from the article pipeline.

### 12.5 Animation

**Motion conveys system state; it is never decoration.** The rule is enforced by the failure it prevents: animation that hides content is a bug, and was treated as one every time it appeared.

- **Framer Motion** drives the dashboard's donut charts, activity statistics and stepped progress cards.
- **SSE-driven progress** — the eased rAF loop described above, plus per-card stage animation in the batch queue.
- **New cards scroll into view and glow green for four seconds.**
- **Loader overlays** with typewriter phase text (Research / Structure / Keywords / Validate for outlines; Drafting / Reviewing brand voice / Adding citations / Scoring for articles), with the content behind them blurred rather than blank.
- **The brand voice screen** runs a phrase-cycling scan animation on mount and on every save.
- **`tw-animate-css`** with Tailwind v4 for utility transitions; **Radix UI** primitives so dialogs, selects and checkboxes are keyboard-accessible by default.

---

## 13. Publishing and distribution

### 13.1 Sanity

**As of today, 15 September 2026, the loop is closed.** Articles are sent from the tool to Sanity and publishing makes them appear on the official AI To Market website.

- `publish-draft` creates the Sanity document; `publish-live` promotes it.
- **Hero and section images upload as real Sanity assets** during publish — not URLs that expire.
- **Categories are free-form**, and existing category labels are read back **from Sanity itself** via GROQ (`array::unique(*[_type == "blogPost" && defined(customCategory)].customCategory)`) rather than from the tool's own session store, because Sanity is the canonical record of what is actually live.
- HTML is sanitised on the way out — dangerous elements and attributes stripped, while bold, italic, links, lists, blockquotes and code are preserved.
- FAQ blocks are converted to real `<details>` markup so they render as working accordions on the site.
- A **pull quote** field was added to the schema and threads from the editor through to the rendered article.

### 13.2 The website template

The GEO article template on the live site was matched to the tool's preview so that what the writer approves is what ships: boxed card layout, DM Sans, coral eyebrows on `#163D26` headings, floated section images with a soft neutral shadow, stat cards, FAQ accordion, key takeaways.

### 13.3 RSS → LinkedIn — the automated distribution channel

The website serves **`/feed.xml`**, rebuilt hourly from Sanity. **That feed is connected to LinkedIn**, which means:

> Publishing an article in the tool results in it appearing on the website *and* posting to LinkedIn, with no further human action.

That is the distribution channel automated end to end. The last manual step in the content operation was removed.

### 13.4 Structured data / JSON-LD — built, not yet automatic

`src/lib/structured-data/generators.ts` generates seven schema types, all valid schema.org JSON-LD:

**Organization · WebSite (with SearchAction) · Article · FAQPage · Product · BreadcrumbList · SpeakableSpecification**

`SpeakableSpecification` is the one worth calling out — it marks which passages a voice assistant should read aloud, which is the same "liftable passage" idea the GEO scorer measures, expressed in markup.

`computeGeoCoverage()` scores which schemas a page has and returns recommendations for the missing ones. The whole thing is exposed as a working screen at `/atelier/structured-data`.

**Status: built and usable by hand, not yet wired into publish.** `sanity-publish.ts` emits no JSON-LD today, so schema has to be generated on that screen and applied separately. Connecting the generator to the publish route is a small, well-defined piece of remaining work (§19).

---

## 14. Measurement — AI Echo and the closed loop

**AI Echo** (`/api/geo/run`, `/api/geo/history`) is the citation tracker. It runs the ICP prompt set against live answer engines using `gpt-4o-mini-search-preview` for retrieval, and a separate cheap judge model (`gpt-5.4-nano`) to decide whether AI To Market was actually cited, mentioned, or absent — plus the same judgement for a configurable competitor set.

**Baseline established (August 2026), real data:**

- **Citation rate: 0%** across 10 default ICP prompts, 3 runs each.
- **Competitor check:** only **Accenture** cited once across the entire baseline. McKinsey, Deloitte, Gartner, BCG, IBM — all zero.
- **The real competition is not the big consultancies.** It is a swarm of small AI-native SEO sites: dupple.com, aiempiremedia.com, xcelacore.com, hyscaler.com, aisotools.com, aitoptenrank.com. They are winning these citations today, and they are beatable, which is the whole opportunity.
- **Cost of a full baseline run: $0.006.** Cost is a non-factor. Rerun freely.

Runs are rate-limited, budget-checked before execution, and persisted to `geo_runs` so change over time is measurable rather than remembered.

**Open question — now largely answered.** The baseline was reported across three engines, but inspecting the AI Echo engine list shows **Gemini is shipped `disabled: true` with a "Coming soon" sublabel**. GPT and Claude Haiku are enabled; Gemini is not. So the baseline covered **two engines, not three**, and the 0% figure should be read that way until Gemini is switched on (§20.5). That does not invalidate the finding — 0% across two major engines is still 0% — but the reference point needs restating before it is quoted as three-engine coverage.

---

## 15. Layer 1 — foundations (status)

| Item | Status |
| :--- | :--- |
| Google indexing overall | ✅ Confirmed via `site:aitomarketgroup.com` |
| Clients page indexed | ✅ Fixed — root cause was pure discovery failure |
| Careers page indexed | ✅ Fixed — same cause, same fix |
| Sitemap submitted to Search Console | ✅ Done |
| Semantic HTML on published headings | ✅ Real `<h2>`–`<h6>`, not styled divs |
| Sanity draft → live publish | ✅ **Verified working as of 15 Sep 2026** |
| RSS → LinkedIn | ✅ Live |

**The Clients/Careers root cause, recorded in full** because it is a genuinely instructive failure: Google had never *discovered* either URL. Not a quality rejection, not a `noindex`, simply unknown. The sitemap listed both correctly with strong priority — but the sitemap had never been submitted to Search Console, **and** `app/sitemap.ts` had no `revalidate` config, so Vercel served a sitemap frozen at last build rather than current Sanity state.

Two commits fixed it:

1. `export const revalidate = 3600` — regenerate hourly from Sanity instead of freezing forever.
2. Sanity fetch errors now **throw instead of silently returning an empty list**, so a transient Sanity hiccup during the hourly refresh serves the last good cached sitemap rather than dropping every post from the index.

Manual indexing requests on both pages then came back **indexed**.

---

## 16. Where everything lives

| What | Where |
| :--- | :--- |
| GEO tool repo | `C:\Users\Photo\Documents\internal-agent-geo_optimiser-master` — dev server `localhost:3001` |
| Website repo | `C:\Users\Photo\Documents\INTERNAL-Website-AI_To_Market-Official` — dev server `localhost:3000` |
| Website branches | `dev-manoj` → Neha merges to `main` → Vercel deploys from `main`; `demo-dev` for the demo catalogue |
| Sanity Studio | `https://sbn0mu5t.sanity.studio` — project `sbn0mu5t`, dataset `production` |
| Search Console | Domain property `aitomarketgroup.com` — verified, in active use |
| Live site | `https://aitomarketgroup.com` |
| RSS feed | `https://aitomarketgroup.com/feed.xml` → LinkedIn |

**Access Manoj has:** full code access to both repos, full Sanity access, Search Console, GA4.
**Access Manoj does not have:** Vercel. Any website change requires a handoff to Neha to merge and deploy.

**Stack:** Next.js 16.1.6 · React 19.2.3 · TypeScript 5 · Tailwind v4 · Radix UI · Framer Motion · TanStack Query · Supabase (auth + Postgres) · Sanity CMS · OpenAI (GPT-4o family, GPT-5.4 family, search-preview) · Anthropic (Claude Sonnet 5, Haiku 4.5) · `sharp` · GA4 · Google Search Console API · `@dnd-kit` · Sonner.

---

## 17. Gotchas worth remembering

- **"WordPress" in the code means Sanity.** `sentToWordPressAt`, `handleSendToWordPress`, `send-to-wordpress/route.ts` — historical leftovers from before the Sanity migration. Not bugs. Renaming them touches live session data, so they stay until there is a reason worth the risk.
- **Two Search Console properties exist** — the verified Domain property (in use) and an unverified URL-prefix property that can be ignored or removed.
- **`/blog/testing`** was a leftover test post in Sanity. Deleted. It kept reappearing in the live sitemap purely because of the caching bug above.
- **`getAllBlogSlugs()` already filters drafts correctly** — confirmed empirically when a draft article did not appear in the sitemap.
- **Duplicate builder sessions** were traced to a `useState` double-submit guard that does not apply until the next render. Fixed with `useRef` guards. Two empty stub sessions created by the old behaviour were trashed directly in Supabase.
- **Scroll-reveal animations must never be the only thing making content visible.** A `.reveal { opacity: 0 }` waiting on an IntersectionObserver produced an apparently empty page more than once. Content on screen now reveals immediately; the observer only stages what is genuinely below the fold.
- **`Buffer` is not a valid `fetch` body type** under the current types — use `new Uint8Array(body)`. This broke a production build and is exactly the class of error to flag immediately rather than route around.
- **`gpt-4o-search-preview` is deprecated and removed.** Every call returns HTTP 404. Live web search now goes through the **Responses API `web_search` tool** on a current model. See §9.4 — and take the general lesson with it: a `try/catch` returning a falsy "not found" cannot distinguish *legitimately absent* from *integration entirely broken*.
- **Never trust a URL a model writes in prose.** Only a URL that arrives in the search tool's `annotations[].url_citation` has actually been retrieved. Anything else is a guess wearing a link.
- **The GA4 route returns mock data from inside its `catch` block**, so a genuine API error looks identical to "not connected". Same silent-failure class as the citation bug. Check the `isMock` flag before believing any analytics number (§20.5).
- **Mock articles and mock opportunities are written to the database as real rows.** Intentional — it keeps a refresh from losing work and stops a new user seeing an empty dashboard — but it means canned and generated content sit in the same table with nothing distinguishing them (§20.4).
- **GA4 OAuth tokens live in an in-memory `Map`** and are lost on every cold start, so the Analytics connection drops silently and has to be reconnected (§20.5).
- **`ADMIN_EMAILS` is hardcoded in three separate files** and gates the GSC connect button, despite a real `team_members` role system existing. Change all three or none (§20.1).

---

## 18. Build record

- **Solo build, end to end.** Architecture, research, implementation, brand system, debugging, data repair, and publishing integration — one person.
- **135 commits** in the current repository history, which begins 1 September 2026 at the baseline commit before the `ui-redesign` branch. The project itself started in August; this repo's history covers the v2 rebuild.
- **1 September:** `/atelier-v2` route shell scaffolded.
- **2 September:** full GEO Blog Generator UI implemented on v2.
- **7 September:** plan screen, saved plans, version switcher, AI usage budget system, FAQ accordion, brand voice highlighting, autosave, URL persistence, SEO metadata with lock/finalise gate.
- **10–13 September:** Sanity GEO schema and template renderer, publish with image upload, section images, dynamic categories.
- **14 September:** FAQ parsing repair across all four generation pathways, duplicate-session fix, batch-queue open-to-editor, editable/removable images and pull quote, batch builds generate illustrations, images persist, cards sort by last modified, batch History section, production build unblocked.
- **15 September:** publish-to-live verified; distribution loop closed.

---

## 19. What is open

**Near term**

1. **Enable Gemini in AI Echo and re-baseline.** The engine is shipped `disabled: true`, so the existing baseline covered two engines, not three (§14, §20.5). Answered, not yet acted on.
2. **Deploy the updated `blogPost` schema** so the `pullQuote` field appears in Sanity Studio.
3. **Resolve the intermittent manual image generation failure** — the backend is verified healthy end to end (key present, model responds 200, budget headroom, valid generation on first attempt), so the fault is client-side. All failure paths now surface a visible error; awaiting the actual message.
4. **Author schema decision** — does content publish under a house byline ("AI To Market") or named individuals (Manoj, Lucas)? Schema markup for Author is blocked on this and nothing else.

**Layer 2 remaining**

- **Structured data on publish** — the generators are **built and working** (§13.4): Organization, WebSite, Article, FAQPage, Product, BreadcrumbList and SpeakableSpecification, plus a GEO coverage score with recommendations, all exposed at `/atelier/structured-data`. What remains is **wiring them into the publish pipeline** so schema is emitted automatically rather than generated by hand. `sanity-publish.ts` currently emits no JSON-LD. Author schema is additionally blocked on the byline decision above.
- **Stack simplification** — fold the citation judge into the search-preview response to go from three model calls to two, and remove the cookie-UUID auth fallback now that Supabase auth is stable. *(SerpAPI turned out not to be present at all — see §20.2.)*

**Planned features — agreed direction, not yet built**

- **Keyword expansion via People Also Ask / People Also Search For.** For every keyword in the library, pull its PAA and PASF questions and add them back as prompts. Each new question carries its own PAA set, so the library compounds rather than needing to be hand-maintained. Full rationale in **§20.1**.

**Layer 3 — the closed loop**

The system currently publishes and measures separately. The remaining work joins them: every published article's target queries tracked automatically, citation decay flagged when a previously-cited article stops being cited, content gaps surfaced from the prompt library against live AI Echo results, topic cluster mapping, competitor citation tracking inside AI Echo, and an internal linking assistant.

PAA expansion (above) is the feeder for most of this — it is what keeps supplying new prompts for the loop to measure and fill.

That is what turns this from a very good content engine into a system that tells you what to write next without being asked.

---

## 20. Built but not switched on — the future-pipelines inventory

Everything in the codebase that exists but is not live: commented out, mocked, gated behind a flag, or simply never wired to a caller. Recorded deliberately, because this is the work that is **already half-done** and therefore the cheapest to finish — and because undocumented dead code eventually gets deleted by someone who assumes it was a mistake.

### 20.1 Keyword expansion — PLANNED FEATURE, not yet built

> **Status: future addition. Designed intent recorded here; no code written yet.**

**Current state.** The keyword pipeline has exactly four sources: **GSC top queries** (30, 90-day window) · **AI Echo prompt history** (30, deduped) · **user-typed custom keywords** · **a static seed list**. There is **no expansion step of any kind** — no autocomplete, no clustering, no related-query mining.

#### The planned addition: People Also Ask / People Also Search For

**The intent.** For every keyword in the library — starting with the ones already coming out of Search Console — pull its **"People Also Ask"** and **"People Also Search For"** questions and fold them back into the library as prompts in their own right.

**Why it is the highest-value unbuilt feature: it compounds.** Each PAA question is itself a question a buyer types, and therefore a prompt worth owning. Each of *those* has its own PAA set. One seed keyword becomes a branch, then a tree. **The prompt library grows itself instead of being hand-maintained** — which is the difference between a keyword list someone has to remember to update and a search surface that keeps expanding on its own.

It also fits the tool's existing grain exactly: PAA questions are already phrased as questions, which is the form the whole engine is built around — question-style headings satisfy the GEO fan-out signal (§8.2), and the FAQ block is already a first-class section type.

**One clarification worth recording, because it will otherwise cause confusion.** The phrase already appears in the codebase: `generate-outline/route.ts:39` carries the outline rule *"Last section must be type 'faq' (FAQ at the end maximises People Also Ask extraction)."* That is a **prompt instruction to the writer model about article structure** — it tells the model to put the FAQ last so Google is more likely to lift it into a PAA box. It is the *output* side of PAA. Nothing in the tool currently **queries** PAA data as an *input*. The two are unrelated, and finding that string is not evidence the feature exists.

**Two smaller wins already sitting in the existing GSC integration:**

| Gap | Detail |
| :--- | :--- |
| **Metrics are fetched then thrown away** | `/api/gsc/top-queries` returns `{ query, clicks, impressions, position }` and the `GSCQuery` interface models all four — but **both** copies of `KeywordWorkspace` destructure only `{ query }`. Impressions and average position are the two numbers that tell you which keywords are *nearly* winning. They are already in the response. |
| **Only one GSC dimension is requested** | The call asks for `dimensions: ["query"]` only. `page`, `country`, `device` and `date` are never requested — so there is no per-page keyword mapping, no geography, and no trend over time. |

**Also here:** `ADMIN_EMAILS` is a hardcoded allowlist (`neha@`, `manoj@`) **duplicated across three files**, gating the "Connect GSC" button. It should be a role check against `team_members`, which already exists.

The **Prompt library screen** (§12.3) is the surface this would populate — the cluster cards and coverage bars are already designed and currently filled with hardcoded numbers.

### 20.2 Trends, competitor gap and SEMrush — present, wired to nothing

A substantial amount of the inherited retail machinery is still in the tree, fully disconnected:

- **`useGapConcurrence.ts`** — four React Query hooks with `enabled: false` hardcoded on every one (brand blogs, competitor blogs, competitor topic gaps, competitor topics by theme). They fire only via a manual `refetch()`.
- **`SecondarySections.tsx`** — **700+ lines, imported nowhere.** The complete "Trends by theme" and "Competition gap analysis" UI: collapsible sections, competitor-only topics, shared high-value keywords, a topics-by-theme grid.
- **`useTendancesThemes.ts`** — trends-by-theme hook whose only consumer is that dead component.
- **Client wrappers pointing at routes that do not exist** — `postOpportunitiesRefreshCompetitors/Dates/Trends/All`, `getCompetitorTopicGaps`, `getCompetitorsBlogsRecent`, `getBrandBlogsRecent`, `getHarvestEyeTopics`, `getGenerateEyeContentTopics`. There is no `api/opportunities/refresh/` directory. **One of these fires on every layout mount** (`usePrefetchDashboardData`) and 404s silently.
- **A SEMrush schema that was never used** — `schema-vusion-v2.sql` defines `vusion_semrush_keywords`, `vusion_semrush_serp`, a `semrush_keywords_ids` array and a `seo_score` column with RLS policies. No TypeScript references any of it.

**Correction to the earlier log: SerpAPI is not in this codebase at all.** No `serpapi`, `dataforseo`, or equivalent reference in `src/` or the env files. The long-standing "drop SerpAPI" task is already done by virtue of it never having been wired in. The only SERP artefact is the unused table above.

**Seasonal, by contrast, is still live** — `api/opportunities/generate-for-date`, a `seasonal_dates` setting, and a filter in the v1 app. It is not the primary path any more (§4.1), but it has not been removed.

**Decision needed:** delete this material or finish it. Competitor gap analysis is genuinely valuable for GEO — knowing which prompts a competitor is cited for and you are not is exactly the Layer 3 question. But it is currently 700 lines of UI attached to endpoints that do not exist, and it should not sit in that state indefinitely.

### 20.3 Commented-out features

| What | Where | If re-enabled |
| :--- | :--- | :--- |
| **The 4-step article wizard** | `atelier-v2/page.tsx:876–1022`, behind `{false && …}` | ~146 lines of built JSX: target prompt + adjacent prompts, entities to assert, a citable-source drop zone, voice profile dials, and a review step. Doubly unreachable — `FlowMode` never offers `"wizard"`. The most finished unused UI in the repo. |
| **The GEO score screen** | Nav entry and router line both commented, `// score lives inside the article editor` | Would surface the dial / dimension bars / section heatmap. Deliberate: the editor's quality sidebar replaced it. |
| **DB-backed rate limiting** | `rate-limit.ts:6`, `// import { getPool }` | Globally enforced limits instead of per-instance. **This one matters on a multi-instance deploy** — see 20.5. |

### 20.4 Mock data — where the numbers are not real

Consolidating §12.3 with what is beneath it:

- **Five v2 screens are entirely hardcoded** — Overview, Prompt library, Visibility, Publishing, and the unreachable GEO score screen.
- **`/atelier/authority`** renders an honest amber **"Mock data"** badge over an authority score, bot-crawler table, citation moments and voice share.
- **`/atelier/ai-echo`** carries ~360 lines of dummy GEO-run data behind a `@ts-ignore`, enough to demo the whole screen offline.
- **`PIPELINE_STEPS`** — a 5-step "how GEO works" explainer, defined and never rendered.
- **`dataState`** has `loading` and `empty` variants written for the dashboard (including a "Connect a domain" CTA) that are unreachable because the state is pinned to `"normal"` with no setter.

**Three mock behaviours that deserve to be treated as risks, not features:**

1. **Mock articles are written to the database as if real.** `validate-plan` falls back to `mockArticleResponse()` when OpenAI is absent or fails, and there is an explicit `// Persist the mock too — without this, refresh would lose it`. The intent is sound; the consequence is that a canned article can become indistinguishable from a generated one. Same pattern in `generate-outline`.
2. **Every new user's opportunity list is seeded from mock fixtures and written to the DB**, so mock rows and real rows sit in the same table with nothing marking them apart.
3. **`NEXT_PUBLIC_USE_MOCKS` is set in `.env`.** Anyone reading the app's output should confirm which mode it is in before trusting a number.

There is also a complete per-endpoint **Mock/API override system** (`useApiMode`) mounted in the provider tree with exactly one consumer — the "Parameters" UI that would let someone flip endpoints individually was never built.

### 20.5 Disabled subsystems and known-weak spots

| Area | State | Consequence |
| :--- | :--- | :--- |
| **Rate limiting** | In-memory only, per-instance | On a multi-instance serverless deploy the limits are effectively bypassable. The DB-backed version is one uncommented import away. |
| **GA4 OAuth tokens** | Held in a module-level `Map`, with a comment saying to replace it in production | **Tokens are lost on every cold start**, so the GA4 connection silently drops. |
| **GA4 analytics route** | Returns mock data both when unconnected **and inside the `catch` block** | A real GA4 API error is indistinguishable from "not connected" except via an `isMock` flag. **This is the same silent-failure class as §9.4** and should be treated as a bug, not a fallback. |
| **Gemini in AI Echo** | `disabled: true`, `sublabel: "Coming soon"` | GPT and Claude Haiku run; Gemini is the third engine the baseline claims to cover. **Directly relevant to the open question in §14** about whether all three engines actually ran. |
| **Snowflake / AWS export** | Buttons present, both `toast.info("… coming soon")` | Warehouse export of GEO run results. |
| **`useGenerateContent`** | Throws `"not implemented"`, zero callers | A workflow that never got a backend. |
| **`db/client.ts`** | Legacy shim, `getPool()` returns `null` unconditionally | All traffic goes through Supabase; the Postgres pool is a tombstone. |
| **`db/insights.ts`** | `export {}` with a deprecation note | Pure tombstone, nothing imports it. |

### 20.6 The Publishing wall

The v2 Publishing screen is a **built integrations page hidden behind a gradient overlay**. Delete the overlay `div` and the whole thing renders: an integrations grid (WordPress, Webflow, HubSpot, Contentful, Schema injector, Slack) with Connect and Configure-mapping buttons, plus four publishing rules — *"Block publishing below GEO score 75"*, *"Require one human approval per article"*, *"Inject FAQ and Article schema on push"*, and *"Auto publish approved drafts on schedule"* (the only unchecked one).

Those rules are a genuinely good specification for a publishing gate, written down and not yet implemented. The first two in particular are exactly the controls an enterprise content operation needs, and the third is the §13.4 structured-data wiring described from the other direction.

### 20.7 Dead code — exists, zero callers

Kept as an inventory so nothing is deleted by accident or rediscovered from scratch.

**API routes with no caller:** `gsc/debug` (GSC property diagnostics — useful, given the `siteUrlCandidates` fallback loop exists precisely because of that problem), `health` (never polled), `illustration-preview`, `insights/push-from-builder` (works, pushes a builder draft into Content Forge, nothing links to it).

**Components never imported (19):** the entire alternate radar presentation — `RadarGrid`, `RadarTable`, `Top8Block`, `OpportunityRow`, `OpportunityCardCompact`, `OpportunityTableRow`, `DetailsDrawer`, `ViewToggle`; `KeywordDirectionBlock` (3 suggested titles from keywords); a **command palette** (`CommandBar` + `KeywordsTopicsModal`); superseded editor parts (`DraftBlock`, `DraftSectionBlock`, `TableOfContents`); `OpportunityContextPopover`; `PublishPreview`; two insights components.

**Hooks never imported:** `useAnalyzeTitle`, `useApiLog` (pairs with the real `api-log.ts` — a debugging panel that was never surfaced), `useEditArticleSection`, `useFlashAudit`, `useGenerateContent`.

**Lib files never imported:** `api-errors.ts` (the typed error hierarchy — routes use `ok()`/`err()`), the `api-schemas` barrel, the `db` barrel, **`i18n.ts` plus `locales/fr.json`** — a French translation layer from the original build whose `t()` is never called, with surviving traces in filter ids `"tendance"` / `"saisonnier"`; and `insights/mock-insights.ts`, which still carries product names from the prior retail CMS (Captana, Engage, SESimagotag).

### 20.8 Priority if this list were worked down

1. **PAA / PASF keyword expansion** (20.1) — highest value, nothing built yet, compounds over time.
2. **Render the GSC metrics already being fetched** (20.1) — smallest possible change, immediate usefulness.
3. **Fix the GA4 silent-mock-on-error path** (20.5) — it is a correctness bug wearing a fallback's clothes.
4. **Persist GA4 tokens** (20.5) — the connection currently dies on every cold start.
5. **Enable Gemini in AI Echo** (20.5) — required before the citation baseline can be called complete.
6. **Wire structured data into publish** (§13.4) — generators already built and working.
7. **Implement the two publishing gates** (20.6) — score threshold and human approval, already specified.
8. **Decide on the trends/competitor-gap material** (20.2) — finish it or delete it, but do not leave it.
9. **DB-backed rate limiting** (20.3) — before any multi-instance deployment.
10. **Replace `ADMIN_EMAILS`** with a `team_members` role check (20.1) — the role system already exists.

---

*Document maintained by Manoj Kumar Gunasekaran. Update the date at the top when you revise it.*
