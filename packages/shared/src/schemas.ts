import { z } from 'zod';

export const accessoryCategorySchema = z.object({
  label: z.string().min(1).max(80),
  search_terms: z.array(z.string().min(1).max(80)).min(1).max(5),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(240).optional(),
});

export const visionResultSchema = z.object({
  object: z.string().min(1).max(80),
  attributes: z.array(z.string().max(80)).max(10),
  accessory_categories: z.array(accessoryCategorySchema).min(1).max(6),
});

export const printResultSchema = z.object({
  source: z.enum(['printables', 'makerworld']),
  category: z.string(),
  title: z.string(),
  url: z.string().url(),
  thumbnail: z.string().url().optional(),
  likes: z.number().int().nonnegative().optional(),
  downloads: z.number().int().nonnegative().optional(),
  score: z.number(),
});

export const searchRequestSchema = z
  .object({
    image_base64: z.string().optional(),
    image_url: z.string().url().optional(),
  })
  .refine((d) => Boolean(d.image_base64 || d.image_url), {
    message: 'Provide image_base64 or image_url',
  });

export const searchResponseSchema = z.object({
  search_id: z.string(),
  cached: z.boolean(),
  vision: visionResultSchema,
  results: z.array(printResultSchema),
});

export type AccessoryCategory = z.infer<typeof accessoryCategorySchema>;
export type VisionResult = z.infer<typeof visionResultSchema>;
export type PrintResult = z.infer<typeof printResultSchema>;
export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
