import type { PrintResult } from '../schemas.js';

export function makerworldSearchUrl(query: string): string {
  const params = new URLSearchParams({ keyword: query });
  return `https://makerworld.com/en/search/models?${params.toString()}`;
}

export function makerworldDeepLinkResult(category: string, query: string): PrintResult {
  return {
    source: 'makerworld',
    category,
    title: `Search MakerWorld for "${query}"`,
    url: makerworldSearchUrl(query),
    score: 0,
  };
}
