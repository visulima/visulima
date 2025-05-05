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
    const optionsInput = typeof options === "object" ? options : {};
    const opt: Required<OptionsTransliterate> = {
        fixChineseSpacing: true,
        ignore: [],
        replaceAfter: [],
        replaceBefore: [],
        trim: false,
        unknown: "",
        ...optionsInput,
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
        if (!isIgnored && stringContainsChinese) {
            const sIsDefined = typeof s === "string";
            const originalCharIsChinese = hasChinese(char);

            // Original logic: Add space only when transitioning FROM Chinese TO non-Chinese (non-punct)
            if (lastCharWasChinese && !originalCharIsChinese && sIsDefined && s.length > 0 && s[0] && !hasPunctuationOrSpace(s[0] as string)) {
                s = " " + s;
            }

            lastCharWasChinese = originalCharIsChinese;
        } else if (isIgnored) {
            lastCharWasChinese = false; // Reset if current char is ignored
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
