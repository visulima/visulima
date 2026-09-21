/**
 * Only let a same-origin absolute path reach an `href`.
 *
 * An asset filename is attacker-influenced in the general case, and a value
 * like `javascript:alert(1)` or `data:text/html,...` in an anchor would run on
 * click. A `//host/path` is rejected too: it has no scheme separator, but a
 * browser reads it as protocol-relative and navigates off-origin.
 *
 * Anything that is not a single-slash-rooted path with no `:` becomes `#`.
 */
export const safePublicPath = (path: string): string => (path.startsWith("/") && !path.startsWith("//") && !path.includes(":") ? path : "#");
