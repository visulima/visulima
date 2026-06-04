const ESCAPE_REGEXP_CHARS = /[.+^${}()|[\]\\]/g;

const escapeRegExp = (s: string): string => s.replaceAll(ESCAPE_REGEXP_CHARS, String.raw`\$&`);

/**
 * Convert a glob pattern string to a RegExp.
 * Supports `*` (single path segment wildcard) and `**` (multi-segment wildcard).
 */
const globToRegex = (glob: string): RegExp => {
    const pattern = glob
        .split("**")
        .map((segment) =>
            segment
                .split("*")
                .map((s) => escapeRegExp(s))
                .join("[^/]*"),
        )
        .join(".*");

    return new RegExp(`^${pattern}$`);
};

/**
 * Returns true if `value` matches any of the given patterns.
 * Strings are treated as glob patterns; RegExps are tested directly.
 */
const matcher = (patterns: (RegExp | string)[], value: string): boolean =>
    patterns.some((p) => {
        if (p instanceof RegExp) {
            return p.test(value);
        }

        return globToRegex(p).test(value);
    });

export default matcher;
