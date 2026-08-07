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
const PARSE_OPTIONS: ParseOptions = { duplicateKeys: "overwrite" };

/**
 * Runs the official [yaml-test-suite](https://github.com/yaml/yaml-test-suite)
 * (vendored via the `yaml-test-suite` npm package) against our parser.
 *
 * No JavaScript YAML implementation passes 100% of this suite; the goal here is
 * a **regression gate**: the pass count must never drop and no currently-passing
 * test file may start failing. When a fix lifts the count, bump `EXPECTED_PASS`.
 *
 * The remaining known-failing files fall into a handful of spec corners we do
 * not yet cover — see `KNOWN_FAILING` below and `AGENTS.md`.
 */

interface SuiteCase {
    fail?: boolean;
    json?: string;
    name?: string;
    yaml: string;
}

interface SuiteTest {
    cases: SuiteCase[];
    id: string;
}

const suite = suiteDefault as unknown as SuiteTest[];

// Number of individual cases (across 350 files) we currently parse correctly.
const EXPECTED_PASS = 365;

// Test files with at least one case we do not yet handle. Most are fail-tests
// the grammar should reject but we (like js-yaml on some, e.g. 4JVG/CXX2) accept,
// plus a few tag/scalar edge cases (4FJ6, 9KAX, C4HZ, LE5A, SM9W, UGM3, UKK6, W4TN).
const KNOWN_FAILING = new Set<string>([
    "3HFZ",
    "4EJS",
    "4FJ6",
    "4JVG",
    "9C9N",
    "9JBA",
    "9KAX",
    "9KBC",
    "C4HZ",
    "CVW2",
    "CXX2",
    "DK95",
    "H7J7",
    "H7TQ",
    "LE5A",
    "LHL4",
    "MUS6",
    "QB6E",
    "S98Z",
    "SF5V",
    "SM9W",
    "SU5Z",
    "U99R",
    "UGM3",
    "UKK6",
    "VJP3",
    "W4TN",
    "WZ62",
    "Y79Y",
]);

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
            if (seen.has(input)) {
                return "[circular]";
            }

            seen.add(input);

            if (Array.isArray(input)) {
                return input.map((item) => walk(item));
            }

            const output: Record<string, unknown> = {};

            for (const key of Object.keys(input).toSorted((a, b) => a.localeCompare(b))) {
                output[key] = walk((input as Record<string, unknown>)[key]);
            }

            return output;
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

const runCase = (testCase: SuiteCase): boolean => {
    if (testCase.fail) {
        try {
            parseAll(testCase.yaml, PARSE_OPTIONS);

            return false;
        } catch {
            return true;
        }
    }

    if (testCase.json !== undefined) {
        try {
            return canonicalize(parseAll(testCase.yaml, PARSE_OPTIONS)) === canonicalize(splitJsonStream(testCase.json));
        } catch {
            return false;
        }
    }

    // Valid document without a JSON representation: it just has to parse.
    try {
        parseAll(testCase.yaml, PARSE_OPTIONS);

        return true;
    } catch {
        return false;
    }
};

describe("official yaml-test-suite", () => {
    const results = suite.map((test) => {
        const caseResults = test.cases.map((testCase) => runCase(testCase));
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

    it(`parses at least ${String(EXPECTED_PASS)} of ${String(402)} cases`, () => {
        expect.assertions(1);

        // If this fails high, we improved — bump EXPECTED_PASS to the new number.
        expect(passedCases).toBeGreaterThanOrEqual(EXPECTED_PASS);
    });

    it("does not regress any currently-passing test file", () => {
        expect.assertions(1);

        const unexpected = failingIds.filter((id) => !KNOWN_FAILING.has(id));

        expect(unexpected).toStrictEqual([]);
    });

    it("keeps the known-failing allowlist tight (no stale entries)", () => {
        expect.assertions(1);

        // A KNOWN_FAILING id that now fully passes should be removed from the set.
        const stale = [...KNOWN_FAILING].filter((id) => !failingIds.includes(id));

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
