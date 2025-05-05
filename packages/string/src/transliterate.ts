import charmap from "./charmap/index.js";
import type { Charmap,IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionReplaceObject, OptionsTransliterate } from "./types";
import { escapeRegExp, findStrOccurrences as findStringOccurrences, hasChinese, hasPunctuationOrSpace, replaceString } from "./utils";

export const defaultOptions: Required<OptionsTransliterate> = {
    fixChineseSpacing: true,
    ignore: [],
    replace: [],
    replaceAfter: [],
    trim: false,
    unknown: "",
};

/**
 * Converts the object version of the 'replace' option into tuple array one.
 */
function formatReplaceOption(option: OptionReplaceCombined): OptionReplaceArray {
    if (Array.isArray(option)) {
        return structuredClone(option);
    }
    const replaceArray: OptionReplaceArray = [];
    for (const key in option as OptionReplaceObject) {
        /* istanbul ignore else */
        if (Object.prototype.hasOwnProperty.call(option, key)) {
            const value = (option as OptionReplaceObject)[key];
            // Ensure value is a string before pushing
            if (typeof value === "string") {
                replaceArray.push([key, value]);
            }
        }
    }
    return replaceArray;
}

/**
 * Main transliterate function.
 * Replaces characters in a string based on a charmap and options.
 *
 * @param source The string which is being transliterated.
 * @param options Options object.
 * @returns The transliterated string.
 */
const transliterate = (source: string, options?: OptionsTransliterate): string => {
    const optionsInput = typeof options === "object" ? options : {};
    const opt: Required<OptionsTransliterate> = structuredClone({
        ...defaultOptions,
        ...optionsInput,
    });

    let string_ = typeof source === "string" ? source : String(source);
    const currentCharmap: Charmap = charmap;
    const replaceOption: OptionReplaceArray = formatReplaceOption(opt.replace);

    // 1. Calculate ignore ranges based on the ORIGINAL string
    const ignoreRanges: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(string_, opt.ignore) : [];

    // 2. Pre-charmap replacements using the IMPORTED replaceString
    if (replaceOption.length > 0) {
        string_ = replaceString(string_, replaceOption, ignoreRanges);
    }

    // 3. Character by character loop
    let result = "";
    const stringLength = string_.length;
    const stringContainsChinese = opt.fixChineseSpacing && hasChinese(string_);
    let lastCharWasChinese = false;

    for (let index = 0; index < stringLength; ) {
        let char: string;
        let charLength = 1;

        // Handle surrogate pairs
        const currentCode = string_.charCodeAt(index);
        if (currentCode >= 0xd8_00 && currentCode <= 0xdb_ff && index + 1 < stringLength) {
            const nextCode = string_.charCodeAt(index + 1);
            if (nextCode >= 0xdc_00 && nextCode <= 0xdf_ff) {
                char = string_[index]! + string_[index + 1]!;
                charLength = 2;
            } else {
                char = string_[index]!;
            }
        } else {
            char = string_[index]!;
        }

        let s: string;
        const charEndIndex = index + charLength - 1;
        const isIgnored = ignoreRanges.some((range) => index >= range[0] && charEndIndex <= range[1]);

        if (isIgnored) {
            s = char; // Keep original character if ignored
        } else {
            // Apply charmap or use opt.unknown
            if (hasChinese(char)) {
                s = char; // Pass CJK characters through directly
            } else {
                const found = Object.prototype.hasOwnProperty.call(currentCharmap, char);
                s = found ? currentCharmap[char]! : opt.unknown;
            }
        }

        // Handle Chinese spacing
        if (!isIgnored && stringContainsChinese) {
            const sIsDefined = typeof s === "string";
            const originalCharIsChinese = hasChinese(char);
            if (lastCharWasChinese && !originalCharIsChinese && sIsDefined && s.length > 0 && !hasPunctuationOrSpace(s[0]!)) {
                s = " " + s;
            }
            lastCharWasChinese = originalCharIsChinese;
        } else if (isIgnored) {
            lastCharWasChinese = false;
        }

        result += s;
        index += charLength;
    }

    string_ = result; // Update after charmap loop

    // 4. Trim
    if (opt.trim) {
        string_ = string_.trim();
    }

    // 5. Post-charmap replacements using the IMPORTED replaceString
    const replaceAfterOption: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);
    if (replaceAfterOption.length > 0) {
        string_ = replaceString(string_, replaceAfterOption, ignoreRanges);
    }

    return string_;
};

export default transliterate;
