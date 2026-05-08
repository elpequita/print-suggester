import { createHash } from 'node:crypto';

// TODO: replace with a real perceptual hash (e.g. blockhash or DCT pHash) so that
// near-identical photos hit the same cache entry. For now we cache by exact image
// bytes, which still saves vision cost on retries from the same client.
export async function computePHash(image: Buffer): Promise<string> {
  return createHash('sha256').update(image).digest('hex').slice(0, 16);
}
