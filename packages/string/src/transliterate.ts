import charmap from "./charmap";
import replaceString from "./replace-string";
import type { Charmap, IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionReplaceObject, OptionsTransliterate } from "./types";
import { findStringOccurrences, hasChinese, hasPunctuationOrSpace } from "./utils";
/**
 * Converts the object version of the 'replace' option into tuple array one.
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

    const currentCharmap: Charmap = charmap;
    const replaceOption: OptionReplaceArray = formatReplaceOption(opt.replaceBefore);

    const initialIgnoreRanges: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(input, opt.ignore) : [];

    if (replaceOption.length > 0) {
        input = replaceString(input, replaceOption, initialIgnoreRanges);
    }

    const finalIgnoreRanges: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(input, opt.ignore) : [];

    let result = "";

    const stringLength = input.length;
    const stringContainsChinese = opt.fixChineseSpacing && hasChinese(input);

    let lastCharWasChinese = false;

    for (let index = 0; index < stringLength; ) {
        let char: string;
        let charLength = 1;

        // Handle surrogate pairs
        // eslint-disable-next-line unicorn/prefer-code-point
        const currentCode = input.charCodeAt(index);

        if (currentCode >= 0xd8_00 && currentCode <= 0xdb_ff && index + 1 < stringLength) {
            // eslint-disable-next-line unicorn/prefer-code-point
            const nextCode = input.charCodeAt(index + 1);

            if (nextCode >= 0xdc_00 && nextCode <= 0xdf_ff) {
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

        let s: string | null | undefined;

        const charEndIndex = index + charLength - 1;
        const isIgnored = finalIgnoreRanges.some(
            (range) =>
                // Check for overlap: !(rangeEnd < charStart || rangeStart > charEnd)
                !(range[1] < index || range[0] > charEndIndex),
        );

        if (isIgnored) {
            s = char; // Keep original character if ignored
        } else {
            const codePoint = char.codePointAt(0);

            if (codePoint === undefined) {
                // Handle cases where codePointAt returns undefined (shouldn't happen with valid strings)
                s = opt.unknown;
            } else {
                const codePointString = String(codePoint); // Convert to string for lookup
                const found = Object.prototype.hasOwnProperty.call(currentCharmap, codePointString);

                if (found) {
                    s = currentCharmap[codePointString as keyof Charmap]; // Use mapping if found (using string key)
                } else if (hasChinese(char)) {
                    s = char; // Keep original if it's Chinese and unmapped
                }
            }

            // Fallback if still no value for s
            if (s === undefined || s === null) {
                // Check for undefined OR null from charmap
                s = opt.unknown; // Use unknown for other unmapped characters
            }
        }

        // Handle Chinese spacing
        const determinedCharWasChinese = !isIgnored && hasChinese(char); // True if current original char is Chinese and not ignored

        if (opt.fixChineseSpacing && !isIgnored) {
            // Only apply spacing logic if fixChineseSpacing is true and char is not ignored
            const sIsDefinedAndNotEmpty = typeof s === "string" && s.length > 0;

            if (lastCharWasChinese) {
                // If the previous character successfully processed was Chinese
                if (determinedCharWasChinese && sIsDefinedAndNotEmpty) {
                    // Prev Chinese, Current Chinese: "CN CN" -> Add space before current `s`
                    result += " ";
                } else if (!determinedCharWasChinese && sIsDefinedAndNotEmpty && s[0] && !hasPunctuationOrSpace(s[0] as string)) {
                    // Prev Chinese, Current NOT Chinese (and not a leading space/punct in `s`): "CN EN" -> Add space before current `s`
                    result += " ";
                }
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

    const replaceAfterOption: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);

    if (replaceAfterOption.length > 0) {
        input = replaceString(input, replaceAfterOption, finalIgnoreRanges);
    }

    return input;
};

export default transliterate;
