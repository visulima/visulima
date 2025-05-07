import charmap from "./charmap";
import replaceString from "./replace-string";
import type { Charmap, Interval, IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionReplaceObject, OptionsTransliterate } from "./types";
import { findStringOccurrences, hasChinese, hasPunctuationOrSpace } from "./utils";

/**
 * Converts the object version of the 'replace' option into tuple array one.
 *
 * @param option The object version of the 'replace' option.
 * @returns The tuple array version of the 'replace' option.
 */
const formatReplaceOption = (option: OptionReplaceCombined): OptionReplaceArray => {
    if (Array.isArray(option)) {
        return structuredClone(option);
    }

    const replaceArray: OptionReplaceArray = [];

    for (const key in option as OptionReplaceObject) {
        if (Object.prototype.hasOwnProperty.call(option, key)) {
            // eslint-disable-next-line security/detect-object-injection
            const value = (option as OptionReplaceObject)[key];
            // Ensure value is a string before pushing
            if (typeof value === "string") {
                replaceArray.push([key, value]);
            }
        }
    }

    return replaceArray;
};

/**
 * Main transliterate function.
 * Replaces characters in a string based on a charmap and options.
 *
 * @param source The string which is being transliterated.
 * @param options Options object.
 * @returns The transliterated string.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const transliterate = (source: string, options?: OptionsTransliterate): string => {
    const opt: Required<OptionsTransliterate> = {
        fixChineseSpacing: true,
        ignore: [],
        replaceAfter: [],
        replaceBefore: [],
        trim: false,
        unknown: "",
        ...options,
    };

    let input = typeof source === "string" ? source : String(source);

    let replaceOptionBefore: OptionReplaceArray = [];
    if (Array.isArray(opt.replaceBefore) ? opt.replaceBefore.length > 0 : Object.keys(opt.replaceBefore).length > 0) {
        replaceOptionBefore = formatReplaceOption(opt.replaceBefore);
    }

    let initialIgnoreRanges: IntervalArray = [];
    let finalIgnoreRanges: IntervalArray;

    if (opt.ignore.length > 0) {
        initialIgnoreRanges = findStringOccurrences(input, opt.ignore);
    }

    if (replaceOptionBefore.length > 0) {
        input = replaceString(input, replaceOptionBefore, initialIgnoreRanges); // Use initialIgnores based on original input
        // Input has changed, ignore ranges might need re-evaluation for the main loop and replaceAfter
        finalIgnoreRanges = opt.ignore.length > 0 ? findStringOccurrences(input, opt.ignore) : [];
    } else {
        // Input has NOT changed, finalIgnoreRanges can be the same as initialIgnoreRanges
        finalIgnoreRanges = initialIgnoreRanges;
    }

    let result = "";

    const currentCharmap: Charmap = charmap;

    let lastCharWasChinese = false;
    let currentIgnoreRangeIndex = 0;

    for (let index = 0; index < input.length; ) {
        let char: string;
        let charLength = 1;

        // Handle surrogate pairs
        const currentCode = input.codePointAt(index);

        if (currentCode && currentCode >= 0xd8_00 && currentCode <= 0xdb_ff && index + 1 < input.length) {
            const nextCode = input.codePointAt(index + 1);

            if (nextCode && nextCode >= 0xdc_00 && nextCode <= 0xdf_ff) {
                // eslint-disable-next-line security/detect-object-injection
                char = (input[index] as string) + (input[index + 1] as string);
                charLength = 2;
            } else {
                // eslint-disable-next-line security/detect-object-injection
                char = input[index] as string;
            }
        } else {
            // eslint-disable-next-line security/detect-object-injection
            char = input[index] as string;
        }

        const isCurrentCharChinese = hasChinese(char);

        let s: string | null | undefined;
        const charEndIndex = index + charLength - 1;

        let isIgnored = false;

        if (finalIgnoreRanges.length > 0) {
            // Advance currentIgnoreRangeIndex if current char `index` is past the current ignore range
            while (
                currentIgnoreRangeIndex < finalIgnoreRanges.length &&
                // eslint-disable-next-line security/detect-object-injection
                (finalIgnoreRanges[currentIgnoreRangeIndex] as Interval)[1] < index
            ) {
                // eslint-disable-next-line no-plusplus
                currentIgnoreRangeIndex++;
            }

            // Check if current char (or its range) falls into the current relevant ignore range
            if (currentIgnoreRangeIndex < finalIgnoreRanges.length) {
                // eslint-disable-next-line security/detect-object-injection
                const currentRange = finalIgnoreRanges[currentIgnoreRangeIndex] as Interval;

                if (!(currentRange[1] < index || currentRange[0] > charEndIndex)) {
                    isIgnored = true;
                }
            }
        }

        if (isIgnored) {
            s = char; // Keep original character if ignored
        } else {
            const codePoint = char.codePointAt(0);
            if (codePoint === undefined) {
                s = opt.unknown;
            } else {
                const codePointString = String(codePoint);
                const found = Object.prototype.hasOwnProperty.call(currentCharmap, codePointString);
                if (found) {
                    s = currentCharmap[codePointString as keyof Charmap];
                } else if (isCurrentCharChinese) {
                    // Use cached value
                    s = char;
                }
            }
            if (s === undefined || s === null) {
                s = opt.unknown;
            }
        }

        const determinedCharWasChinese = !isIgnored && isCurrentCharChinese; // Use cached value

        if (opt.fixChineseSpacing && !isIgnored) {
            // Only apply spacing logic if fixChineseSpacing is true and char is not ignored
            const sIsDefinedAndNotEmpty = typeof s === "string" && s.length > 0;

            if (
                lastCharWasChinese && // If the previous character successfully processed was Chinese
                ((determinedCharWasChinese && sIsDefinedAndNotEmpty) ||
                    (!determinedCharWasChinese && sIsDefinedAndNotEmpty && s[0] && !hasPunctuationOrSpace(s[0] as string)))
            ) {
                // Prev Chinese, Current Chinese: "CN CN" -> Add space before current `s`
                result += " ";
            }

            lastCharWasChinese = determinedCharWasChinese; // Update for next iteration
        } else {
            lastCharWasChinese = false; // Reset if fixChineseSpacing is off or char is ignored
        }

        result += s;
        index += charLength;
    }

    input = result;

    if (opt.trim) {
        input = input.trim();
    }

    let replaceAfterOption: OptionReplaceArray = [];

    if (Array.isArray(opt.replaceAfter) ? opt.replaceAfter.length > 0 : Object.keys(opt.replaceAfter).length > 0) {
        replaceAfterOption = formatReplaceOption(opt.replaceAfter);
    }

    if (replaceAfterOption.length > 0) {
        // finalIgnoreRanges is used here. It's correctly based on `input` after potential `replaceBefore`.
        input = replaceString(input, replaceAfterOption, finalIgnoreRanges);
    }

    return input;
};

export default transliterate;
