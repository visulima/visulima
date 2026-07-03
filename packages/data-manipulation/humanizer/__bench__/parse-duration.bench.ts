import { bench, describe } from "vitest";

import { englishUnitMap } from "../src/language/en";
import parseDuration from "../src/parse-duration";

const ESCAPE_REGEX = /[-/\\^$*+?.()|[\]{}]/g;

/**
 * Builds the unit-matching RegExp from scratch (sort + escape + compile) the way
 * parseDuration used to on every single call, before the module-level WeakMap
 * cache was introduced. Kept here only to contrast against the cached path so the
 * speedup is measurable.
 */
const buildRegexUncached = (unitMap: Record<string, string>): RegExp => {
    const regexKeys = Object.keys(unitMap)
        .toSorted((a, b) => b.length - a.length)
        .map((k) => k.replaceAll(ESCAPE_REGEX, String.raw`\$&`))
        .join("|");

    return new RegExp(String.raw`(-?\d*\.?\d+)\s*(${regexKeys})`, "gi");
};

const CACHE = new WeakMap<Record<string, string>, RegExp>();

const buildRegexCached = (unitMap: Record<string, string>): RegExp => {
    let regex = CACHE.get(unitMap);

    if (regex === undefined) {
        regex = buildRegexUncached(unitMap);
        CACHE.set(unitMap, regex);
    }

    return regex;
};

const ITERATIONS = 1000;

describe("parseDuration unit-regex construction (cached WeakMap vs rebuild-every-call)", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("cached (WeakMap lookup)", () => {
        for (let index = 0; index < ITERATIONS; index += 1) {
            buildRegexCached(englishUnitMap);
        }
    });

    bench.skipIf(process.env.CODSPEED_ENV)("uncached (sort + escape + new RegExp each call)", () => {
        for (let index = 0; index < ITERATIONS; index += 1) {
            buildRegexUncached(englishUnitMap);
        }
    });
});

describe("parseDuration end-to-end (default English language)", () => {
    bench("parseDuration('1h 20min 30s')", () => {
        parseDuration("1h 20min 30s");
    });
});
