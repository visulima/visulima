import { Buffer } from "node:buffer";

// Kingfisher filters we support in validator templates. Anything else → the
// render fails → caller treats it as "skip this rule" rather than sending a
// malformed request. Keep this list tight; broader template needs (like
// `crc32` / `base62`) belong in `checksum.ts` because they're detection-time
// filters with their own input grammar.
const FILTERS: Record<string, (input: string) => string> = {
    b64dec: (input) => Buffer.from(input, "base64").toString("utf8"),
    b64enc: (input) => Buffer.from(input).toString("base64"),
    downcase: (input) => input.toLowerCase(),
    upcase: (input) => input.toUpperCase(),
};

const VARIABLE_PATTERN = /\{\{\s*([A-Z_][A-Z0-9_]*)((?:\s*\|\s*[a-z0-9_]+)*)\s*\}\}/g;

/**
 * Liquid-lite template renderer. Handles `{{ VAR | filter1 | filter2 }}` and
 * returns `undefined` when a variable or filter isn't resolvable — callers
 * treat `undefined` as "skip this rule" rather than sending a malformed
 * request.
 * @param template Source string with `{{ VAR | filter }}` placeholders.
 * @param variables Map of uppercase variable name → string value.
 * @returns Rendered string, or `undefined` when rendering failed.
 */
export const renderTemplate = (template: string, variables: Record<string, string>): string | undefined => {
    let failed = false;

    const out = template.replaceAll(VARIABLE_PATTERN, (match, name: string, filterChain: string) => {
        const upper = name.toUpperCase();
        const raw = variables[upper];

        if (raw === undefined) {
            failed = true;

            return match;
        }

        let value = raw;

        if (filterChain) {
            const filters = filterChain
                .split("|")
                .map((segment) => segment.trim())
                .filter((segment) => segment.length > 0);

            for (const filterName of filters) {
                const fn = FILTERS[filterName];

                if (!fn) {
                    failed = true;

                    return match;
                }

                value = fn(value);
            }
        }

        return value;
    });

    return failed ? undefined : out;
};
