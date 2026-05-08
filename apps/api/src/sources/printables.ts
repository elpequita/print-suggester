import { LRUCache } from 'lru-cache';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { PrintResult } from '@print-suggester/shared';

// Printables exposes a GraphQL endpoint at /graphql/ but does not publish a public
// schema. The exact operations are reverse-engineered from web client traffic and
// change over time. This module wraps the call defensively: if the request shape
// breaks, the rest of the pipeline (vision + MakerWorld deep links) still works.
//
// To enable real results, capture a "search prints" GraphQL operation from
// printables.com devtools and replace SEARCH_QUERY + the response mapping below.

const SEARCH_QUERY = `
  query SearchModels($query: String!, $limit: Int) {
    searchPrints(query: $query, limit: $limit) {
      items {
        id
        slug
        name
        likesCount
        downloadCount
        image { filePath }
      }
    }
  }
`;

interface RawItem {
  id?: string | number;
  slug?: string;
  name?: string;
  likesCount?: number;
  downloadCount?: number;
  image?: { filePath?: string } | null;
}

const cache = new LRUCache<string, PrintResult[]>({
  max: 5000,
  ttl: 1000 * 60 * 60 * 6,
});

export async function searchPrintables(query: string, limit = 8): Promise<PrintResult[]> {
  const key = `${query}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch(config.PRINTABLES_GRAPHQL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'PrintSuggester/0.1 (+https://example.com)',
      },
      body: JSON.stringify({ query: SEARCH_QUERY, variables: { query, limit } }),
    });
    if (!res.ok) {
      logger.warn('printables.http', { status: res.status, query });
      return [];
    }
    const json = (await res.json()) as { data?: { searchPrints?: { items?: RawItem[] } } };
    const items = json.data?.searchPrints?.items ?? [];

    const results: PrintResult[] = items
      .filter((it): it is RawItem & { id: string | number; name: string } =>
        Boolean(it.id) && Boolean(it.name),
      )
      .map((it) => ({
        source: 'printables' as const,
        category: query,
        title: it.name,
        url: `https://www.printables.com/model/${it.id}-${it.slug ?? ''}`,
        thumbnail: it.image?.filePath
          ? `https://media.printables.com/${it.image.filePath}`
          : undefined,
        likes: it.likesCount ?? 0,
        downloads: it.downloadCount ?? 0,
        score: 0,
      }));

    cache.set(key, results);
    return results;
  } catch (err) {
    logger.warn('printables.search.failed', { query, err: String(err) });
    return [];
  }
}
