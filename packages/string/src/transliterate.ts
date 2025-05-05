import type { IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionReplaceObject, OptionsTransliterate, Charmap } from "./types";

import charmap from "./charmap/index";
import { escapeRegExp, findStrOccurrences, inRange, hasChinese, regexpReplaceCustom, hasPunctuationOrSpace } from "./utils";

export const defaultOptions: Required<OptionsTransliterate> = {
    ignore: [],
    replace: [],
    replaceAfter: [],
    trim: false,
    unknown: "",
    fixChineseSpacing: true,
};

/**
 * Converts the object version of the 'replace' option into tuple array one.
 */
function formatReplaceOption(option: OptionReplaceCombined): OptionReplaceArray {
    if (option instanceof Array) {
        return structuredClone(option);
    }
    const replaceArr: OptionReplaceArray = [];
    for (const key in option as OptionReplaceObject) {
        /* istanbul ignore else */
        if (Object.prototype.hasOwnProperty.call(option, key)) {
            const value = (option as OptionReplaceObject)[key];
            // Ensure value is a string before pushing
            if (typeof value === "string") {
                replaceArr.push([key, value]);
            }
        }
    }
    return replaceArr;
}

/**
 * Search and replace a list of strings/regexps and return the result string.
 */
function replaceString(source: string, searches: OptionReplaceArray, ignoreRanges: IntervalArray): string {
    const clonedSearches = structuredClone(searches);
    let result = source;

    for (let i = 0; i < clonedSearches.length; i++) {
        const item = clonedSearches[i];
        if (!item || item.length < 2) continue;

        const [searchKey, replacementValue] = item;
        if (replacementValue === undefined) continue;

        let searchPattern: RegExp;
        switch (true) {
            case searchKey instanceof RegExp:
                searchPattern = new RegExp(searchKey.source, `${searchKey.flags.replace("g", "")}g`);
                break;
            case typeof searchKey === "string" && searchKey.length > 0:
                searchPattern = new RegExp(escapeRegExp(searchKey), "g");
                break;
            default:
                searchPattern = /[^\s\S]/; // Prevent ReDos attack
        }
        result = regexpReplaceCustom(result, searchPattern, replacementValue, ignoreRanges);
    }
    return result;
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
    const optsInput = typeof options === "object" ? options : {};
    const opt: Required<OptionsTransliterate> = structuredClone({
        ...defaultOptions,
        ...optsInput,
    });

    let str = typeof source === "string" ? source : String(source);
    const currentCharmap: Charmap = charmap;

    // 1. Calculate ignore ranges based on the ORIGINAL string
    const ignoreRanges: IntervalArray = opt.ignore.length > 0 ? findStrOccurrences(str, opt.ignore) : [];

    // 2. Pre-charmap replacements (respecting original ignore ranges)
    const replaceOption: OptionReplaceArray = formatReplaceOption(opt.replace);
    if (replaceOption.length) {
        str = replaceString(str, replaceOption, ignoreRanges);
    }

    // 3. Charmap replacement (character by character, respecting ignore ranges)
    let result = "";
    const strLength = str.length;
    const strContainsChinese = opt.fixChineseSpacing && hasChinese(str); // Check potentially modified string
    let lastCharWasChinese = false;

    for (let index = 0; index < strLength; ) {
        let char: string;
        let charLength = 1;

        // Handle surrogate pairs
        const currentCode = str.charCodeAt(index);
        if (currentCode >= 0xd800 && currentCode <= 0xdbff && index + 1 < strLength) {
            const nextCode = str.charCodeAt(index + 1);
            if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
                char = str[index]! + str[index + 1]!;
                charLength = 2;
            } else {
                char = str[index]!;
            }
        } else {
            char = str[index]!;
        }

        let s: string;
        const charEndIndex = index + charLength - 1;
        // Check if the *entire* character falls within an ignore range
        const isIgnored = ignoreRanges.some(range => index >= range[0] && charEndIndex <= range[1]);

        if (isIgnored) {
            s = char; // Keep original character if ignored
        } else {
            // Apply charmap or use opt.unknown
            if (hasChinese(char)) {
                s = char; // Pass CJK characters through directly
            } else {
                const found = Object.prototype.hasOwnProperty.call(currentCharmap, char);
                s = found
                    ? currentCharmap[char]!
                    : opt.unknown; // Use opt.unknown directly
            }
        }

        // Handle Chinese spacing (only if not ignored)
        if (!isIgnored && strContainsChinese) {
            const sIsDefined = typeof s === "string";
            const originalCharIsChinese = hasChinese(char);
            if (lastCharWasChinese && !originalCharIsChinese && sIsDefined && s.length > 0 && !hasPunctuationOrSpace(s[0]!)) {
                s = " " + s;
            }
            lastCharWasChinese = originalCharIsChinese;
        } else if (isIgnored) {
            // Reset Chinese flag if we are in an ignored segment
            lastCharWasChinese = false;
        }

        result += s;
        index += charLength;
    }

    str = result; // Update str after charmap loop

    // 4. Trim
    if (opt.trim) {
        str = str.trim();
    }

    // 5. Post-charmap replacements (respecting original ignore ranges)
    const replaceAfterOption: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);
    if (replaceAfterOption.length) {
        str = replaceString(str, replaceAfterOption, ignoreRanges);
    }

    return str;
};

export default transliterate;
