// eslint-disable-next-line import/no-extraneous-dependencies
import emojiRegex from "emoji-regex";
// eslint-disable-next-line import/no-extraneous-dependencies
import { eastAsianWidthType } from "get-east-asian-width";

import type { StringWidthResult, StringWidthOptions } from "./types";

const REGEX = {
    // eslint-disable-next-line no-control-regex,regexp/no-control-character
    ANSI: /[\u001B\u009B][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-ORZcf-nqry=><]/y,
    // eslint-disable-next-line no-control-regex,regexp/no-control-character,regexp/no-obscure-range
    CONTROL: /[\u0000-\u0008\n-\u001F\u007F-\u009F]{1,1000}/y,
    EMOJI: emojiRegex(),
    LATIN: /(?:[\u0020-\u007E\u00A0-\u00FF](?!\uFE0F)){1,1000}/y,
    MODIFIER: /\p{M}+/gu,
    TAB: /\t{1,1000}/y,
} as const;

// eslint-disable-next-line sonarjs/cognitive-complexity
const getStringTruncatedWidth = (input: string, options: StringWidthOptions = {}): StringWidthResult => {
    const config = {
        truncation: {
            ellipsis: options.ellipsis ?? "",
            ellipsisWidth:
                options.ellipsisWidth ??
                (options.ellipsis
                    ? getStringTruncatedWidth(options.ellipsis, {
                          ambiguousWidth: 1,
                          ansiWidth: 0,
                          controlWidth: 0,
                          emojiWidth: 2,
                          fullWidthWidth: 2,
                          regularWidth: 1,
                          tabWidth: 8,
                          wideWidth: 2,
                      }).width
                    : 0),
            limit: options.limit ?? Number.POSITIVE_INFINITY,
        },
        width: {
            ambiguous: options.ambiguousWidth ?? 1,
            ansi: options.ansiWidth ?? 0,
            control: options.controlWidth ?? 0,
            emoji: options.emojiWidth ?? 2,
            fullWidth: options.fullWidthWidth ?? 2,
            regular: options.regularWidth ?? 1,
            tab: options.tabWidth ?? 8,
            wide: options.wideWidth ?? 2,
        },
    } as const;

    const truncationLimit = Math.max(0, config.truncation.limit - config.truncation.ellipsisWidth);
    const { length } = input;

    let indexPrevious = 0;
    let index = 0;
    let lengthExtra = 0;
    let truncationEnabled = false;
    let truncationIndex = length;
    let unmatchedStart = 0;
    let unmatchedEnd = 0;
    let width = 0;
    let widthExtra = 0;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,no-loops/no-loops,no-restricted-syntax,no-labels
    outer: while (true) {
        if (unmatchedEnd > unmatchedStart || (index >= length && index > indexPrevious)) {
            const unmatched = input.slice(unmatchedStart, unmatchedEnd) || input.slice(indexPrevious, index);
            lengthExtra = 0;

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const char of unmatched.replaceAll(REGEX.MODIFIER, "")) {
                const codePoint = char.codePointAt(0) ?? 0;
                const eaw = eastAsianWidthType(codePoint);

                switch (eaw) {
                    case "fullwidth": {
                        widthExtra = config.width.fullWidth;

                        break;
                    }
                    case "wide": {
                        widthExtra = config.width.wide;

                        break;
                    }
                    case "ambiguous": {
                        widthExtra = config.width.ambiguous;

                        break;
                    }
                    case "halfwidth":
                    case "narrow":
                    case "neutral": {
                        widthExtra = config.width.regular;

                        break;
                    }
                    default: {
                        widthExtra = config.width.regular;
                    }
                }

                if (width + widthExtra > truncationLimit) {
                    truncationIndex = Math.min(truncationIndex, Math.max(unmatchedStart, indexPrevious) + lengthExtra);
                }

                if (width + widthExtra > config.truncation.limit) {
                    truncationEnabled = true;
                    // eslint-disable-next-line no-labels
                    break outer;
                }

                lengthExtra += char.length;
                width += widthExtra;
            }

            // eslint-disable-next-line no-multi-assign
            unmatchedStart = unmatchedEnd = 0;
        }

        if (index >= length) {
            break;
        }

        REGEX.LATIN.lastIndex = index;

        if (REGEX.LATIN.test(input)) {
            lengthExtra = REGEX.LATIN.lastIndex - index;
            widthExtra = lengthExtra * config.width.regular;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.regular));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.LATIN.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.ANSI.lastIndex = index;

        if (REGEX.ANSI.test(input)) {
            if (width + config.width.ansi > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);
            }

            if (width + config.width.ansi > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }

            width += config.width.ansi;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.ANSI.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.CONTROL.lastIndex = index;

        if (REGEX.CONTROL.test(input)) {
            lengthExtra = REGEX.CONTROL.lastIndex - index;
            widthExtra = lengthExtra * config.width.control;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.control));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.CONTROL.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.TAB.lastIndex = index;

        if (REGEX.TAB.test(input)) {
            lengthExtra = REGEX.TAB.lastIndex - index;
            widthExtra = lengthExtra * config.width.tab;

            if (width + widthExtra > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index + Math.floor((truncationLimit - width) / config.width.tab));
            }

            if (width + widthExtra > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }

            width += widthExtra;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.TAB.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        REGEX.EMOJI.lastIndex = index;

        if (REGEX.EMOJI.test(input)) {
            if (width + config.width.emoji > truncationLimit) {
                truncationIndex = Math.min(truncationIndex, index);
            }

            if (width + config.width.emoji > config.truncation.limit) {
                truncationEnabled = true;
                break;
            }

            width += config.width.emoji;
            unmatchedStart = indexPrevious;
            unmatchedEnd = index;
            // eslint-disable-next-line no-multi-assign
            index = indexPrevious = REGEX.EMOJI.lastIndex;

            // eslint-disable-next-line no-continue
            continue;
        }

        index += 1;
    }

    return {
        ellipsed: truncationEnabled && config.truncation.limit >= config.truncation.ellipsisWidth,
        index: truncationEnabled ? truncationIndex : length,
        truncated: truncationEnabled,
        width: truncationEnabled ? truncationLimit : width,
    };
};

export default getStringTruncatedWidth;
