import ansiRegex from "ansi-regex";
import emojiRegex from "emoji-regex";

import type { LocaleOptions, SplitByCase } from "../types";
import { germanUpperSsToSz } from "./german-case-utils";
export interface SplitOptions extends LocaleOptions {
    knownAcronyms?: ReadonlyArray<string>;
    normalize?: boolean;
    separators?: ReadonlyArray<string>;
}

/**
 * Splits a string into “words” by:
 * – first splitting on any explicit separator (by default: “-”, “_”, “/”, “.” and space)
 * – then breaking on camel–case boundaries (including between digits and letters)
 * – and finally handling “acronym boundaries” so that for example:
 *
 *     "FOOBar"   → [ "FOO", "Bar" ]
 *     "ABCdef"   → [ "ABC", "def" ]
 *     "ATest"    → [ "A", "Test" ]
 *     "FooBARb"  → [ "Foo", "BAR", "b" ]
 *     "FIZz"     → [ "FI", "Zz" ]  (because "FIZ" isn’t “known”)
 *
 * The options allow you to supply:
 * – a custom list of separators,
 * – a list of known acronyms (for which an uppercase run is kept intact),
 * – and a “normalize” flag (if true, any “all–uppercase” token not in the known list is title–cased).
 *
 * @example
 *   splitByCase("XMLHttpRequest")
 *     // → [ "XML", "Http", "Request" ]
 *
 *   splitByCase("foo\\Bar.fuzz-FIZz", { separators: ["\\",".","-"] })
 *     // → [ "foo", "Bar", "fuzz", "FI", "Zz" ]
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const splitByCase = <T extends string>(input: T, splitOptions?: SplitOptions): SplitByCase<T> => {
    if (!input || typeof input !== "string") {
        return [];
    }

    const options = {
        knownAcronyms: [],
        normalize: false,
        separators: ["-", "_", "/", ".", " "],
        ...splitOptions,
    };

    input = germanUpperSsToSz(input, options.locale);

    // First, split by any explicit separator.
    const separatorRegex = new RegExp(options.separators.map((s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
    const parts = input.split(separatorRegex).filter(Boolean);

    // Locale–aware helper functions.
    const toLocaleLower = (s: string) => (options.locale ? s.toLocaleLowerCase(options.locale) : s.toLowerCase());
    const toLocaleUpper = (s: string) => (options.locale ? s.toLocaleUpperCase(options.locale) : s.toUpperCase());

    // Instead of simple ASCII range comparisons, we use locale–aware checks.
    const isLower = (ch: string): boolean => ch === toLocaleLower(ch) && ch !== toLocaleUpper(ch);
    const isUpper = (ch: string): boolean => ch === toLocaleUpper(ch) && ch !== toLocaleLower(ch);
    const isDigit = (ch: string) => /\d/.test(ch);
    const isLetter = (ch: string) => /[A-Z]/i.test(ch); // You might extend this for other alphabets.

    // Process one part by scanning through its characters.
    const processPart = (part: string): string[] => {
        const tokens: string[] = [];
        let tokenStart = 0;
        let index = 1;

        // eslint-disable-next-line no-loops/no-loops
        while (index < part.length) {
            const previous = part[index - 1] as string;
            const current = part[index] as string;

            // Rule A: letter/digit–to–letter/digit transition.
            if (
                ((isLower(previous) || isDigit(previous)) && isUpper(current)) ||
                (isLetter(previous) && isDigit(current)) ||
                (isDigit(previous) && isLetter(current))
            ) {
                // Cut the token at i.
                tokens.push(part.slice(tokenStart, index));
                tokenStart = index;
                // eslint-disable-next-line no-plusplus
                index++;
                // eslint-disable-next-line no-continue
                continue;
            }

            // Rule B: Within an uppercase run ending before a lowercase letter.
            // That is: if we are in a run of uppercase letters and the next character (if any)
            // is lowercase, then we want to cut at a “special” index.
            if (
                isUpper(previous) &&
                isUpper(current) && // Look ahead: if there is a next character and it is lowercase, we are at the end of an uppercase run.
                index + 1 < part.length &&
                isLower(part[index + 1])
            ) {
                // Identify the run start (back up while we have uppercase letters).
                let runStart = index - 1;

                // eslint-disable-next-line no-loops/no-loops
                while (runStart > tokenStart && isUpper(part[runStart - 1])) {
                    runStart--;
                }

                const runEnd = index + 1; // curr is at i; run runs from runStart to runEnd-1.
                const runLength = runEnd - runStart;

                // Decide where to cut.
                let boundary: number;

                if (runLength === 2) {
                    boundary = runStart + 1;
                } else if (runLength === 3) {
                    // If the entire uppercase run is in our knownAcronyms list, keep it intact;
                    // otherwise, split off the last letter.
                    const runString = part.slice(runStart, runEnd);

                    if (options.knownAcronyms.includes(runString)) {
                        boundary = runEnd; // keep all three letters together
                    } else {
                        boundary = runStart + runLength - 1;
                    }
                } else if (runLength >= 4) {
                    // For runs of length 4 or more, cut before the last letter.
                    boundary = runStart + runLength - 1;
                } else {
                    // Should not happen.
                    boundary = index;
                }
                if (boundary > tokenStart && boundary < part.length) {
                    tokens.push(part.slice(tokenStart, boundary));
                    tokenStart = boundary;
                    index = tokenStart;

                    continue;
                }
            }

            index++;
        }

        // Push any leftover characters.
        if (tokenStart < part.length) {
            tokens.push(part.slice(tokenStart));
        }

        return tokens;
    };

    // Process every part and then (for each token) apply a “post‐split” for the case
    // where an uppercase token immediately followed by lowercase letters still may need splitting.
    // (For example, if after initial scanning we still have a token matching /^[A-Z]{2,}[a-z]+$/,
    // then—if it isn’t a known acronym—we cut between the last uppercase letter and the lowercase tail.)
    const postProcess = (tok: string): string[] => {
        // Only process tokens that begin with at least two uppercase letters and then a lowercase.
        const m = /^([A-Z]{2,})([a-z].*)$/.exec(tok);

        if (m) {
            const acr = m[1];
            // Decide cut position:
            // For a 2‐letter run (e.g. “ATest”), we want [first letter, rest];
            // for a 3–letter run, if the run is known, keep it; if not, split off the last letter;
            // for runs of length ≥4, always drop the last letter.
            let boundary: number;

            if (acr.length === 2) {
                boundary = 1;
            } else if (acr.length === 3) {
                boundary = options.knownAcronyms.includes(acr) ? 3 : 2;
            } else {
                boundary = acr.length - 1;
            }
            // Only split if that actually makes a difference.
            if (boundary < acr.length) {
                return [tok.slice(0, boundary), tok.slice(boundary)];
            }
        }
        return [tok];
    };

    // Process each part.
    const words: string[] = [];

    for (const part of parts) {
        const prelim = processPart(part);
        // For each token produced, run the postProcess step.
        for (const tok of prelim) {
            words.push(...postProcess(tok));
        }
    }

    const ansiRe = ansiRegex();
    const splitTokenByAnsi = (token: string): string[] => {
        const segments: string[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        ansiRe.lastIndex = 0; // ensure starting at beginning
        while ((match = ansiRe.exec(token)) !== null) {
            const { index } = match;
            if (index > lastIndex) {
                segments.push(token.slice(lastIndex, index));
            }
            segments.push(match[0]);
            lastIndex = ansiRe.lastIndex;
        }
        if (lastIndex < token.length) {
            segments.push(token.slice(lastIndex));
        }
        return segments.filter(Boolean);
    };

    // === Step 4. Further split tokens on emoji boundaries ===
    const emojiRe = emojiRegex();
    const splitTokenByEmoji = (token: string): string[] => {
        const segments: string[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        emojiRe.lastIndex = 0; // reset regex state
        while ((match = emojiRe.exec(token)) !== null) {
            const { index } = match;
            if (index > lastIndex) {
                segments.push(token.slice(lastIndex, index));
            }
            segments.push(match[0]);
            lastIndex = emojiRe.lastIndex;
        }
        if (lastIndex < token.length) {
            segments.push(token.slice(lastIndex));
        }
        return segments.filter(Boolean);
    };

    // === Step 5. Combine ANSI and emoji splitting ===
    let finalTokens: string[] = [];
    for (const token of words) {
        // First split by ANSI escapes
        const ansiTokens = splitTokenByAnsi(token);
        for (const ansiToken of ansiTokens) {
            // Then, if the segment contains emoji, further split it.
            if (emojiRe.test(ansiToken)) {
                finalTokens.push(...splitTokenByEmoji(ansiToken));
            } else {
                finalTokens.push(ansiToken);
            }
        }
    }

    // Optionally, if "normalize" is true and a token is all–uppercase and not a known acronym,
    // convert it to title–case.
    if (options.normalize) {
        finalTokens = finalTokens.map((tok) => {
            if (/^[A-Z]+$/.test(tok) && !options.knownAcronyms.includes(tok)) {
                return toLocaleLower(tok[0] + tok.slice(1));
            }

            return tok;
        });
    }

    return finalTokens;
};
