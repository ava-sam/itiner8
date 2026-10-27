/**
 * Returns `next` only if it is a same-site relative path, otherwise `fallback`.
 *
 * Rejects protocol-relative URLs (`//evil.com`), backslash variants that
 * browsers normalize to slashes (`/\evil.com`), anything with control
 * characters (tabs/newlines are stripped by URL parsers, so `/\t/evil.com`
 * becomes `//evil.com`), and absolute URLs.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;

  // Final check: resolving it against our own origin must stay on that origin.
  try {
    const base = "http://internal.invalid";
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
