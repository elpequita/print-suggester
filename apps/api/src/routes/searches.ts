import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  searchRequestSchema,
  type PrintResult,
  type SearchResponse,
} from '@print-suggester/shared';
import { computePHash } from '../lib/phash.js';
import { visionCache } from '../lib/cache.js';
import { analyzeImage, type SupportedMediaType } from '../lib/vision.js';
import { searchPrintables } from '../sources/printables.js';
import { makerworldDeepLinkResult } from '../sources/makerworld.js';
import { rankResults } from '../lib/ranker.js';
import { checkRateLimit } from '../lib/ratelimit.js';
import { logger } from '../logger.js';

export const searchesRoute = new Hono();

searchesRoute.post('/', async (c) => {
  const clientKey =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    'anonymous';
  const limit = checkRateLimit(clientKey);
  c.header('x-ratelimit-remaining', String(limit.remaining));
  c.header('x-ratelimit-reset', String(limit.resetAt));
  if (!limit.allowed) {
    return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = searchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const image = parsed.data.image_base64
    ? Buffer.from(parsed.data.image_base64, 'base64')
    : await fetchImage(parsed.data.image_url!);

  if (image.byteLength === 0) {
    return c.json({ error: 'empty image' }, 400);
  }

  const mediaType = sniffMediaType(image);
  const phash = await computePHash(image);

  let vision = visionCache.get(phash);
  const cached = vision !== undefined;
  if (!vision) {
    vision = await analyzeImage(image, mediaType);
    visionCache.set(phash, vision);
  }

  const byCategory = new Map<string, PrintResult[]>();
  await Promise.all(
    vision.accessory_categories.map(async (cat) => {
      const lists = await Promise.all(cat.search_terms.map((t) => searchPrintables(t)));
      const merged: PrintResult[] = lists.flat().map((r) => ({ ...r, category: cat.label }));
      const primaryTerm = cat.search_terms[0] ?? cat.label;
      merged.push(makerworldDeepLinkResult(cat.label, primaryTerm));
      byCategory.set(cat.label, merged);
    }),
  );

  const results = rankResults(vision, byCategory);
  const response: SearchResponse = {
    search_id: randomUUID(),
    cached,
    vision,
    results,
  };

  logger.info('search.completed', {
    phash,
    cached,
    categories: vision.accessory_categories.length,
    results: results.length,
  });
  return c.json(response);
});

async function fetchImage(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function sniffMediaType(buf: Buffer): SupportedMediaType {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF') return 'image/webp';
  return 'image/jpeg';
}
