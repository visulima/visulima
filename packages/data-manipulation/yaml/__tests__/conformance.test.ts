/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable unicorn/prefer-switch */
import { describe, expect, it } from "vitest";
import suiteDefault from "yaml-test-suite";

import type { ParseOptions } from "../src";
import { parseAll } from "../src";

const WHITESPACE = /\s/;

// Duplicate keys are a schema/application concern, not a grammar (parse) error,
// and the suite only exercises the grammar — so never throw on them here.
//
// `strict` is on by default; it rejects extra spec violations both refs are
// lenient about, clearing a few more fail-tests (H7J7, 9KBC, CXX2) than the
// opt-out `strict: false` (loose) mode.
const PARSE_OPTIONS: ParseOptions = { duplicateKeys: "overwrite" };
const LOOSE_PARSE_OPTIONS: ParseOptions = { duplicateKeys: "overwrite", strict: false };

/**
 * Runs the official [yaml-test-suite](https://github.com/yaml/yaml-test-suite)
 * (vendored via the `yaml-test-suite` npm package) against our parser.
 *
 * Strict mode (the default) passes the whole suite; the loose mode deliberately
 * re-accepts the six spec-violating fail-tests that `js-yaml` also accepts.
 *
 * Both are **regression gates**: the pass count must never drop, no
 * currently-passing file may start failing, and a `KNOWN_FAILING*` entry that
 * begins passing must be pruned. See `AGENTS.md`.
 */

interface SuiteCase {
    fail?: boolean;
    // The `yaml-test-suite` package uses JS `null` (not `undefined`) for cases
    // with no canonical JSON — treated the same as absent: the input must parse.
    json?: null | string;
    name?: string;
    yaml: string;
}

interface SuiteTest {
    cases: SuiteCase[];
    id: string;
}

const suite = suiteDefault as unknown as SuiteTest[];

// Number of individual cases (across 350 files) each mode parses correctly, and
// the files it still trips on. The default (strict) mode passes the ENTIRE
// suite — 402/402. The loose (`strict: false`) mode deliberately re-accepts the
// six spec-violating fail-tests that js-yaml also accepts, matching its
// leniency: 4JVG two anchors, 9KBC/CXX2 block collection on the `---` line, H7J7
// under-indented property, S98Z block-scalar indentation, Y79Y tab-in-scalar.
const EXPECTED_PASS = 402;
const KNOWN_FAILING = new Set<string>();

const EXPECTED_PASS_LOOSE = 396;
const KNOWN_FAILING_LOOSE = new Set<string>(["4JVG", "9KBC", "CXX2", "H7J7", "S98Z", "Y79Y"]);

const canonicalize = (value: unknown): string => {
    const seen = new WeakSet<object>();

    const walk = (input: unknown): unknown => {
        if (input === undefined) {
            return null;
        }

        if (typeof input === "number") {
            return Number.isFinite(input) ? input : String(input);
        }

        if (input !== null && typeof input === "object") {
            // Track only the *current path* (add on enter, remove on leave) so a
            // node reached through several YAML aliases — a legitimately shared,
            // non-circular reference like `*ORIGIN` in suite case C4HZ — is
            // walked each time instead of being mistaken for a cycle.
            if (seen.has(input)) {
                return "[circular]";
            }

            seen.add(input);

            let result: unknown;

            if (Array.isArray(input)) {
                result = input.map((item) => walk(item));
            } else {
                const output: Record<string, unknown> = {};

                for (const key of Object.keys(input).toSorted((a, b) => a.localeCompare(b))) {
                    output[key] = walk((input as Record<string, unknown>)[key]);
                }

                result = output;
            }

            seen.delete(input);

            return result;
        }

        return input;
    };

    return JSON.stringify(walk(value));
};

// Split a JSON stream (one-or-more concatenated top-level JSON values, one per
// document) into an array — the suite stores multi-document expectations this way.
const splitJsonStream = (text: string): unknown[] => {
    const out: unknown[] = [];
    let depth = 0;
    let inString = false;
    let escaped = false;
    let start = -1;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index]!;

        if (start === -1) {
            if (WHITESPACE.test(char)) {
                continue;
            }

            start = index;
        }

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === "\\") {
                escaped = true;
            } else if (char === "\u0022") {
                inString = false;
            }
        } else if (char === "\u0022") {
            inString = true;
        } else if (char === "{" || char === "[") {
            depth += 1;
        } else if (char === "}" || char === "]") {
            depth -= 1;
        }

        if (depth === 0 && !inString) {
            const isContainer = text[start] === "{" || text[start] === "[";
            const next = text[index + 1];
            const containerEnd = char === "}" || char === "]";
            const primitiveBoundary = !isContainer && (next === undefined || WHITESPACE.test(next));

            if ((isContainer && containerEnd) || primitiveBoundary) {
                out.push(JSON.parse(text.slice(start, index + 1)));
                start = -1;
            }
        }
    }

    return out;
};

const runCase = (testCase: SuiteCase, options: ParseOptions): boolean => {
    if (testCase.fail) {
        try {
            parseAll(testCase.yaml, options);

            return false;
        } catch {
            return true;
        }
    }

    if (testCase.json !== undefined && testCase.json !== null) {
        try {
            return canonicalize(parseAll(testCase.yaml, options)) === canonicalize(splitJsonStream(testCase.json));
        } catch {
            return false;
        }
    }

    // Valid document without a JSON representation: it just has to parse.
    try {
        parseAll(testCase.yaml, options);

        return true;
    } catch {
        return false;
    }
};

interface Mode {
    expectedPass: number;
    knownFailing: Set<string>;
    label: string;
    options: ParseOptions;
}

const MODES: Mode[] = [
    { expectedPass: EXPECTED_PASS, knownFailing: KNOWN_FAILING, label: "default (strict)", options: PARSE_OPTIONS },
    { expectedPass: EXPECTED_PASS_LOOSE, knownFailing: KNOWN_FAILING_LOOSE, label: "loose", options: LOOSE_PARSE_OPTIONS },
];

describe.each(MODES)("official yaml-test-suite ($label)", ({ expectedPass, knownFailing, options }) => {
    const results = suite.map((test) => {
        const caseResults = test.cases.map((testCase) => runCase(testCase, options));
        const passCount = caseResults.filter(Boolean).length;

        return { allPass: passCount === test.cases.length, id: test.id, passCount, total: test.cases.length };
    });

    const totalCases = results.reduce((sum, r) => sum + r.total, 0);
    const passedCases = results.reduce((sum, r) => sum + r.passCount, 0);
    const failingIds = results.filter((r) => !r.allPass).map((r) => r.id);

    it("covers the full suite (350 files)", () => {
        expect.assertions(1);

        expect(results.length).toBeGreaterThanOrEqual(350);
    });

    it(`parses at least ${String(expectedPass)} of ${String(402)} cases`, () => {
        expect.assertions(1);

        // If this fails high, we improved — bump the mode's expected count.
        expect(passedCases).toBeGreaterThanOrEqual(expectedPass);
    });

    it("does not regress any currently-passing test file", () => {
        expect.assertions(1);

        const unexpected = failingIds.filter((id) => !knownFailing.has(id));

        expect(unexpected).toStrictEqual([]);
    });

    it("keeps the known-failing allowlist tight (no stale entries)", () => {
        expect.assertions(1);

        // A known-failing id that now fully passes should be removed from the set.
        const stale = [...knownFailing].filter((id) => !failingIds.includes(id));

        expect(stale).toStrictEqual([]);
    });

    it("reports the current conformance rate", () => {
        expect.assertions(1);

        const rate = (100 * passedCases) / totalCases;

        // eslint-disable-next-line no-console
        console.info(`yaml-test-suite: ${String(passedCases)}/${String(totalCases)} cases (${rate.toFixed(1)}%)`);

        expect(rate).toBeGreaterThan(80);
    });
});
