import { z } from "zod";

const SCHEMA_TYPES = [
  "Organization",
  "WebSite",
  "Article",
  "FAQPage",
  "Product",
  "BreadcrumbList",
  "SpeakableSpecification",
] as const;

export const faqPairSchema = z.object({
  question: z.string().min(5),
  answer: z.string().min(10),
});

export const productInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(5),
  url: z.string().url().optional(),
});

export const structuredDataInputSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  siteUrl: z.string().url("Must be a valid URL"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  vertical: z.string().optional(),
  foundingYear: z.number().int().min(1800).max(2100).optional(),
  wikipediaUrl: z.string().url().optional(),
  sameAsUrls: z.array(z.string().url()).max(10).optional(),
  logoUrl: z.string().url().optional(),
  contactEmail: z.string().email().optional(),
  products: z.array(productInfoSchema).max(20).optional(),
  faqs: z.array(faqPairSchema).max(20).optional(),
  schemaTypes: z
    .array(z.enum(SCHEMA_TYPES))
    .min(1, "Select at least one schema type"),
});

export type StructuredDataInputSchema = z.infer<
  typeof structuredDataInputSchema
>;
