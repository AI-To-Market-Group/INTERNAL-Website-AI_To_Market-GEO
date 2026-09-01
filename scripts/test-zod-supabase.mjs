#!/usr/bin/env node
/**
 * Quick verification script for Zod and Supabase.
 * Run with: node scripts/test-zod-supabase.mjs
 * Prerequisites: Dev server running on http://localhost:3001
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3001";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function run() {
  console.log("Testing Zod + Supabase at", BASE, "\n");

  // 1. Health
  const health = await fetchJson(`${BASE}/api/health`);
  if (health.status !== 200 || !health.data?.ok) {
    console.log("❌ Health check failed:", health);
    return;
  }
  console.log("✅ Health OK");
  const dbStatus = health.data.db ?? "unknown";
  if (dbStatus === "connected") {
    console.log("   DB: connected (PostgreSQL/Supabase OK)\n");
  } else if (dbStatus === "unconfigured") {
    console.log("   DB: unconfigured (POSTGRES_URL not set - using in-memory)\n");
  } else {
    console.log("   DB:", dbStatus, "\n");
  }

  // 2. Zod: valid builder session
  const validSession = await fetchJson(`${BASE}/api/builder-sessions`, {
    method: "POST",
    body: JSON.stringify({ topic_title: "Zod+Supabase test article" }),
  });
  if (validSession.status === 200 && validSession.data?.opportunityId) {
    console.log("✅ Zod valid: builder-sessions accepts valid body");
  } else {
    console.log("❌ Zod valid: unexpected response", validSession);
  }

  // 3. Zod: invalid builder session (missing topic_title)
  const invalidSession = await fetchJson(`${BASE}/api/builder-sessions`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (invalidSession.status === 400 && invalidSession.data?.error) {
    console.log("✅ Zod invalid: builder-sessions rejects empty body with 400");
    console.log("   Error:", invalidSession.data.error);
  } else {
    console.log("❌ Zod invalid: expected 400, got", invalidSession.status, invalidSession.data);
  }

  // 4. Zod: invalid GEO run (missing prompts)
  const invalidGeo = await fetchJson(`${BASE}/api/geo/run`, {
    method: "POST",
    body: JSON.stringify({ mode: "repeat" }), // prompts required, so this fails
  });
  if (invalidGeo.status === 400 && invalidGeo.data?.error) {
    console.log("✅ Zod invalid: geo/run rejects invalid body with 400");
  } else {
    console.log(invalidGeo.status === 400 ? "✅" : "⚠️", "Zod geo/run:", invalidGeo.status, invalidGeo.data?.error ?? "");
  }

  console.log("\nDone. See docs/TESTING-ZOD-SUPABASE.md for full manual tests.");
}

run().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
