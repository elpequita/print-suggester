import { LRUCache } from 'lru-cache';
import type { VisionResult } from '@print-suggester/shared';

export const visionCache = new LRUCache<string, VisionResult>({
  max: 5000,
  ttl: 1000 * 60 * 60 * 24 * 30,
});
