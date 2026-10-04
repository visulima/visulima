import { matcher } from "@visulima/fs/match";

import { ERRORS, throwErrorCode } from "../utils/errors";
import type { SearchMatch } from "./types";

/** First character that makes a glob more than a literal: the walk prefix stops right before it. */
const GLOB_SPECIAL = /[!()*+?@[\\\]{}]/u;

/** Whether `source` has an unbounded quantifier (`*`, `+`, `{n,}`, `{n,m}`) at `index`. */
const isQuantifier = (source: string, index: number): boolean =>
    source[index] === "*" || source[index] === "+" || /^\{\d+,/u.test(source.slice(index, index + 12));

/**
 * Whether a regex source quantifies a group that itself contains a quantifier, like `(a+)+` or
 * `(\w*)*` — the classic catastrophic-backtracking shape. A linear scan and a heuristic, not a
 * proof: it catches the common exponential forms without fully parsing the expression.
 */
const nestsQuantifiers = (source: string): boolean => {
    // One entry per open group: whether it contains a quantifier.
    const groups: boolean[] = [];
    let inClass = false;

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];

        if (char === "\\") {
            index += 1;
        } else if (inClass) {
            inClass = char !== "]";
        } else {
            switch (char) {
                case "(": {
                    groups.push(false);

                    break;
                }
                case ")": {
                    const quantified = groups.pop() ?? false;

                    if (quantified && isQuantifier(source, index + 1)) {
                        return true;
                    }

                    if (quantified && groups.length > 0) {
                        groups[groups.length - 1] = true;
                    }

                    break;
                }
                case "[": {
                    inClass = true;

                    break;
                }
                default: {
                    if (groups.length > 0 && isQuantifier(source, index)) {
                        groups[groups.length - 1] = true;
                    }
                }
            }
        }
    }

    return false;
};

const compileRegExp = (source: string, flags: string): RegExp => {
    if (nestsQuantifiers(source)) {
        return throwErrorCode(ERRORS.BAD_REQUEST, `Search pattern /${source}/ nests quantifiers and could backtrack catastrophically`);
    }

    try {
        return new RegExp(source, flags);
    } catch (error: unknown) {
        return throwErrorCode(ERRORS.BAD_REQUEST, `Invalid search pattern: ${(error as Error).message}`);
    }
};

/**
 * Compile a {@link Files.search} pattern into a key predicate. A `RegExp` always matches as a regex
 * (its own flags, plus `i` when `caseInsensitive`); a string is read according to `match`.
 * @throws {UploadError} BAD_REQUEST for an invalid or backtracking-prone regex
 */
export const compileSearch = (pattern: RegExp | string, match: SearchMatch, caseInsensitive: boolean): ((key: string) => boolean) => {
    if (pattern instanceof RegExp) {
        // Drop the stateful flags: `g`/`y` make `test` remember `lastIndex` between keys.
        const flags = pattern.flags.replaceAll(/[gy]/gu, "");
        const regex = compileRegExp(pattern.source, caseInsensitive && !flags.includes("i") ? `${flags}i` : flags);

        return (key) => regex.test(key);
    }

    switch (match) {
        case "exact": {
            const expected = caseInsensitive ? pattern.toLowerCase() : pattern;

            return (key) => (caseInsensitive ? key.toLowerCase() : key) === expected;
        }
        case "glob": {
            return matcher(pattern, { dot: true, nocase: caseInsensitive, windows: false });
        }
        case "regex": {
            const regex = compileRegExp(pattern, caseInsensitive ? "iu" : "u");

            return (key) => regex.test(key);
        }
        case "substring": {
            const needle = caseInsensitive ? pattern.toLowerCase() : pattern;

            return (key) => (caseInsensitive ? key.toLowerCase() : key).includes(needle);
        }
        default: {
            return throwErrorCode(ERRORS.BAD_REQUEST, `Unknown search match mode: ${String(match)}`);
        }
    }
};

/**
 * The literal head every matching key must start with, used to scope the walk: the text before the
 * first glob metacharacter, or the whole pattern for an exact match. `undefined` when the mode has
 * no anchored head (regex, substring) or matching ignores case.
 */
export const searchPrefix = (pattern: RegExp | string, match: SearchMatch, caseInsensitive: boolean): string | undefined => {
    if (typeof pattern !== "string" || caseInsensitive) {
        return undefined;
    }

    if (match === "exact") {
        return pattern;
    }

    if (match !== "glob") {
        return undefined;
    }

    const special = GLOB_SPECIAL.exec(pattern);

    return special ? pattern.slice(0, special.index) : pattern;
};
