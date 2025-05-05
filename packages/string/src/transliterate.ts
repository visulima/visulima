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
function replaceString(source: string, searches: OptionReplaceArray, ignore: string[]): string {
    const clonedSearches = structuredClone(searches);
    let result = source;
    const ignoreList = ignore;

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
        result = regexpReplaceCustom(result, searchPattern, replacementValue, ignoreList);
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
    // Merge options with defaults ensuring all required fields are present
    const opt: Required<OptionsTransliterate> = structuredClone({
        ...defaultOptions,
        ...optsInput,
    });

    let str = typeof source === "string" ? source : String(source);
    const currentCharmap: Charmap = charmap;

    // 1. Pre-charmap replacements
    const replaceOption: OptionReplaceArray = formatReplaceOption(opt.replace);
    if (replaceOption.length) {
        str = replaceString(str, replaceOption, opt.ignore);
    }

    // 2. Calculate ignore ranges
    const ignoreRanges: IntervalArray = opt.ignore.length > 0 ? findStrOccurrences(str, opt.ignore) : [];

    // 3. Charmap replacement (incorporating codeMapReplace logic)
    let index = 0;
    let result = "";
    const strContainsChinese = opt.fixChineseSpacing && hasChinese(str);
    let lastCharHasChinese = false;
    const unknownChar = opt.unknown;

    for (let i = 0; i < str.length; i++) {
        const currentIndex = i;
        const nextIndex = i + 1;
        let char: string;
        if (currentIndex < str.length && nextIndex < str.length && /[\uD800-\uDBFF]/.test(str[currentIndex]!) && /[\uDC00-\uDFFF]/.test(str[nextIndex]!)) {
            char = str[currentIndex]! + str[nextIndex]!;
            i++;
        } else if (currentIndex < str.length) {
            char = str[currentIndex]!;
        } else {
            break;
        }

        let s: string;
        let ignoreFixingChinese = false;
        switch (true) {
            case inRange(index, ignoreRanges):
            case char.length === 2 && inRange(index + 1, ignoreRanges):
                s = char;
                if (!ignoreRanges.find((range) => range[1] >= index && range[0] === index)) {
                    ignoreFixingChinese = true;
                }
                break;
            default:
                s = Object.prototype.hasOwnProperty.call(currentCharmap, char) ? currentCharmap[char]! : unknownChar;
        }

        if (strContainsChinese) {
            const sIsDefined = typeof s === "string";

            if (lastCharHasChinese && !ignoreFixingChinese && sIsDefined && !hasPunctuationOrSpace(s)) {
                s = " " + s;
            }

            lastCharHasChinese = !!s && typeof char === "string" && hasChinese(char);
        }

        result += typeof s === "string" ? s : "";

        index += char.length;
    }

    str = result; // Update str with charmap result

    // 4. Trim
    if (opt.trim) {
        str = str.trim();
    }

    // 5. Post-charmap replacements
    const replaceAfterOption: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);

    if (replaceAfterOption.length) {
        // Assuming post-replace doesn't need ignore list based on previous logic
        str = replaceString(str, replaceAfterOption, []);
    }

    return str;
};

export default transliterate;
