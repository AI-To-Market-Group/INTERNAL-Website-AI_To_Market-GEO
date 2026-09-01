import type { NextRequest } from "next/server";
import type { IdentityAnalysisResult, IdentityMentionPosition, IdentityQueryResult, IdentitySentiment } from "@/types";
import { parseBody, ok, err } from "@/lib/api-response";
import { identityAnalyzeSchema } from "@/lib/api-schemas";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchWithRetry } from "@/lib/fetch-with-retry";
import { logError } from "@/lib/logger";

const MODEL = "gpt-5.4-nano";
const SNIPPET_LEN = 300;

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isMentioned(response: string, url: string, companyName?: string): boolean {
  const text = response.toLowerCase();
  const domain = normalizeDomain(url);
  if (text.includes(domain)) return true;
  if (text.includes(url.toLowerCase())) return true;
  if (companyName?.trim() && text.includes(companyName.toLowerCase().trim())) return true;
  return false;
}

function getPositionInResponse(response: string, url: string, companyName?: string): IdentityMentionPosition | undefined {
  const text = response.trim();
  const lower = text.toLowerCase();
  const domain = normalizeDomain(url);
  const searchTerms = [domain, url.toLowerCase()];
  if (companyName?.trim()) searchTerms.push(companyName.toLowerCase().trim());
  let firstIndex = -1;
  for (const term of searchTerms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (firstIndex === -1 || i < firstIndex)) firstIndex = i;
  }
  if (firstIndex === -1) return undefined;
  const third = text.length / 3;
  if (firstIndex < third) return text.length < third * 2 ? "only" : "first";
  if (firstIndex < third * 2) return "middle";
  return "last";
}

function buildQueries(url: string, companyName?: string): { query: string; queryType: string }[] {
  const domain = normalizeDomain(url);
  const name = companyName?.trim() || domain;
  return [
    { query: `What can you tell me about the website ${url} or the company behind it?`, queryType: "Direct URL" },
    { query: `Have you heard of ${name}? What do they do?`, queryType: "Brand name" },
    { query: `What is ${domain} known for?`, queryType: "Domain" },
    { query: `Which companies or tools are leading in the same space as ${name}?`, queryType: "Category" },
    { query: `Who should I look at for solutions related to what ${name} offers?`, queryType: "Problem / consideration" },
  ];
}

async function callOpenAI(prompt: string, system: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function getSentiment(snippet: string): Promise<IdentitySentiment> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "neutral";
  const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You classify sentiment. Reply with exactly one word: positive, neutral, or negative.",
        },
        { role: "user", content: `Classify the sentiment of this description of a company:\n\n${snippet.slice(0, 500)}` },
      ],
    }),
  });
  if (!res.ok) return "neutral";
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const word = (data.choices?.[0]?.message?.content ?? "neutral").toLowerCase();
  if (word.includes("positive")) return "positive";
  if (word.includes("negative")) return "negative";
  return "neutral";
}

function attributeCoverage(combinedText: string, keyMessages: string[]): number {
  if (keyMessages.length === 0) return 0;
  const lower = combinedText.toLowerCase();
  let match = 0;
  for (const msg of keyMessages) {
    const normalized = msg.trim().toLowerCase();
    if (normalized.length > 0 && lower.includes(normalized)) match++;
  }
  return Math.round((match / keyMessages.length) * 100);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rate = await checkRateLimit(ip, "identity/analyze", RATE_LIMITS["identity/analyze"]);
    if (!rate.ok) {
      return err("Rate limit exceeded. Try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const parsed = await parseBody(req, identityAnalyzeSchema);
    if (parsed.error) return parsed.error;

    const { url, companyName: companyNameRaw, keyMessages: keyMessagesRaw } = parsed.data;
    const companyName = companyNameRaw?.trim();
    const keyMessages = Array.isArray(keyMessagesRaw)
      ? keyMessagesRaw.filter((m) => typeof m === "string" && m.trim())
      : [];

    const system = "You are a helpful assistant. Answer concisely based on your knowledge. If you don't know, say so briefly.";
    const queries = buildQueries(url, companyName);
    const queryResults: IdentityQueryResult[] = [];
    let firstMentionIndex: number | null = null;
    const combinedParts: string[] = [];
    const positions: IdentityMentionPosition[] = [];

    for (let i = 0; i < queries.length; i++) {
      const { query, queryType } = queries[i];
      const content = await callOpenAI(query, system);
      const mentioned = isMentioned(content, url, companyName);
      const position = getPositionInResponse(content, url, companyName);
      const snippet = content.slice(0, SNIPPET_LEN) + (content.length > SNIPPET_LEN ? "…" : "");
      if (mentioned && firstMentionIndex === null) firstMentionIndex = i + 1;
      if (mentioned && position) positions.push(position);
      combinedParts.push(content);
      queryResults.push({
        query,
        queryType,
        snippet,
        fullResponse: content,
        mentioned,
        positionInResponse: position,
      });
    }

    const combinedText = combinedParts.join("\n");
    const summary = combinedParts[0] || "No response.";
    const mentionRatePercent = queries.length > 0 ? Math.round((queryResults.filter((r) => r.mentioned).length / queries.length) * 100) : 0;
    const attributeCoveragePercent = attributeCoverage(combinedText, keyMessages);
    const firstMentionSnippet = queryResults.find((r) => r.mentioned)?.snippet ?? summary.slice(0, 400);
    const sentiment = await getSentiment(firstMentionSnippet);
    const prominence: IdentityMentionPosition = positions.length > 0 ? positions[0] : "middle";
    const queryTypesWithMention = new Set(queryResults.filter((r) => r.mentioned).map((r) => r.queryType));
    const queryTypeCoverageCount = queryTypesWithMention.size;
    const queryTypeCoverageTotal = queries.length;

    const result: IdentityAnalysisResult = {
      summary,
      timeToFindQueryIndex: firstMentionIndex,
      mentionRatePercent,
      attributeCoveragePercent,
      sentiment,
      prominence,
      queryResults,
      queryTypeCoverageCount,
      queryTypeCoverageTotal,
    };

    return ok(result);
  } catch (e) {
    logError("/api/identity/analyze", e);
    const message = e instanceof Error ? e.message : "Identity analysis failed.";
    return err(message, 500);
  }
}
