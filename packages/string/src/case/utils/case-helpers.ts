import type { CaseOptions } from "../types";
import { isAllUpper } from "./is-locale-all-upper";
import { SEPARATORS_REGEX, getSeparatorsRegex, splitByAnsi, splitByEmoji, EMOJI_REGEX } from "./regex";
import { fastLowerCase, fastUpperCase } from "./string-ops";

export interface SplitOptions extends CaseOptions {
    separators?: ReadonlyArray<string>;
    knownAcronyms?: string[];
    normalize?: boolean;
}

// Cache for processed words
const wordCache = new Map<string, string[]>();
const CACHE_MAX_SIZE = 1000;

/**
 * Splits a string into words based on case boundaries and separators
 */
export const splitByWords = (input: string, splitOptions?: SplitOptions): string[] => {
    const options = {
        knownAcronyms: [],
        normalize: false,
        separators: ["-", "_", "/", ".", " "],
        ...splitOptions,
    };

    // Instead of simple ASCII range comparisons, we use locale–aware checks
    const isLower = (ch: string): boolean => ch === fastLowerCase(ch, options.locale) && ch !== fastUpperCase(ch, options.locale);
    const isUpper = (ch: string): boolean => ch === fastUpperCase(ch, options.locale) && ch !== fastLowerCase(ch, options.locale);
    const isDigit = (ch: string) => /\d/.test(ch);
    const isLetter = (ch: string) => /[A-Z]/i.test(ch);

    // Check cache first for simple cases
    if (!splitOptions) {
        const cached = wordCache.get(input);
        if (cached) {
            return [...cached];
        }
    }

    // First, split by any explicit separator
    const separatorPattern = splitOptions?.separators ? getSeparatorsRegex(options.separators) : SEPARATORS_REGEX;
    const parts = input.split(separatorPattern).filter(Boolean);

    // Process one part by scanning through its characters
    const processPart = (part: string): string[] => {
        if (options.locale && isAllUpper(part, options.locale)) {
            return [part];
        }

        const tokens: string[] = [];
        let tokenStart = 0;
        let index = 1;

        while (index < part.length) {
            const previous = part[index - 1];
            const current = part[index];

            // Rule A: letter/digit–to–letter/digit transition
            if (
                ((isLower(previous) || isDigit(previous)) && isUpper(current)) ||
                (isLetter(previous) && isDigit(current)) ||
                (isDigit(previous) && isLetter(current))
            ) {
                tokens.push(part.slice(tokenStart, index));
                tokenStart = index;
                index++;
                continue;
            }

            // Rule B: Within an uppercase run ending before a lowercase letter
            if (
                isUpper(previous) &&
                isUpper(current) &&
                index + 1 < part.length &&
                isLower(part[index + 1])
            ) {
                let runStart = index - 1;
                while (runStart > tokenStart && isUpper(part[runStart - 1])) {
                    runStart--;
                }

                const runEnd = index + 1;
                const runLength = runEnd - runStart;

                let boundary: number;

                if (runLength === 2) {
                    boundary = runStart + 1;
                } else if (runLength === 3) {
                    const runString = part.slice(runStart, runEnd);
                    boundary = options.knownAcronyms.includes(runString) ? runEnd : runStart + runLength - 1;
                } else {
                    boundary = runStart + runLength - 1;
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

        if (tokenStart < part.length) {
            tokens.push(part.slice(tokenStart));
        }

        return tokens;
    };

    // Post-process tokens
    const postProcess = (tok: string): string[] => {
        const m = /^([A-Z]{2,})([a-z].*)$/.exec(tok);

        if (m) {
            const acr = m[1];
            let boundary: number;

            if (acr.length === 2) {
                boundary = 1;
            } else if (acr.length === 3) {
                boundary = options.knownAcronyms.includes(acr) ? 3 : 2;
            } else {
                boundary = acr.length - 1;
            }

            if (boundary < acr.length) {
                return [tok.slice(0, boundary), tok.slice(boundary)];
            }
        }

        return [tok];
    };

    // Process each part with ANSI and emoji preservation
    const words = parts.flatMap((part) => {
        // First handle ANSI escape sequences
        const ansiSegments = splitByAnsi(part);
        return ansiSegments.flatMap((segment) => {
            // Preserve ANSI escape sequences
            if (segment.startsWith("\x1B")) {
                return [segment];
            }

            // Handle emojis in non-ANSI segments
            const emojiSegments = splitByEmoji(segment);
            return emojiSegments.flatMap((emojiSegment) => {
                // Preserve emoji characters
                if (EMOJI_REGEX.test(emojiSegment)) {
                    return [emojiSegment];
                }

                // Process regular text segments
                const processed = processPart(emojiSegment);
                return processed.flatMap((seg) => postProcess(seg));
            });
        });
    });

    // Cache result for simple cases
    if (!splitOptions && wordCache.size < CACHE_MAX_SIZE) {
        wordCache.set(input, [...words]);
    }

    // Normalize if requested
    if (options.normalize) {
        return words.map((tok) => {
            if (/^[A-Z]+$/.test(tok) && !options.knownAcronyms.includes(tok)) {
                return fastLowerCase(tok[0], options.locale) + tok.slice(1);
            }

            return tok;
        });
    }

    return words;
};
