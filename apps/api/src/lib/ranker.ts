import type { PrintResult, VisionResult } from '@print-suggester/shared';

export function rankResults(
  vision: VisionResult,
  byCategory: Map<string, PrintResult[]>,
): PrintResult[] {
  const out: PrintResult[] = [];
  const seen = new Set<string>();

  for (const cat of vision.accessory_categories) {
    const items = byCategory.get(cat.label) ?? [];
    for (const r of items) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      const popularity = (r.likes ?? 0) + (r.downloads ?? 0) * 0.1;
      // MakerWorld deep-links have no popularity signal; score them by category confidence only.
      const popularityScore = r.source === 'makerworld' ? 0.5 : Math.log1p(popularity);
      out.push({ ...r, score: popularityScore * cat.confidence });
    }
  }

  return out.sort((a, b) => b.score - a.score);
}
