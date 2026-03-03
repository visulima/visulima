const escapeRegExp = (s: string): string => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

/**
 * Convert a glob pattern string to a RegExp.
 * Supports `*` (single path segment wildcard) and `**` (multi-segment wildcard).
 */
const globToRegex = (glob: string): RegExp => {
    const pattern = glob
        .split("**")
        .map((segment) => segment.split("*").map(escapeRegExp).join("[^/]*"))
        .join(".*");

    return new RegExp(pattern);
};

/**
 * Returns true if `value` matches any of the given patterns.
 * Strings are treated as glob patterns; RegExps are tested directly.
 */
export const matcher = (patterns: Array<RegExp | string>, value: string): boolean =>
    patterns.some((p) => (p instanceof RegExp ? p.test(value) : globToRegex(p).test(value)));
