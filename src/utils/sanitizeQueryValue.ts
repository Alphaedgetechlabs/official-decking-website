/**
 * Strict sanitization for URL query values before they enter form state.
 * Decode-then-encode keeps the transform idempotent across URL ↔ state round-trips.
 */
export function sanitizeQueryValue(value: string): string {
  const decoded = value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  return decoded
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (import.meta.env.DEV) {
  const once = sanitizeQueryValue(`<script>&"'`);
  const twice = sanitizeQueryValue(once);
  console.assert(
    once === '&lt;script&gt;&amp;&quot;&#39;' && twice === once,
    'sanitizeQueryValue must escape XSS chars and be idempotent',
  );
}
