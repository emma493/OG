/**
 * Photo-URL extraction for bulk paste — adapted from Admin videoUtils.
 * Accepts comma / newline / space separated URLs, strips quotes/brackets,
 * normalises protocol, dedupes. Photo extensions preferred but any
 * http(s) URL is accepted (bake step validates loadability).
 */

const PHOTO_EXT_RE = /\.(jpe?g|png|webp|gif|bmp|avif)(\?.*)?$/i;

export function extractLinksFromString(input: string): string[] {
  if (!input || typeof input !== 'string') return [];
  const rawTokens = input.match(/("[^"]+"|'[^']+'|<[^>]+>|[^\s,;\n\r"<>]+)/g) || [];
  const extracted: string[] = [];
  for (let token of rawTokens) {
    token = token.trim().replace(/^["'<(\[{]+|["'>)\],;]+$/g, '').trim();
    if (!token) continue;
    if (
      token.startsWith('http://') ||
      token.startsWith('https://') ||
      token.startsWith('//') ||
      token.match(/^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?::\d+)?(?:\/.*)?$/) ||
      PHOTO_EXT_RE.test(token)
    ) {
      let normalized = token;
      if (normalized.startsWith('//')) {
        normalized = 'https:' + normalized;
      } else if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        normalized = 'https://' + normalized;
      }
      try {
        new URL(normalized);
        if (!extracted.includes(normalized)) extracted.push(normalized);
      } catch {
        // ignore invalid
      }
    }
  }
  return extracted;
}

export const DURATION_RE = /^\d{1,3}:\d{2}$/;
