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
 *
 * Note: string patterns are compiled to a RegExp on every call. For hot paths
 * that match the same pattern list many times (e.g. one JSX element per call),
 * precompile the patterns once with {@link compileMatcher} and reuse the result.
 */
const matcher = (patterns: (RegExp | string)[], value: string): boolean =>
    patterns.some((p) => {
        if (p instanceof RegExp) {
            return p.test(value);
        }

        return globToRegex(p).test(value);
    });

/**
 * Precompile a list of glob/RegExp patterns into a single predicate so the glob
 * patterns are converted to RegExps exactly once. Reuse the returned function
 * across many values (e.g. every JSX opening element in a file) to avoid
 * recompiling the same globs on every invocation.
 */
export const compileMatcher = (patterns: (RegExp | string)[]): ((value: string) => boolean) => {
    const compiled = patterns.map((p) => (p instanceof RegExp ? p : globToRegex(p)));

    return (value: string): boolean => compiled.some((re) => re.test(value));
};

export { globToRegex };
export default matcher;
