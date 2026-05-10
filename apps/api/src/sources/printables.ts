import { LRUCache } from 'lru-cache';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { PrintResult } from '../schemas.js';

// Printables' GraphQL endpoint at api.printables.com/graphql/ is undocumented but
// supports introspection. The real search operation is `searchPrints2`. We sort by
// popularity by default (`POPULAR`) since this drives a "discover" feed.

const SEARCH_QUERY = `
  query SearchPrints($query: String!, $limit: Int, $ordering: SearchChoicesEnum) {
    searchPrints2(query: $query, limit: $limit, ordering: $ordering) {
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
        'user-agent': 'PrintSuggester/0.1',
      },
      body: JSON.stringify({
        query: SEARCH_QUERY,
        variables: { query, limit, ordering: 'popular' },
      }),
    });
    if (!res.ok) {
      logger.warn('printables.http', { status: res.status, query });
      return [];
    }
    const json = (await res.json()) as {
      data?: { searchPrints2?: { items?: RawItem[] } };
      errors?: unknown;
    };
    if (json.errors) {
      logger.warn('printables.graphql.errors', { query, errors: json.errors });
      return [];
    }
    const items = json.data?.searchPrints2?.items ?? [];

    const results: PrintResult[] = items
      .filter((it): it is RawItem & { id: string | number; name: string } =>
        Boolean(it.id) && Boolean(it.name),
      )
      .map((it) => ({
        source: 'printables' as const,
        category: query,
        title: it.name,
        url: it.slug
          ? `https://www.printables.com/model/${it.id}-${it.slug}`
          : `https://www.printables.com/model/${it.id}`,
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
