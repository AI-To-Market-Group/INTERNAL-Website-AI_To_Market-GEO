"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  SchemaType,
  StructuredDataInput,
  GeneratedSchema,
  StructuredDataGeneratorResponse,
} from "@/types";
import {
  Play,
  Loader2,
  Home,
  Copy,
  Check,
  Code2,
  Braces,
  ShieldCheck,
  Globe,
  FileJson,
  MessageSquareText,
  ShoppingBag,
  List,
  Megaphone,
  ChevronLeft,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_SCHEMA_TYPES: {
  type: SchemaType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    type: "Organization",
    label: "Organization",
    desc: "Core entity (sameAs → Wikipedia for LLM resolution)",
    icon: <Globe className="h-4 w-4" />,
  },
  {
    type: "WebSite",
    label: "WebSite",
    desc: "Site-level + SearchAction for sitelinks",
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    type: "Article",
    label: "Article",
    desc: "Content with datePublished + SpeakableSpecification",
    icon: <FileJson className="h-4 w-4" />,
  },
  {
    type: "FAQPage",
    label: "FAQPage",
    desc: "Highest citation potential — structured Q&A",
    icon: <MessageSquareText className="h-4 w-4" />,
  },
  {
    type: "Product",
    label: "Product",
    desc: "Makes brand 'API-able' for AI agents",
    icon: <ShoppingBag className="h-4 w-4" />,
  },
  {
    type: "BreadcrumbList",
    label: "BreadcrumbList",
    desc: "Site hierarchy for retrieval scoring",
    icon: <List className="h-4 w-4" />,
  },
  {
    type: "SpeakableSpecification",
    label: "Speakable",
    desc: "Tells AI which sections to cite — almost no one uses this",
    icon: <Megaphone className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JsonLdClient() {
  // Form state
  const [companyName, setCompanyName] = useState("AI To Market");
  const [siteUrl, setSiteUrl] = useState("https://www.aitomarketgroup.com");
  const [description, setDescription] = useState("AI To Market is a specialist AI strategy and implementation consultancy helping enterprise and mid-market businesses deploy AI across marketing, sales, and supply chain operations.");
  const [vertical, setVertical] = useState("AI Consulting & Strategy");
  const [foundingYear, setFoundingYear] = useState("2022");
  const [wikipediaUrl, setWikipediaUrl] = useState("");
  const [sameAsUrls, setSameAsUrls] = useState("https://www.linkedin.com/company/aitomarket");
  const [logoUrl, setLogoUrl] = useState("https://www.aitomarketgroup.com/logos/ai-to-market-logo-green.png");
  const [contactEmail, setContactEmail] = useState("manoj@aitomarketgroup.com");
  const [selectedTypes, setSelectedTypes] = useState<Set<SchemaType>>(
    new Set(["Organization", "WebSite", "FAQPage", "Article"])
  );

  // Results
  const [result, setResult] = useState<StructuredDataGeneratorResponse | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // ---------------------------------------------------------------------------
  // Schema type toggles
  // ---------------------------------------------------------------------------
  const toggleType = useCallback((type: SchemaType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!companyName.trim() || !siteUrl.trim() || !description.trim()) {
      toast.error("Company name, URL, and description are required.");
      return;
    }
    if (selectedTypes.size === 0) {
      toast.error("Select at least one schema type.");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const body: StructuredDataInput = {
        companyName: companyName.trim(),
        siteUrl: siteUrl.trim(),
        description: description.trim(),
        schemaTypes: Array.from(selectedTypes),
      };
      if (vertical.trim()) body.vertical = vertical.trim();
      if (foundingYear.trim()) body.foundingYear = parseInt(foundingYear, 10) || undefined;
      if (wikipediaUrl.trim()) body.wikipediaUrl = wikipediaUrl.trim();
      if (sameAsUrls.trim())
        body.sameAsUrls = sameAsUrls
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);
      if (logoUrl.trim()) body.logoUrl = logoUrl.trim();
      if (contactEmail.trim()) body.contactEmail = contactEmail.trim();

      const res = await fetch("/api/structured-data/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `HTTP ${res.status}`);
      }

      const data: StructuredDataGeneratorResponse = await res.json();
      setResult(data);
      toast.success(
        `Generated ${data.schemas.length} schema(s) — GEO score: ${data.geoCoverageScore}/100`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [
    companyName, siteUrl, description, vertical, foundingYear,
    wikipediaUrl, sameAsUrls, logoUrl, contactEmail, selectedTypes,
  ]);

  // ---------------------------------------------------------------------------
  // Copy helpers
  // ---------------------------------------------------------------------------
  const copySchema = useCallback((schema: GeneratedSchema, idx: number) => {
    const block = `<script type="application/ld+json">\n${JSON.stringify(schema.jsonLd, null, 2)}\n</script>`;
    navigator.clipboard.writeText(block);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success(`${schema.type} JSON-LD copied!`);
  }, []);

  const copyAllSchemas = useCallback(() => {
    if (!result) return;
    const combined = result.schemas
      .map(
        (s) =>
          `<script type="application/ld+json">\n${JSON.stringify(s.jsonLd, null, 2)}\n</script>`
      )
      .join("\n\n");
    navigator.clipboard.writeText(combined);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success("All JSON-LD blocks copied!");
  }, [result]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/atelier"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          <Home className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">JSON-LD Structured Data Generator</h1>
          <p className="text-sm text-muted-foreground">
            Generate Schema.org JSON-LD to boost AI engine crawlability and citation rates
          </p>
        </div>
      </div>

      {/* Research insight banner */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="flex items-start gap-3 py-3">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Research insight:</strong> SAGEO Arena (2025) found that structural information
            optimization (including JSON-LD) improves document retrieval by <strong>+22%</strong>,
            while body-text-only changes <em>degrade</em> it by -9%.{" "}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">sameAs</code> links to Wikipedia/Wikidata are
            critical for LLM entity resolution.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* ===== LEFT: Input form ===== */}
        <div className="space-y-4">
          {/* Company basics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Braces className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Core entity data for your JSON-LD schemas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Company Name *
                  </label>
                  <Input
                    placeholder="AI To Market"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Site URL *
                  </label>
                  <Input
                    placeholder="https://www.aitomarketgroup.com"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description * (min 20 chars)
                </label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="AI To Market is a specialist AI strategy and implementation consultancy helping businesses deploy AI across marketing, sales, and supply chain..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Industry Vertical
                  </label>
                  <Input
                    placeholder="Retail Technology"
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Founding Year
                  </label>
                  <Input
                    type="number"
                    placeholder="2018"
                    value={foundingYear}
                    onChange={(e) => setFoundingYear(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Wikipedia / Wikidata URL (critical for LLM entity resolution)
                </label>
                <Input
                  placeholder="https://en.wikipedia.org/wiki/AI_TO_MARKET"
                  value={wikipediaUrl}
                  onChange={(e) => setWikipediaUrl(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  sameAs URLs (LinkedIn, Crunchbase, etc. — comma separated)
                </label>
                <Input
                  placeholder="https://linkedin.com/company/ai-to-market, https://crunchbase.com/organization/ai-to-market"
                  value={sameAsUrls}
                  onChange={(e) => setSameAsUrls(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Logo URL
                  </label>
                  <Input
                    placeholder="https://www.aitomarketgroup.com/logos/ai-to-market-logo-green.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Contact Email
                  </label>
                  <Input
                    type="email"
                    placeholder="manoj@aitomarketgroup.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schema type selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Schema Types to Generate</CardTitle>
              <CardDescription>
                Select which JSON-LD schemas to produce. Research shows all 7 together
                create maximum GEO coverage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_SCHEMA_TYPES.map(({ type, label, desc, icon }) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                      selectedTypes.has(type)
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 shrink-0",
                        selectedTypes.has(type)
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {icon}
                    </div>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generate button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Generate JSON-LD ({selectedTypes.size} schema
                {selectedTypes.size !== 1 ? "s" : ""})
              </>
            )}
          </Button>
        </div>

        {/* ===== RIGHT: Results ===== */}
        <div className="space-y-4">
          {/* GEO Coverage Score */}
          {result && (
            <Card
              className={cn(
                "border-2",
                result.geoCoverageScore >= 70
                  ? "border-green-200 dark:border-green-900"
                  : result.geoCoverageScore >= 40
                    ? "border-amber-200 dark:border-amber-900"
                    : "border-red-200 dark:border-red-900"
              )}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className={cn(
                      "h-8 w-8",
                      result.geoCoverageScore >= 70
                        ? "text-green-600"
                        : result.geoCoverageScore >= 40
                          ? "text-amber-600"
                          : "text-red-600"
                    )}
                  />
                  <div>
                    <div className="text-2xl font-bold">
                      {result.geoCoverageScore}/100
                    </div>
                    <div className="text-sm text-muted-foreground">
                      GEO Coverage Score
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyAllSchemas}
                  disabled={copiedAll}
                >
                  {copiedAll ? (
                    <>
                      <Check className="mr-1 h-3.5 w-3.5" /> Copied All!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy All Schemas
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result && result.recommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Recommendations to Improve GEO Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {result.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Generated schemas */}
          {result?.schemas.map((schema, idx) => (
            <Card key={schema.type}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{schema.type}</CardTitle>
                    <Badge
                      variant={
                        schema.completeness >= 70
                          ? "default"
                          : schema.completeness >= 40
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-xs"
                    >
                      {schema.completeness}% complete
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copySchema(schema, idx)}
                  >
                    {copiedIdx === idx ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{schema.geoImpact}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* JSON-LD code block */}
                <div className="relative">
                  <pre className="max-h-[400px] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">
                    <code>
                      {`<script type="application/ld+json">\n${JSON.stringify(schema.jsonLd, null, 2)}\n</script>`}
                    </code>
                  </pre>
                </div>

                {/* Missing fields */}
                {schema.missingFields.length > 0 && (
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      Missing for full coverage:
                    </div>
                    <ul className="space-y-0.5">
                      {schema.missingFields.map((f, fi) => (
                        <li
                          key={fi}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Empty state */}
          {!result && !loading && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileJson className="mb-4 h-12 w-12 text-muted-foreground/40" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  No schemas generated yet
                </h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground/70">
                  Fill in your company information and click Generate to create
                  research-backed JSON-LD markup optimized for AI engine crawlability.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
