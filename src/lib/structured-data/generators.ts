/**
 * JSON-LD generators for Schema.org types optimized for GEO.
 *
 * Research-backed rationale (from SAGEO Arena & GEO: How to Dominate AI Search):
 * - Schema/JSON-LD is one of the 5 structural fields search-augmented generative
 *   engines rely on — improving retrieval by +22% vs body-text-only.
 * - Generative engines parse <script type="application/ld+json"> for freshness
 *   (datePublished, dateModified) and entity resolution (sameAs → Wikipedia/Wikidata).
 * - SpeakableSpecification tells AI/voice which sections to cite.
 */

import type {
  SchemaType,
  StructuredDataInput,
  GeneratedSchema,
  FaqPair,
  ProductInfo,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Count how many of the listed fields are present (truthy) in the schema. */
function completenessScore(
  schema: Record<string, unknown>,
  importantFields: string[]
): { score: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;
  for (const f of importantFields) {
    const val = schema[f];
    if (val !== undefined && val !== null && val !== "") {
      filled++;
    } else {
      missing.push(f);
    }
  }
  return {
    score: Math.round((filled / importantFields.length) * 100),
    missing,
  };
}

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

function generateOrganization(input: StructuredDataInput): GeneratedSchema {
  const sameAs: string[] = [];
  if (input.wikipediaUrl) sameAs.push(input.wikipediaUrl);
  if (input.sameAsUrls) sameAs.push(...input.sameAsUrls);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${stripTrailingSlash(input.siteUrl)}/#organization`,
    name: input.companyName,
    url: input.siteUrl,
    description: input.description,
  };

  if (input.logoUrl) jsonLd.logo = input.logoUrl;
  if (input.foundingYear)
    jsonLd.foundingDate = String(input.foundingYear);
  if (sameAs.length) jsonLd.sameAs = sameAs;
  if (input.contactEmail) {
    jsonLd.contactPoint = {
      "@type": "ContactPoint",
      email: input.contactEmail,
      contactType: "customer service",
    };
  }
  if (input.vertical) jsonLd.knowsAbout = input.vertical;

  const importantFields = [
    "name",
    "url",
    "description",
    "logo",
    "foundingDate",
    "sameAs",
    "contactPoint",
    "knowsAbout",
  ];
  const { score, missing } = completenessScore(jsonLd, importantFields);

  return {
    type: "Organization",
    jsonLd,
    completeness: score,
    missingFields: missing,
    geoImpact:
      "Foundational schema. sameAs links to Wikipedia/Wikidata are critical for LLM entity resolution — they anchor what AI models 'know' about the company.",
  };
}

// ---------------------------------------------------------------------------
// WebSite (with SearchAction for sitelinks)
// ---------------------------------------------------------------------------

function generateWebSite(input: StructuredDataInput): GeneratedSchema {
  const siteUrl = stripTrailingSlash(input.siteUrl);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: input.companyName,
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const importantFields = ["name", "url", "publisher", "potentialAction"];
  const { score, missing } = completenessScore(jsonLd, importantFields);

  return {
    type: "WebSite",
    jsonLd,
    completeness: score,
    missingFields: missing,
    geoImpact:
      "Site-level schema that connects all pages to the Organization entity. SearchAction enables sitelinks search box in Google and helps AI engines map internal structure.",
  };
}

// ---------------------------------------------------------------------------
// Article / BlogPosting (with Speakable)
// ---------------------------------------------------------------------------

function generateArticle(input: StructuredDataInput): GeneratedSchema {
  const siteUrl = stripTrailingSlash(input.siteUrl);
  const now = new Date().toISOString().split("T")[0];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `[Article Title] — ${input.companyName}`,
    description:
      "[Article meta description — keep under 160 characters for optimal AI snippet extraction]",
    datePublished: now,
    dateModified: now,
    author: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: input.companyName,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: input.companyName,
      ...(input.logoUrl ? { logo: input.logoUrl } : {}),
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/blog/[article-slug]`,
    },
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["article h1", "article h2", ".article-summary", ".key-takeaway"],
    },
  };

  if (input.vertical) jsonLd.articleSection = input.vertical;

  const importantFields = [
    "headline",
    "description",
    "datePublished",
    "dateModified",
    "author",
    "publisher",
    "mainEntityOfPage",
    "speakable",
    "articleSection",
  ];
  const { score, missing } = completenessScore(jsonLd, importantFields);

  return {
    type: "Article",
    jsonLd,
    completeness: score,
    missingFields: missing,
    geoImpact:
      "AI engines parse datePublished/dateModified from JSON-LD for freshness scoring. SpeakableSpecification tells AI which sections to read aloud/cite — high-impact for voice search and GEO.",
  };
}

// ---------------------------------------------------------------------------
// FAQPage
// ---------------------------------------------------------------------------

function generateFAQPage(
  input: StructuredDataInput,
  faqs?: FaqPair[]
): GeneratedSchema {
  const faqItems = faqs?.length
    ? faqs
    : [
        {
          question: `What does ${input.companyName} do?`,
          answer: input.description,
        },
        {
          question: `What industry is ${input.companyName} in?`,
          answer: input.vertical
            ? `${input.companyName} operates in the ${input.vertical} industry.`
            : `${input.companyName} is a technology company.`,
        },
      ];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const faqCount = faqItems.length;
  // Score based on how many FAQs provided (5+ is ideal for GEO)
  const score = Math.min(100, Math.round((faqCount / 5) * 70) + (faqs?.length ? 30 : 0));
  const missing: string[] = [];
  if (faqCount < 3) missing.push("Add at least 3 FAQ pairs for optimal GEO coverage");
  if (faqCount < 5) missing.push("5+ FAQ pairs significantly improves citation probability");
  if (!faqs?.length) missing.push("Custom FAQs (currently using auto-generated defaults)");

  return {
    type: "FAQPage",
    jsonLd,
    completeness: score,
    missingFields: missing,
    geoImpact:
      "FAQPage schema has the highest direct citation potential. LLMs prefer structured Q&A content — it maps directly to user queries. Research shows FAQ pages are cited 2-3x more than unstructured content.",
  };
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

function generateProducts(
  input: StructuredDataInput,
  products?: ProductInfo[]
): GeneratedSchema {
  const siteUrl = stripTrailingSlash(input.siteUrl);
  const items = products?.length
    ? products
    : [
        {
          name: `${input.companyName} Product`,
          description: `A product by ${input.companyName}`,
        },
      ];

  // Generate a graph with all products
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": items.map((p, i) => ({
      "@type": "Product",
      "@id": `${siteUrl}/products/${encodeURIComponent(p.name.toLowerCase().replace(/\s+/g, "-"))}#product`,
      name: p.name,
      description: p.description,
      brand: {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
      },
      ...(p.url ? { url: p.url } : {}),
      ...(i === 0 && input.logoUrl ? { image: input.logoUrl } : {}),
    })),
  };

  const hasCustomProducts = !!products?.length;
  const score = hasCustomProducts ? Math.min(100, 50 + items.length * 10) : 20;
  const missing: string[] = [];
  if (!hasCustomProducts) missing.push("Custom product list (currently using placeholder)");
  if (!items.some((p) => p.url)) missing.push("Product URLs for individual product pages");
  missing.push("offers (pricing/availability) — makes the brand 'API-able' for AI agents");
  missing.push("aggregateRating — review stars improve citation confidence");

  return {
    type: "Product",
    jsonLd,
    completeness: score,
    missingFields: missing,
    geoImpact:
      "Product schema with prices, specs, reviews makes the brand 'API-able' — research shows AI agents delegate to the brand easiest for them to parse. Explicit specs beat marketing prose.",
  };
}

// ---------------------------------------------------------------------------
// BreadcrumbList
// ---------------------------------------------------------------------------

function generateBreadcrumbList(input: StructuredDataInput): GeneratedSchema {
  const siteUrl = stripTrailingSlash(input.siteUrl);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "[Section]",
        item: `${siteUrl}/[section]`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "[Current Page]",
        item: `${siteUrl}/[section]/[page]`,
      },
    ],
  };

  return {
    type: "BreadcrumbList",
    jsonLd,
    completeness: 60,
    missingFields: [
      "Actual page hierarchy (using template placeholders)",
      "Generate per-page breadcrumbs for each URL in sitemap",
    ],
    geoImpact:
      "Helps generative search engines understand site hierarchy and navigate between content. Part of the structural information that boosts retrieval scores by +22%.",
  };
}

// ---------------------------------------------------------------------------
// SpeakableSpecification (standalone)
// ---------------------------------------------------------------------------

function generateSpeakable(input: StructuredDataInput): GeneratedSchema {
  const siteUrl = stripTrailingSlash(input.siteUrl);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${siteUrl}/#webpage`,
    name: `${input.companyName} — [Page Title]`,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [
        "article h1",
        "article h2",
        ".article-summary",
        ".key-takeaway",
        ".faq-answer",
        "[data-speakable]",
      ],
    },
    mainEntity: {
      "@id": `${siteUrl}/#organization`,
    },
  };

  return {
    type: "SpeakableSpecification",
    jsonLd,
    completeness: 70,
    missingFields: [
      "Actual CSS selectors matching your site's DOM structure",
      "Consider adding xpath selectors for deeper targeting",
    ],
    geoImpact:
      "Directly tells AI and voice assistants which content sections to read aloud/cite. This is the most underutilized schema for GEO — almost no sites implement it, creating a competitive moat.",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateJsonLdSchemas(
  input: StructuredDataInput
): GeneratedSchema[] {
  const generators: Record<
    SchemaType,
    (input: StructuredDataInput) => GeneratedSchema
  > = {
    Organization: generateOrganization,
    WebSite: generateWebSite,
    Article: generateArticle,
    FAQPage: (inp) => generateFAQPage(inp, inp.faqs),
    Product: (inp) => generateProducts(inp, inp.products),
    BreadcrumbList: generateBreadcrumbList,
    SpeakableSpecification: generateSpeakable,
  };

  return input.schemaTypes.map((type) => generators[type](input));
}

/** Compute the overall GEO coverage score and recommendations. */
export function computeGeoCoverage(schemas: GeneratedSchema[]): {
  score: number;
  recommendations: string[];
} {
  if (!schemas.length) return { score: 0, recommendations: ["Generate at least one schema type."] };

  // Weighted importance per schema type for GEO
  const weights: Record<SchemaType, number> = {
    Organization: 25,
    WebSite: 10,
    Article: 20,
    FAQPage: 20,
    Product: 10,
    BreadcrumbList: 5,
    SpeakableSpecification: 10,
  };

  const allTypes: SchemaType[] = [
    "Organization",
    "WebSite",
    "Article",
    "FAQPage",
    "Product",
    "BreadcrumbList",
    "SpeakableSpecification",
  ];

  let totalWeight = 0;
  let achievedWeight = 0;

  for (const type of allTypes) {
    const w = weights[type];
    totalWeight += w;
    const schema = schemas.find((s) => s.type === type);
    if (schema) {
      achievedWeight += w * (schema.completeness / 100);
    }
  }

  const score = Math.round((achievedWeight / totalWeight) * 100);

  const recommendations: string[] = [];
  const generated = new Set(schemas.map((s) => s.type));

  if (!generated.has("Organization"))
    recommendations.push(
      "Add Organization schema — foundational for LLM entity resolution. Include sameAs links to Wikipedia/Wikidata."
    );
  if (!generated.has("FAQPage"))
    recommendations.push(
      "Add FAQPage schema — highest direct citation potential. LLMs cite structured Q&A 2-3x more than prose."
    );
  if (!generated.has("Article"))
    recommendations.push(
      "Add Article schema with datePublished — AI engines parse JSON-LD for freshness scoring before body text."
    );
  if (!generated.has("SpeakableSpecification"))
    recommendations.push(
      "Add SpeakableSpecification — tells AI exactly which content to cite. Almost no competitors use this."
    );

  // Check for Wikipedia/sameAs
  const orgSchema = schemas.find((s) => s.type === "Organization");
  if (orgSchema) {
    const sameAs = orgSchema.jsonLd.sameAs;
    if (!sameAs || (Array.isArray(sameAs) && sameAs.length === 0)) {
      recommendations.push(
        "Add sameAs links (Wikipedia, Wikidata, LinkedIn, Crunchbase) to Organization schema — critical for LLM entity resolution."
      );
    }
  }

  // Top-priority missing fields across all schemas
  for (const s of schemas) {
    if (s.missingFields.length > 0 && s.completeness < 60) {
      recommendations.push(
        `${s.type}: ${s.missingFields[0]}`
      );
    }
  }

  return { score, recommendations: recommendations.slice(0, 6) };
}
