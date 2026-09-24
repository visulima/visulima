/**
 * Only let a same-origin absolute path reach an `href`.
 *
 * An asset filename is attacker-influenced in the general case, and a value
 * like `javascript:alert(1)` or `data:text/html,...` in an anchor would run on
 * click. Rejecting a colon is not enough on its own:
 *
 * - `//evil.com` has no colon but is read as protocol-relative
 * - `/\evil.com` has no colon either, and the URL parser folds `\` to `/`
 * - `/&lt;tab>/evil.com` likewise, because tab, CR and LF are stripped before parsing
 *
 * So the test is positive rather than negative: resolve against the current
 * origin and require the result to stay on it.
 */
export const safePublicPath = (path: string): string => {
    if (!path.startsWith("/")) {
        return "#";
    }

    try {
        const resolved = new URL(path, globalThis.location.origin);

        return resolved.origin === globalThis.location.origin ? path : "#";
    } catch {
        return "#";
    }
};
