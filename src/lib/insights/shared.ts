/* ------------------------------------------------------------------ */
/*  Types & constants shared between client & server                   */
/*  NO Node.js imports (fs, path) here — safe for "use client"        */
/* ------------------------------------------------------------------ */

export type InsightCategory = "blog" | "linkedin" | "reddit" | "wikipedia";

export type InsightType = "Article" | "Blog" | "Sustainability" | "Client success";

export type InsightProduct =
  | "Captana"
  | "Engage"
  | "Memory"
  | "PDi Digital"
  | "SESimagotag"
  | "AI To Market Cloud";

export type InsightSolution =
  | "Store Operational Excellence"
  | "Data-Driven Commerce"
  | "Local eCommerce"
  | "Retail Media & Shopper Experiences";

export type InsightIndustry =
  | "DIY & furniture"
  | "Cosmetics"
  | "Electronics"
  | "Grocery"
  | "Hypermarket"
  | "Fashion"
  | "Pharmacy";

/** CMS / WordPress-style metadata for blogs (Webflow, WordPress, etc.). */
export interface InsightCmsMetadata {
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  focus_keyword?: string;
  seo_title?: string;
  seo_description?: string;
}

export interface InsightFrontmatter {
  slug: string;
  title: string;
  category: InsightCategory;
  type: InsightType;
  dateISO: string;
  readTimeMin?: number;
  excerpt?: string;
  product?: InsightProduct;
  solution?: InsightSolution;
  industry?: InsightIndustry;
  sourceUrl?: string;
  heroImage?: string;
  parentSlug?: string;
  /** CMS metadata for blogs (Webflow / WordPress). */
  cmsMetadata?: InsightCmsMetadata;
}

export interface InsightDoc extends InsightFrontmatter {
  markdown: string;
}

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  blog: "Blog",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  wikipedia: "Wikipedia",
};
