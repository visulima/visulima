// Detection-time checksum filter for Kingfisher rules that declare
// `pattern_requirements.checksum`. These rules use loose regexes + an embedded
// checksum (CRC32 of the body, encoded in the secret format) as their actual
// precision gate. Without running the checksum, the pattern alone matches too
// much. We run it in TS because the 11 affected rules are tiny relative to the
// overall scan cost, and it keeps `reqwest`/crc crates out of the native side.

import { Buffer } from "node:buffer";
import zlib from "node:zlib";

export interface ChecksumSpec {
    actual?: {
        requires_capture?: string;
        template: string;
    };
    expected: string;
    skip_if_missing?: boolean;
}

const INLINE_FLAGS_PATTERN = /^\s*\(\?([a-z]+)\)\s*/;
const FREE_SPACING_COMMENT_PATTERN = /#[^\n]*/g;
const WHITESPACE_PATTERN = /\s+/g;

const RULE_REGEX_CACHE = new Map<string, RegExp | null>();

/**
 * Convert a Rust/Python-style rule pattern to a JS `RegExp` good enough to
 * re-extract named captures from an already-matched substring.
 *
 * Scope is narrow by design — we only apply this to rule patterns that
 * declare `pattern_requirements.checksum`. Known Kingfisher constructs:
 * - `(?x)` / `(?xi)` free-spacing mode → strip whitespace + `#...` comments
 * - `(?P&lt;name>...)` Python-style named groups → JS `(?&lt;name>...)`
 * Everything else (character classes, alternation, backrefs) is syntactically
 * compatible between Rust `regex` and JS `RegExp`.
 */
export const ruleRegexToJs = (pattern: string): RegExp => {
    const flagMatch = INLINE_FLAGS_PATTERN.exec(pattern);
    let body = flagMatch ? pattern.slice(flagMatch[0].length) : pattern;
    const flags = new Set<string>();

    const inlineFlags = flagMatch?.[1] ?? "";

    if (inlineFlags.includes("i")) {
        flags.add("i");
    }

    if (inlineFlags.includes("x")) {
        body = body.replaceAll(FREE_SPACING_COMMENT_PATTERN, "").replaceAll(WHITESPACE_PATTERN, "");
    }

    body = body.replaceAll("(?P<", "(?<");

    return new RegExp(body, [...flags].join(""));
};

type FilterValue = number | string;

// eslint-disable-next-line no-bitwise
const asNumber = (value: FilterValue): number => (typeof value === "number" ? value >>> 0 : Number.parseInt(value, 10) >>> 0);

const encodeBase = (num: number, alphabet: string, width: number): string => {
    // eslint-disable-next-line no-bitwise
    let n = num >>> 0;

    if (n === 0) {
        return "0".repeat(Math.max(1, width));
    }

    let out = "";

    while (n > 0) {
        out = (alphabet[n % alphabet.length] ?? "") + out;
        n = Math.floor(n / alphabet.length);
    }

    if (width > 0 && out.length < width) {
        out = out.padStart(width, "0");
    }

    return out;
};

// eslint-disable-next-line no-secrets/no-secrets
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// eslint-disable-next-line no-secrets/no-secrets
const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

type FilterFn = (input: FilterValue, argument?: string) => FilterValue;

/**
 * Liquid filters kingfisher uses inside `pattern_requirements.checksum`.
 * Intentionally minimal — anything we don't recognise makes the render fail,
 * which drops the finding to "skip checksum" (kept if `skip_if_missing`).
 */
const FILTERS: Record<string, FilterFn> = {
    base36: (input, argument) => encodeBase(asNumber(input), BASE36_ALPHABET, Number(argument ?? 0)),
    base62: (input, argument) => encodeBase(asNumber(input), BASE62_ALPHABET, Number(argument ?? 0)),
    crc32: (input) => zlib.crc32(Buffer.from(String(input))),
    crc32_hex: (input) =>
        zlib
            .crc32(Buffer.from(String(input)))
            .toString(16)
            .padStart(8, "0"),
    crc32_le_b64: (input, argument) => {
        const buf = Buffer.alloc(4);

        buf.writeUInt32LE(zlib.crc32(Buffer.from(String(input))), 0);

        const b64 = buf.toString("base64");
        const width = Number(argument ?? 0);

        return width > 0 ? b64.slice(0, width) : b64;
    },
    downcase: (input) => String(input).toLowerCase(),
    upcase: (input) => String(input).toUpperCase(),
};

// Template shape: `{{ VAR | filter1 | filter2: arg | filter3 }}`. Filter
// arguments are restricted to `\w+` (sufficient for the integer widths every
// Kingfisher checksum template uses: `base62: 6`, `base36: 7`,
// `crc32_le_b64: 6`) — keeps the regex linear, no super-linear backtracking.
// eslint-disable-next-line sonarjs/regex-complexity -- complexity 22 is the cost of the filter-chain grammar; each piece is already as flat as it gets.
const TEMPLATE_PATTERN = /\{\{\s*([a-z_]\w*)((?:\s*\|\s*\w+(?:\s*:\s*\w+)?)*)\s*\}\}/gi;

/**
 * Apply a checksum template chain. Returns the rendered string, or `undefined`
 * if any variable or filter can't be resolved (template uses a filter we don't
 * support, or references a named capture the regex didn't produce).
 */
export const renderChecksumTemplate = (template: string, variables: Record<string, string>): string | undefined => {
    let failed = false;

    const out = template.replaceAll(TEMPLATE_PATTERN, (match, name: string, filterChain: string) => {
        const key = Object.keys(variables).find((k) => k.toLowerCase() === name.toLowerCase());

        if (key === undefined) {
            failed = true;

            return match;
        }

        let value: FilterValue = variables[key] ?? "";

        if (filterChain) {
            const filters = filterChain
                .split("|")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

            for (const entry of filters) {
                const colon = entry.indexOf(":");
                const filterName = colon === -1 ? entry : entry.slice(0, colon).trim();
                const argument = colon === -1 ? undefined : entry.slice(colon + 1).trim();
                const fn = FILTERS[filterName];

                if (!fn) {
                    failed = true;

                    return match;
                }

                value = fn(value, argument);
            }
        }

        return String(value);
    });

    return failed ? undefined : out;
};

/**
 * Validate that a finding's embedded checksum matches the template-computed
 * expected value. Returns `true` when the checksum passes (keep finding),
 * `false` when it fails (drop finding), and `undefined` when we couldn't decide —
 * caller treats `undefined` the same as `skip_if_missing` (default: keep).
 */
export const checkChecksum = (match: string, rulePattern: string, spec: ChecksumSpec): boolean | undefined => {
    let regex = RULE_REGEX_CACHE.get(rulePattern);

    if (regex === undefined) {
        try {
            regex = ruleRegexToJs(rulePattern);
        } catch {
            regex = null;
        }

        RULE_REGEX_CACHE.set(rulePattern, regex);
    }

    if (regex === null) {
        return undefined;
    }

    const captures = regex.exec(match);
    const variables = captures?.groups ?? {};

    if (!spec.actual?.template || !spec.expected) {
        return undefined;
    }

    const actual = renderChecksumTemplate(spec.actual.template, variables);
    const expected = renderChecksumTemplate(spec.expected, variables);

    if (actual === undefined || expected === undefined) {
        return undefined;
    }

    return actual.toLowerCase() === expected.toLowerCase();
};
