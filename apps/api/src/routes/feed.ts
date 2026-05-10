import { Hono } from 'hono';
import { LRUCache } from 'lru-cache';
import { searchPrintables } from '../sources/printables.js';
import { makerworldDeepLinkResult, makerworldSearchUrl } from '../sources/makerworld.js';
import type { PrintResult } from '../schemas.js';
import { logger } from '../logger.js';

const DEFAULT_CATEGORIES = [
  'phone stand',
  'cable management',
  'headphone hook',
  'desk organizer',
  'gopro mount',
  'wall mount',
  'pen holder',
  'keychain',
  'plant pot',
  'tool holder',
  'monitor stand',
  'tablet stand',
];

const feedCache = new LRUCache<string, FeedSection[]>({
  max: 500,
  ttl: 1000 * 60 * 30,
});

type FeedSection = {
  category: string;
  source: 'trending' | 'for-you';
  items: PrintResult[];
  more_url: string;
};

export const feedRoute = new Hono();

feedRoute.get('/', async (c) => {
  const userCategories = (c.req.query('categories') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const cacheKey = userCategories.length ? `for-you:${userCategories.join('|')}` : 'trending';
  const cached = feedCache.get(cacheKey);
  if (cached) {
    return c.json({ sections: cached, cached: true });
  }

  const targets =
    userCategories.length > 0
      ? userCategories.map((c) => ({ label: c, source: 'for-you' as const }))
      : DEFAULT_CATEGORIES.map((c) => ({ label: c, source: 'trending' as const }));

  const sections = await Promise.all(
    targets.map(async (t): Promise<FeedSection> => {
      const printables = await searchPrintables(t.label, 4);
      const items: PrintResult[] = printables.map((r) => ({ ...r, category: t.label }));
      items.push(makerworldDeepLinkResult(t.label, t.label));
      return {
        category: t.label,
        source: t.source,
        items,
        more_url: makerworldSearchUrl(t.label),
      };
    }),
  );

  feedCache.set(cacheKey, sections);
  logger.info('feed.served', {
    cacheKey,
    sections: sections.length,
    personalized: userCategories.length > 0,
  });
  return c.json({ sections, cached: false });
});
