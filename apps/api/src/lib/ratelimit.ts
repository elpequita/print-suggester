import { LRUCache } from 'lru-cache';
import { config } from '../config.js';

type Bucket = { count: number; resetAt: number };

const buckets = new LRUCache<string, Bucket>({
  max: 50_000,
  ttl: 1000 * 60 * 60 * 2,
});

const WINDOW_MS = 1000 * 60 * 60;

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, config.RATE_LIMIT_PER_HOUR - bucket.count);
  return {
    allowed: bucket.count <= config.RATE_LIMIT_PER_HOUR,
    remaining,
    resetAt: bucket.resetAt,
  };
}
