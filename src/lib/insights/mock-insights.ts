import type { InsightIndustry, InsightType } from "./shared";

export type { InsightType, InsightIndustry };

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

export type InsightBlock =
  | { type: "lede"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | {
      type: "image";
      alt: string;
      caption?: string;
    };

export interface InsightArticle {
  slug: string;
  title: string;
  type: InsightType;
  dateISO: string;
  readTimeMin?: number;
  excerpt: string;
  product?: InsightProduct;
  solution?: InsightSolution;
  industry?: InsightIndustry;
  sourceUrl: string;
  blocks: InsightBlock[];
}
