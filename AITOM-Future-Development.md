# AI TO MARKET — Future Development

### Outstanding work across the website and the GEO engine

**Created:** Tuesday, 15 September 2026
**Owner:** Manoj Kumar Gunasekaran
**Covers:** `INTERNAL-Website-AI_To_Market-Official` and `internal-agent-geo_optimiser-master`
**Companion document:** `AITOM-GEO-Tool-Project-Log.md` — the full record of what the GEO engine is and how it was built. This file is only the forward-looking list.

---

## How to read this

Everything here is **real code that exists in the repositories** — commented out, stubbed, mocked, hardcoded, unwired, or missing a dependency. Nothing is speculative feature wishing. Each item carries a file reference so it can be picked up without rediscovery.

Priority labels:

| Label | Meaning |
| :--- | :--- |
| **P0** | Do now. Security, data protection, or something visibly broken to a visitor. |
| **P1** | High value, and the groundwork already exists. |
| **P2** | Worth doing, no urgency. |
| **P3** | Decide whether to finish or delete. Do not leave indefinitely. |

---
---

# SECTION 1 — WEBSITE

`C:\Users\Photo\Documents\INTERNAL-Website-AI_To_Market-Official`

---

## 1.0 P2 — Career pipeline: Kanban board awaiting its data source

**Correction to an earlier draft of this document.** An earlier version flagged this as a live data exposure. **That was wrong, and the correction matters.**

### The actual position

The production careers flow is **email only**. `app/api/careers/apply/route.ts` receives the application, sends the CV as an attachment through **Resend** to the per-role recipients, sends the candidate a confirmation, and returns. **It never writes a `jobApplication` document to Sanity.**

Because nothing creates those documents, `app/api/pipeline/applications/route.ts` — which queries `*[_type == "jobApplication"]` — returns an **empty array** in production. The Kanban board at `/admin/pipeline` renders five empty columns. **There is no candidate data behind that endpoint, so there is nothing exposed, and no authentication is needed for the flow as it stands today.**

The board was built ahead of the pipeline that would fill it. That is a sequencing decision, not a defect.

### What is genuinely outstanding

Two items, both **conditional on storing applications**, and both recorded so they are not forgotten when that happens:

1. **Authentication must land in the same change as storage.** The moment a `jobApplication` document is created, the unauthenticated `GET` starts returning real names, emails, cover letters and CV URLs. The check belongs **in the route handler**, not on the page — the existing `sessionStorage` password screen guards a page while the data sits behind a route that checks nothing.
2. **The `PATCH` should be constrained regardless.** It calls `sanityClient.patch(id).set({ status })` on whatever document ID the caller supplies, and `sanityClient` carries a write token. It is not limited to `jobApplication` documents. Low severity while nobody knows the endpoint exists, but it costs little to add a `_type` assertion and a status allowlist.

Also: the schema's status list (`new`, `reviewing`, `shortlisted`, `rejected`, `hired`) does not match the board's columns (`new`, `reviewing`, `shortlisted`, `selected`, `rejected`). Dragging to "Selected" writes a value the schema does not offer.

### Where this work now lives

**Handover package:** `handover-career-pipeline/` in the website repository — every file involved, plus `README.md`, a full integration guide written for **Shashank**, who is picking this up. It covers the current email flow, the board's features, the unmerged **OnTrack** integration on branch `cv-dev` (Google Drive upload plus an intake webhook), four defects in that branch to fix before it ships, and the decision that governs everything else: whether OnTrack owns the pipeline — in which case the board and the `jobApplication` schema should be **deleted** rather than left empty — or the site does.

**Treat that README as the source of truth for this area.** Nothing further is needed in this document.

---

## 1.1 P0 — Broken and dead links

| Item | Where | Fix |
| :--- | :--- | :--- |
| **`/academy` 404s** | `components/sections/Hero.tsx:75` — `ctaSecondaryHref: '/academy'` | The Academy hero slide's "See the programme" button leads nowhere. `app/academy/` does not exist. Either build the page or repoint the CTA. **A visitor hits this from the homepage.** |
| Category links go nowhere | `lib/sanity.ts:630` — `category: { name, href: '#' }` | Every blog card's category is a link to `#`. Either build category archive pages or render it as plain text. |
| Author links go nowhere | `lib/sanity.ts:634` — `author: { name, href: '#' }` | Same. There are no author pages. |
| Logo `href="#"` | `components/ui/Logo.tsx:56` | Latent only — every current call site passes `noLink`. Worth fixing before someone uses it without. |

---

## 1.2 P1 — Blog

**Read time is currently hidden** — `components/sections/blog/BlogCard.tsx:85` and `:232`, commented out in both card variants on 15 Sep 2026.

The reason is recorded in the code: the value is computed once at publish time in the GEO tool (`sanity-publish.ts` — words ÷ 200, rounded up) and frozen onto the Sanity document. It never updates when a post is edited in Studio, and any post lacking the field falls back to a hardcoded `'5 min read'` (`lib/sanity.ts:239`, `:633`) — so older posts all claimed the same length regardless of actual length.

**To re-enable:** derive read time from the live content at render time rather than reading a stored string. Then uncomment both blocks.

| Item | Where | Note |
| :--- | :--- | :--- |
| **Blog index is client-rendered** | `app/blog/page.tsx:1,14` — `'use client'` + `useEffect` fetch | The post list is fetched in the browser, so **crawlers and answer engines see an empty list**. For a site whose entire strategy is being cited by LLMs, this is the highest-impact item on the page. Move to a server component. |
| **No pagination** | `components/ui/Pagination.tsx` | The component is **built and has zero references**. Wire it into `/blog` once the list grows. |
| **Dead newsletter form** | `components/sections/blog/GeoTemplate.tsx:524` | "Get our blogs in your DMs" with an email input and a Subscribe button — **no `onSubmit`, no handler, no API route**. It silently does nothing. Either wire it up or remove it; a form that appears to work and does not is worse than no form. |
| Inactive posts still reachable | `lib/sanity.ts:51` | `getBySlug` has no `isActive != false` clause, unlike `getAll` (`:38`), `getByCategory` (`:79`) and `getAllBlogSlugs` (`:384`). A post unchecked in Studio disappears from lists but stays live at its direct URL. |
| `comparison` section type unrendered | `schemas/objects/geoSection.ts:15` | Selectable in Studio, but `GeoTemplate.tsx` has no `comparison` branch — it falls through to generic rendering. |

---

## 1.3 P1 — SEO and structured data

This matters more here than on a normal site: the company sells GEO.

| Item | Where | Impact |
| :--- | :--- | :--- |
| **No FAQ schema on GEO articles** | `app/blog/[slug]/page.tsx:49` | Only `BlogPosting` is emitted. GEO articles carry real FAQ sections (`geoSection` type `faq`) but **no `FAQPage` / `Question` JSON-LD**. This is precisely the feature the SEO demo sells, unimplemented on the company's own site. The GEO tool already has a working `FAQPage` generator (§2.6) — the two ends just need connecting. |
| **Sitemap is missing pages** | `app/sitemap.ts:21` | Static list covers only `/`, `/clients`, `/about`, `/careers`, `/blog`. **`/demos` and the three demo pages are absent**, as are `/contact` and `/content`. |
| **Site URL falls back to a preview domain** | `lib/seo.ts:2,16` | If `NEXT_PUBLIC_SITE_URL` is unset in production, every canonical, OG URL, sitemap entry and RSS link points at `ai-to-market.vercel.app`. **Verify this is set in Vercel.** A silent wrong-domain canonical is an SEO disaster that produces no error. |
| Hardcoded domain | `app/careers/page.tsx:12,14,19` | Uses the literal production URL instead of `getSiteUrl()`. Also no `alternates.canonical`. |
| No OG/Twitter on demo pages | `app/demos/*/page.tsx` | `metadata` carries only `title` and `description`. Demo links shared on LinkedIn get no card. |
| `/demos` and `/contact` have no metadata | both are `'use client'` | They inherit the root title and description. |
| Thin Organization schema | `app/layout.tsx:116` | No `sameAs`, `address`, `contactPoint` or `founder`. The social profiles in the footer are not connected to the entity graph — which is exactly how answer engines resolve entity identity. |
| `llms.txt` incomplete | `app/llms.txt/route.ts:15` | Lists only Home, Blog, Team. Omits `/demos`, `/clients`, `/careers`, `/content`, and has no per-article listing. |
| `/admin/pipeline` crawlable | `app/robots.ts:8` | Not in `disallow`. See §1.0. |
| Manifest has no `start_url` | `app/manifest.json` | PWA install target undefined. |
| Dead import | `app/layout.tsx:2` | `import Script from 'next/script'` — imported, never used. |

---

## 1.4 P0/P1 — Analytics, consent and legal pages

### P0 — There is no privacy policy

**No `/privacy`, `/cookies` or `/terms` page exists anywhere in `app/`**, and the footer (`components/layout/Footer.tsx:23`) links to none.

Meanwhile the site:
- sets cookies for **two GA4 properties**, **Microsoft Clarity**, and a **LinkedIn pixel**
- asks for consent in a banner (`components/CookieConsent.tsx:128`) that **links to no policy**
- has a required consent checkbox on the contact form (`components/ui/ContactForm.tsx:429`) that **also links to no policy**
- collects job applications including CVs

Asking for informed consent without publishing what is collected or why is not a defensible position for a UK/EU company. This is a content and legal task rather than an engineering one, but it blocks nothing else, so it can start immediately.

### P1 — Google Consent Mode v2 is not implemented

`components/CookieConsent.tsx:110` — `onConsent` and `onChange` only ever **load** tags.

Two consequences:

1. **No default denied state.** There is no `gtag('consent', 'default', { ... 'denied' })` before the tag loads, so GA has no signal at all until the user accepts. Consent Mode v2 expects the denied default and uses it for modelling.
2. **Withdrawal does not take effect until the next page load.** Unticking a category does not unload the script or signal denial — the already-loaded tag keeps running for the rest of the session.

| Item | Where | Note |
| :--- | :--- | :--- |
| IDs hardcoded in client source | `CookieConsent.tsx:33` GA4 `G-44QSLG3KVQ`, `G-RYZJ156MPL`; `:70` Clarity `v1xai512z0` | Should be environment variables. |
| LinkedIn pixel fires with `pid=undefined` | `CookieConsent.tsx:10,27` | If `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` is unset the pixel **still loads** and sends a broken ID. Guard it. |
| Vercel Analytics bypasses consent | `app/layout.tsx:152` | `<Analytics />` runs unconditionally, outside the consent gate. |

---

## 1.5 P2 — Forms and scheduler

| Item | Where | Note |
| :--- | :--- | :--- |
| Contact preference disabled | `ContactForm.tsx:354` | The "Email me / Book a call" radio buttons are commented out. |
| **Dead branch behind it** | `ContactForm.tsx:387` | With the radios gone, `contactPreference` is permanently `'email'` — so the scheduler iframe and its fallback **can never render**. `:398` reads *"Booking widget will appear here once scheduler is configured."* |
| Scheduler env vars unset | `ContactForm.tsx:49` | `NEXT_PUBLIC_SCHEDULER_PROVIDER`, `NEXT_PUBLIC_SCHEDULER_URL` — a Calendly/Cal.com integration that is switched off. |
| Native `alert()` for errors | `ContactForm.tsx:115` | Form errors use a browser alert instead of inline UI. |
| **Contact leads silently not logged** | `lib/googleSheets.ts:4-7,32` | If the four `GOOGLE_*` env vars are unset, `appendContactRow` **returns silently**. No error, no log — leads vanish from the sheet with nobody told. Same silent-failure class as the citation bug in the GEO tool. |
| **Test email fallbacks** | `app/api/contact/route.ts:104,106` | `RESEND_TO_EMAIL` falls back to `delivered@resend.dev` / `onboarding@resend.dev`. If the env var is unset **in production, enquiries go to a test address and are lost.** Verify it is set. |
| Mobile nav incomplete | `components/layout/Navigation.tsx:169` | No `/demos` ("See It Live") entry and no "Get In Touch" CTA — both are `hidden md:flex`, so **mobile visitors cannot reach the demos or the contact CTA from the menu.** |
| Footer links sparse | `components/layout/Footer.tsx:30` | Only `/clients`. No `/blog`, `/about`, `/careers`, `/demos`, `/content` or legal page. |
| `/content` orphaned | `app/content/page.tsx` | Not in the nav, footer or sitemap. Reachable only via the disabled `FeaturedPosts` card. |

---

## 1.6 P2 — Demos catalogue

| Item | Where | Note |
| :--- | :--- | :--- |
| Five of eight demos unbuilt | `lib/demos.ts:324-378` | `pipeline-tracking`, `performance-review`, `budget-planning`, `onboarding-automation`, `objection-coach` — all `available: false`, rendering as inert "In build" cards. |
| All three live demos are scripted | `lib/demos.ts:143` | `SIMULATION_NOTE` states it plainly on the page, which is the right call: *"a scripted walkthrough running on static sample data. No live systems, customer data or models are connected."* |
| Thumbnails are stock placeholders | `lib/demos.ts:101` | *"a stand-in until something more specific replaces it."* |
| Testimonial hardcoded | `components/demos/TestimonialBand.tsx:20` | One quote reused across the catalogue and a demo page. Not CMS-driven. |
| `UpcomingCard` now dead | `components/demos/UpcomingCard.tsx` | Zero references after the catalogue restructure on 15 Sep — `DemoCard`'s inert branch superseded it. Delete or reinstate. |
| Partial migration | `lib/demos.ts:47` | `detail` is *"being replaced by the before/after pair"* — both shapes still in use. |

---

## 1.7 P2 — Content currently hardcoded in components

None of this is in the CMS, so marketing cannot change it without a developer and a deploy.

| Item | Where |
| :--- | :--- |
| **Two divergent copies of the client logo list** | `components/sections/Hero.tsx:6` and `app/clients/page.tsx:6` — different Hansgrohe/Meta/Vusion files in each. **These will drift.** Consolidate to one source. |
| Homepage proof stats | `Hero.tsx:22` — `'3 min'`, `'12'`, `'3,500'` hardcoded |
| All homepage body copy | `PracticeMapV2.tsx:15,39`, `Services.tsx:6`, `TrustPillars.tsx:6`, `Methodology.tsx:5` — `practices`, `layers`, `pillars`, `steps` arrays |
| Client logo fallback | `components/demos/ClientLogoWall.tsx:22` — `FALLBACK_CLIENTS` for when Sanity is unreachable (this one is legitimate) |
| **Globe experience arcs all disabled** | `components/sections/GlobeSection.tsx:35-82` — arcs for Ayman, Paul, Khushi, Prathiksha, SaiVandana, Neha, Netherlands, Italy are **all commented out**, plus Martin's Bordeaux pin at `:26`. The globe renders pins only. |
| `PracticeMap` v1 interaction disabled | `PracticeMap.tsx:58` — expand/collapse commented out; the whole file is superseded by `PracticeMapV2` |

**Sanity schema gaps:**

- `schemas/blogPost.ts` has **no SEO fields** — no `metaTitle`, `metaDescription`, `ogImage`, `canonicalUrl` or `noindex`. Meta is derived from `excerpt` + `thumbnail` only.
- `schemas/caseStudy.ts` has **no `isActive` toggle**, unlike `blogPost`, `jobListing` and `featuredInternalPost`. A case study can only be hidden by deleting it.
- `lib/sanity.ts:479` — `noFilter?: boolean` exists in the TS type but not in the schema, not in the GROQ query, never set.
- `schemas/featuredInternalPost.ts:73` — `postType` is queried and typed but rendered **only in the Studio preview**, never on the public site.
- **`pullQuote` needs deploying** — the field was added to `schemas/blogPost.ts` but the Studio deploy has not happened, so it does not yet appear for editors.

---

## 1.8 P3 — Homepage sections switched off

`app/page.tsx` — six sections are imported-and-commented and rendered-and-commented:

`ValueProposition` (`:5`, `:30`) · `Solutions` (`:6`, `:31`) · `Approach` (`:7`, `:33`) · `ExecutionTracks` (`:8`, `:34`) · `CaseStudies` (`:9`, `:28`) · `FeaturedPosts` (`:13`, `:26`)

All six components exist and work. This is a deliberate editorial decision about homepage length, not a bug — but it should be revisited rather than left indefinitely. `FUTURE.md` in the repo documents these and is **now partly stale**: it describes a commented-out "Interactive Demo" nav button that no longer exists (replaced by the live "See It Live" → `/demos` button, `Navigation.tsx:97`) and an L'Oréal filter in `CaseStudies.tsx` that has since been removed.

**Either update `FUTURE.md` or delete it in favour of this document.** Two future-work files that disagree is worse than one.

---

## 1.9 P2 — Accessibility and performance

| Item | Where |
| :--- | :--- |
| **19 raw `<img>` tags vs 7 `next/image`** | `app/clients/page.tsx:67`, `CaseStudies.tsx:92`, `TestimonialBand.tsx:68`, `DemoCard.tsx:50`, `GeoTemplate.tsx:366,436` and others — each with an eslint suppression. No responsive sizing, lazy loading or format negotiation. |
| Case-study images can have empty alt | `CaseStudies.tsx:92` + `lib/sanity.ts:469` | `alt` falls back to `''` when not authored in Sanity. |
| Known sub-AA contrast, accepted | `app/demos/executive-reporting/executive-reporting-demo.tsx:17` | A disabled control at 4.2:1. WCAG exempts inactive components; documented deliberately. |
| Reveal-animation race mitigated, not removed | `hooks/use-reveal.ts:79` | Hardened on 15 Sep with an immediate reveal for on-screen elements plus a scroll sweep. The underlying pattern — CSS hiding content until JS runs — remains. |
| Article HTML injected raw | `GeoTemplate.tsx:540` | `dangerouslySetInnerHTML` for article content. Sanitisation happens upstream in the GEO tool, so the trust boundary is the publish route — worth keeping in mind. |
| Leftover template config | `next.config.js:11` | `images.remotePatterns` still allows `images.unsplash.com` and `www.untitledui.com`; zero references remain. |

---

## 1.10 Dead code — website

- `lib/sanity.types.ts` — 89 lines, **zero imports**, and stale: its `category` union omits `'geo'`.
- `components/sections/ClientLogos.tsx` — superseded by `components/demos/ClientLogoWall.tsx`, which documents it as *"a second, unused implementation with different geometry"*.
- `components/ui/Tabs.tsx`, `components/ui/Avatar.tsx`, `components/ui/LinkedInPostCard.tsx` — built, zero references.
- `components/ui/Pagination.tsx` — built, zero references (see §1.2).
- `components/demos/UpcomingCard.tsx` — zero references as of 15 Sep.

---

## 1.11 Environment variables to verify in production

**Every one of these fails silently when unset.** That is the common thread and the thing to fix structurally — a missing variable should be loud.

| Variable | Used at | Silent behaviour when unset |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | `lib/seo.ts:16` | All canonicals, OG, sitemap and RSS point at the Vercel preview domain |
| `RESEND_TO_EMAIL` | `api/contact/route.ts:104` | **Enquiries go to `delivered@resend.dev` and are lost** |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` / `SHEET_ID` | `lib/googleSheets.ts:4` | Contact leads are not written to the sheet, no error raised |
| `NEXT_PUBLIC_LINKEDIN_PARTNER_ID` | `CookieConsent.tsx:10` | Pixel fires with `pid=undefined` |
| `RESEND_TO_EMAIL_DATA_COLLECTOR` | `api/contact/route.ts:231` | Second-recipient copy skipped |
| `SANITY_API_TOKEN` | `lib/sanity.ts:9` | Draft reads and the pipeline PATCH fail |
| `RESEND_API_KEY` | `api/demo-enquiry/route.ts:58` | Returns 503, client falls back to `mailto:` — deliberate and documented |
| `NEXT_PUBLIC_SCHEDULER_*` | `ContactForm.tsx:49` | Booking widget replaced by placeholder |

---
---

# SECTION 2 — GEO ENGINE

`C:\Users\Photo\Documents\internal-agent-geo_optimiser-master`

Full detail lives in **`AITOM-GEO-Tool-Project-Log.md` §20**. This is the working summary.

---

## 2.1 P1 — Keyword expansion: People Also Ask / People Also Search For

**Status: planned feature, no code written.**

**The intent.** For every keyword in the library — starting with what Search Console already returns — pull its **People Also Ask** and **People Also Search For** questions and fold them back into the prompt library as prompts in their own right.

**Why it is the highest-value unbuilt feature: it compounds.** Each PAA question is itself a question a buyer types, so it is a prompt worth owning. Each of *those* has its own PAA set. One seed keyword becomes a branch, then a tree. **The library grows itself** instead of being hand-maintained.

It also fits the existing grain exactly — PAA results are already phrased as questions, which is the form the engine is built around: question-style headings satisfy the GEO fan-out signal, and FAQ is already a first-class section type.

**One clarification, because it will otherwise waste someone's afternoon.** The phrase already appears in the codebase at `generate-outline/route.ts:39`: *"Last section must be type 'faq' (FAQ at the end maximises People Also Ask extraction)."* That is a **prompt instruction to the writer model about article structure** — the *output* side, telling it to place the FAQ where Google is most likely to lift it into a PAA box. Nothing currently **queries** PAA data as an input. Finding that string is not evidence the feature exists.

### Two smaller wins already sitting in the GSC integration

| Gap | Detail |
| :--- | :--- |
| **Metrics fetched then discarded** | `/api/gsc/top-queries` returns `{ query, clicks, impressions, position }` and the `GSCQuery` interface models all four — but **both** copies of `KeywordWorkspace` destructure only `{ query }`. Impressions and average position are exactly the numbers that identify keywords you are *nearly* winning. Already in the response, just not rendered. |
| **One dimension requested** | The call asks for `dimensions: ["query"]` only. `page`, `country`, `device` and `date` are never requested — no per-page keyword mapping, no geography, no trend over time. |

**Also:** `ADMIN_EMAILS` is a hardcoded allowlist duplicated across **three files**, gating the "Connect GSC" button, despite a real `team_members` role system existing. Replace with a role check.

The **Prompt library screen** is the surface this populates — its cluster cards and coverage bars are already designed and currently filled with hardcoded numbers.

---

## 2.2 P1 — Correctness bugs wearing fallbacks' clothes

These are grouped because they are the same mistake three times: **a failure path that returns a plausible empty result instead of an error.**

| Item | Where | Problem |
| :--- | :--- | :--- |
| **GA4 returns mock data from inside `catch`** | `api/analytics/route.ts:401` | A genuine GA4 API error is indistinguishable from "not connected". Only an `isMock` flag distinguishes them, and the UI barely surfaces it. **Treat as a bug, not a fallback.** |
| **GA4 tokens lost on cold start** | `lib/ga4-oauth-store.ts:20` | Held in a module-level `Map` with a comment saying to replace it in production. The connection silently drops and must be reconnected. |
| **Mock articles persisted as real** | `validate-plan/route.ts:320` | `// Persist the mock too — without this, refresh would lose it`. The intent is sound; the consequence is that a canned article is indistinguishable from a generated one in the database. Same pattern in `generate-outline`. |
| **New users seeded with mock opportunities** | `api/opportunities/route.ts:16` | Mock fixtures are written to the DB so the dashboard is not empty. Mock and real rows then sit in the same table with nothing marking them apart. |

`NEXT_PUBLIC_USE_MOCKS` is set in `.env` — confirm which mode the app is in before trusting any number it displays.

**The standing rule this should produce:** a `catch` that returns a falsy "not found" cannot distinguish *legitimately absent* from *integration entirely broken*. This already bit the citation finder badly (see the project log §9.4, where `gpt-4o-search-preview` was removed by OpenAI and every call 404'd silently for weeks while the feature appeared to work).

---

## 2.3 P1 — Gemini is disabled in AI Echo

`atelier/ai-echo/GeoAnalyticsClient.tsx:118` — `disabled: true`, `sublabel: "Coming soon"`.

GPT and Claude Haiku are enabled. **The 0% citation baseline therefore covers two engines, not three.** That does not invalidate the finding — 0% across two major engines is still 0% — but the baseline must be restated before it is quoted as three-engine coverage. Enable Gemini and re-run.

---

## 2.4 P1 — Structured data: built, not wired

`src/lib/structured-data/generators.ts` produces seven valid schema.org types:

**Organization · WebSite (with SearchAction) · Article · FAQPage · Product · BreadcrumbList · SpeakableSpecification**

`computeGeoCoverage()` scores which a page has and recommends the rest. It works, and it is exposed at `/atelier/structured-data`.

**What is missing is the wiring.** `sanity-publish.ts` emits no JSON-LD, so schema must be generated by hand on that screen and applied separately. Connecting the generator to the publish route is small, well-defined, and closes §1.3's FAQ-schema gap on the website at the same time. **These two items are the same job from opposite ends.**

Author schema is additionally blocked on one decision: **does content publish under a house byline ("AI To Market") or named individuals?** Nothing else blocks it.

---

## 2.5 P2 — Publishing gates, specified but not implemented

The v2 Publishing screen is a **built integrations page hidden behind a gradient "COMING SOON" overlay** with `pointerEvents: none`. Delete the overlay and it renders: an integrations grid (WordPress, Webflow, HubSpot, Contentful, Schema injector, Slack) and four publishing rules:

1. *Block publishing below GEO score 75*
2. *Require one human approval per article*
3. *Inject FAQ and Article schema on push*
4. *Auto publish approved drafts on schedule* (the only unchecked box)

Those four lines are a genuinely good specification written down and not built. **Rules 1 and 2 are exactly the controls an enterprise content operation needs**, and rule 3 is §2.4 described from the other direction.

---

## 2.6 P2 — Other disabled subsystems

| Area | State | Consequence |
| :--- | :--- | :--- |
| **Rate limiting** | In-memory only; the Postgres version is one commented import away (`rate-limit.ts:6`) | Per-instance, so on a multi-instance serverless deploy the limits are effectively bypassable. Fix **before** any scaled deployment. |
| Snowflake / AWS export | Buttons present, both `toast.info("… coming soon")` | Warehouse export of GEO run results. |
| `useGenerateContent` | Throws `"not implemented"`, zero callers | A workflow that never got a backend. |
| `db/client.ts` | Legacy shim, `getPool()` returns `null` | Tombstone; all traffic goes through Supabase. |
| `db/insights.ts` | `export {}` with a deprecation note | Pure tombstone. |
| The 4-step article wizard | `atelier-v2/page.tsx:876-1022`, behind `{false && …}` | ~146 lines of finished JSX — target prompt, entities to assert, citable-source drop zone, voice dials, review step. **The most complete unused UI in the repo.** Doubly unreachable: `FlowMode` never offers `"wizard"`. |
| The GEO score screen | Nav entry and router line both commented | Deliberate — *"score lives inside the article editor"*. The editor's quality sidebar replaced it. |

---

## 2.7 P2 — Screens still showing hardcoded numbers

Five v2 screens are entirely mock: **Overview, Prompt library, Visibility, Publishing, and the unreachable GEO score screen.**

`/atelier/authority` renders an honest amber **"Mock data"** badge. `/atelier/ai-echo` carries ~360 lines of dummy run data behind a `@ts-ignore`, enough to demo the screen offline.

The dashboard has `loading` and `empty` states written — including a "Connect a domain" CTA — that are **unreachable** because `dataState` is pinned to `"normal"` with no setter.

---

## 2.8 P3 — Trends, competitor gap and SEMrush: finish or delete

Inherited retail machinery, still in the tree and fully disconnected:

- **`useGapConcurrence.ts`** — four React Query hooks, `enabled: false` hardcoded on every one.
- **`SecondarySections.tsx`** — **700+ lines, imported nowhere.** The complete "Trends by theme" and "Competition gap analysis" UI.
- **Client wrappers pointing at routes that do not exist** — `postOpportunitiesRefresh*`, `getCompetitorTopicGaps`, `getHarvestEyeTopics` and others. There is no `api/opportunities/refresh/` directory. **One of these fires on every layout mount** and 404s silently.
- **A SEMrush schema never used** — `schema-vusion-v2.sql` defines `vusion_semrush_keywords`, `vusion_semrush_serp`, and a `seo_score` column with RLS policies. No TypeScript references any of it.

**Note:** SerpAPI is **not present in this codebase at all**. The long-standing "drop SerpAPI" task was already moot.

**The decision.** Competitor gap analysis is genuinely valuable for GEO — knowing which prompts a competitor is cited for and you are not is the core Layer 3 question. But 700 lines of UI attached to non-existent endpoints should not sit in that state indefinitely. Finish it or delete it.

---

## 2.9 P2 — Consolidate v1 and v2

Both apps ship and are routable. **V1 is not neglect** — AI Echo and the structured-data generator exist *only* there.

That is why a dozen API routes look unused when read against v2 alone: `/api/analytics`, `/api/keywords`, `/api/opportunities/*`, `/api/insights/*`, `/api/structured-data/generate`, `/api/article-builder/chat`, `/{id}/refine-draft`, `/{id}/revise-section`, `/{id}/revise-selection`, `/{id}/check-brand-voice`, `/{id}/fix-geo`, `/{id}/send-to-wordpress`.

**The work:** port AI Echo and structured data into v2, then retire `/atelier` and the routes only it uses. **Until then, check both apps before deleting any route.**

---

## 2.10 Near-term open items

1. **Deploy the updated `blogPost` schema** so `pullQuote` appears in Sanity Studio.
2. **Resolve the intermittent manual image-generation failure.** The backend is verified healthy end to end — key present, model responds 200, budget headroom, valid generation on first attempt — so the fault is client-side. All failure paths now surface a visible error; **waiting on the actual message to appear.**
3. **Decide the author byline** — house or individual. Blocks Author schema and nothing else.

---
---

# COMBINED PRIORITY

Across both repositories, in the order I would work them.

### Do now

| # | Item | Where |
| :--- | :--- | :--- |
| 1 | **Publish a privacy / cookie policy** — consent is being collected with nothing to link to | Website §1.4 |
| 2 | **Verify `NEXT_PUBLIC_SITE_URL` and `RESEND_TO_EMAIL` in production** — both fail silently, one poisons every canonical URL, the other loses enquiries to a test inbox | Website §1.11 |
| 3 | **Fix the `/academy` 404** reachable from the homepage hero | Website §1.1 |

### High value, groundwork exists

| # | Item | Where |
| :--- | :--- | :--- |
| 5 | **Server-render the blog index** — crawlers and answer engines currently see an empty list on the page the whole GEO strategy depends on | Website §1.2 |
| 6 | **Wire structured data into publish, and emit FAQ schema on articles** — one job, both ends, generators already built | GEO §2.4 + Website §1.3 |
| 7 | **PAA / PASF keyword expansion** — highest-value new feature, compounds over time | GEO §2.1 |
| 8 | **Render the GSC metrics already being fetched** — smallest possible change, immediate usefulness | GEO §2.1 |
| 9 | **Fix the three silent-failure paths** — GA4 catch-returns-mock, GA4 token persistence, Google Sheets lead logging | GEO §2.2 + Website §1.5 |
| 10 | **Enable Gemini and re-baseline AI Echo** — required before the citation baseline is quotable | GEO §2.3 |
| 11 | **Add `/demos` and the demo pages to the sitemap**; add OG metadata to demo pages | Website §1.3 |
| 12 | **Google Consent Mode v2** — default denied, and act on withdrawal | Website §1.4 |

### Worth doing

13. **Career pipeline** — handed to Shashank. Decide OnTrack vs. site-owned, then either finish the Sanity write + route auth together, or delete the board. See `handover-career-pipeline/README.md` (Website §1.0)
14. Wire or remove the dead newsletter form — GEO article template (Website §1.2)
15. Add `/demos` and the contact CTA to the mobile nav (Website §1.5)
16. Implement publishing gates 1 and 2 — score threshold and human approval (GEO §2.5)
17. Consolidate the two divergent client logo lists (Website §1.7)
18. Add SEO fields to the `blogPost` schema (Website §1.7)
19. Add `isActive` to `caseStudy` (Website §1.7)
20. Replace `ADMIN_EMAILS` with a `team_members` role check (GEO §2.1)
21. DB-backed rate limiting — before any multi-instance deployment (GEO §2.6)
22. Migrate raw `<img>` tags to `next/image` (Website §1.9)

### Decide, do not drift

23. Trends / competitor-gap / SEMrush material — finish or delete (GEO §2.8)
24. The six disabled homepage sections — restore or remove (Website §1.8)
25. The 4-step article wizard — finish or delete (GEO §2.6)
26. v1 / v2 consolidation (GEO §2.9)
27. Dead components in both repos (Website §1.10, GEO log §20.7)
28. **Reconcile `FUTURE.md` with this file** — it is partly stale, and two disagreeing future-work documents are worse than one (Website §1.8)

---

*Maintained alongside `AITOM-GEO-Tool-Project-Log.md`. Update the date at the top when revised.*
