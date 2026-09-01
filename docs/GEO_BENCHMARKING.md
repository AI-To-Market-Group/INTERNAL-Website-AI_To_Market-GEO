# GEO Benchmarking (MVP)

This doc describes how the GEO (Generative Engine Optimization) bench works, what the prompts are, and what metrics we collect. The backend uses **GPT only** (OpenAI).

---

## What are the prompts?

The prompts are **search-style questions** that you want to rank in AI answers (e.g. “What are the best running shoes for marathons?”, “How to optimize content for AI search?”). You enter them **one per line** in the GEO Ranking UI. Each line = one distinct prompt.

You choose one of **two bench modes**:

| Mode | What it does | What you get |
|------|----------------|--------------|
| **Repeat each prompt N times** | For each prompt in your list, we ask GPT the **same** question **N** times (e.g. 100). Each call is independent. | One row per prompt: **citation rate %** (e.g. 23/100 = 23%) — how often GPT cited you for that exact question. |
| **Generate X similar prompts per prompt** | For each prompt in your list, we use GPT to **generate X nearest/similar phrasings** (paraphrases, same intent). Then we run each of those X variants **once** and check citation. | One row per prompt: **citation rate %** (e.g. 7/10 = 70%) — how many of the similar phrasings led to a citation. |

So:

- **Repeat mode (e.g. 100 runs)**: “Ask this exact question 100 times; how often does GPT cite us?” → **stability / variance** for that query.
- **Variants mode (e.g. 10 similar)**: “From this seed question, generate 10 similar questions and run each once; in how many did GPT cite us?” → **robustness** to how people phrase the query.

## How each run works

1. **Input**: List of prompts (one per line), optional **Main URL**, **Company name**, **Vertical**, and **mode** + either **runsPerPrompt** (1–100) or **variantsPerPrompt** (1–30).
2. **Repeat mode**: For each prompt, the server calls GPT **runsPerPrompt** times (same question). Each call is independent.
3. **Variants mode**: For each prompt, the server first calls GPT to **generate variantsPerPrompt** similar phrasings (one generation call per seed). Then it runs each variant once through the normal GEO flow (answer + citation check).
4. **Citation check**: For each answer we check if it contains the target URL domain or company name.
5. **Output**: One row per **seed** prompt with citation rate %, cited count, runs/variants count, latency, tokens.

## Metrics we quantify

| Metric | Description | Used for |
|--------|-------------|----------|
| **Cited** | Boolean: did the model’s answer mention the URL or company? | GEO visibility score |
| **Citation rate %** | Per prompt: 0% or 100% (GPT single run). Over many runs/prompts: % of prompts where cited. | Benchmark comparison, trend over time |
| **Latency (ms)** | Time from request start to OpenAI response. | Performance, UX |
| **Input tokens** | Prompt tokens (system + user message). | Cost estimation |
| **Output tokens** | Completion tokens. | Cost estimation |
| **Rank** | Order of the prompt in the run (1, 2, 3…). | Table display; can be used for “best performing prompt” later |

## Data to store (for a future persistent bench)

To compare runs over time and build a real “bench,” you can persist:

- **Run**: `runId`, `timestamp`, `mainUrl`, `companyName`, `vertical`, `model`, `totalLatencyMs`, `totalInputTokens`, `totalOutputTokens`.
- **Per-prompt**: `runId`, `prompt`, `cited`, `latencyMs`, `inputTokens`, `outputTokens`, `rank`.

From that you can compute:

- **Citation rate over time** (e.g. weekly % of prompts cited).
- **Average latency and token usage** per run or per prompt.
- **Cost** (using OpenAI pricing per model).

## Environment

- `OPENAI_API_KEY`: Required for `/api/geo/run`. GEO uses **gpt-4o-mini-search-preview**, a GPT model with built-in web search (live internet). Set in `.env.local` or your deployment env.

## Optional next steps

- **Persistence**: Save each run (and per-prompt rows) to a DB or JSON/file for history and trend charts.
- **Identity analysis**: Wire the “Identity” tab to a real GPT call (“What do you know about this URL/company?”) and optionally measure time-to-first-mention.
- **Multiple models later**: If you add other providers, extend the API to run the same prompts against each and compare citation rates and cost.
