import charmap from "./charmap/index.js";
import type { Charmap,IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionReplaceObject, OptionsTransliterate } from "./types";
import { escapeRegExp, findStrOccurrences as findStringOccurrences, hasChinese, hasPunctuationOrSpace,regexpReplaceCustom } from "./utils";

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
 * Search and replace a list of strings/regexps and return the result string.
 */
function replaceString(source: string, searches: OptionReplaceArray, ignoreRanges: IntervalArray): string {
    const clonedSearches = structuredClone(searches);
    let result = source;

    for (const item of clonedSearches) {
        if (!item || item.length < 2) 
continue;

        const [searchKey, replacementValue] = item;
        if (replacementValue === undefined) 
continue;

        let searchPattern: RegExp;
        switch (true) {
            case searchKey instanceof RegExp: {
                searchPattern = new RegExp(searchKey.source, `${searchKey.flags.replace("g", "")}g`);
                break;
            }
            case typeof searchKey === "string" && searchKey.length > 0: {
                searchPattern = new RegExp(escapeRegExp(searchKey), "g");
                break;
            }
            default: {
                searchPattern = /[^\s\S]/;
            } // Prevent ReDos attack
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
    const optionsInput = typeof options === "object" ? options : {};
    const opt: Required<OptionsTransliterate> = structuredClone({
        ...defaultOptions,
        ...optionsInput,
    });

    let string_ = typeof source === "string" ? source : String(source);
    const currentCharmap: Charmap = charmap;

    // --- DEBUG: Re-check specific charmap entries ---
    console.log("Re-checking charmap values inside function:");
    console.log(`  U+0679 (ٹ) -> ${currentCharmap["\u0679"]}`); 
    console.log(`  U+0688 (ڈ) -> ${currentCharmap["\u0688"]}`);
    console.log(`  U+06BE (ھ) -> ${currentCharmap["\u06BE"]}`);
    console.log(`  U+06AB (ګ) -> ${currentCharmap["\u06AB"]}`);
    console.log(`  U+0693 (ړ) -> ${currentCharmap["\u0693"]}`);
    console.log(`  U+0685 (څ) -> ${currentCharmap["\u0685"]}`);
    // --- END DEBUG ---

    // 1. Calculate ignore ranges based on the ORIGINAL string
    const ignoreRanges: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(string_, opt.ignore) : [];

    // 2. Pre-charmap replacements (respecting original ignore ranges)
    const replaceOption: OptionReplaceArray = formatReplaceOption(opt.replace);
    if (replaceOption.length > 0) {
        string_ = replaceString(string_, replaceOption, ignoreRanges);
    }

    // 3. Reverted to manual character iteration
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
        // Check if the *entire* character falls within an ignore range
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

        // Handle Chinese spacing (only if not ignored)
        if (!isIgnored && stringContainsChinese) {
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
        index += charLength; // Increment by character length
    }

    string_ = result; // Update str after charmap loop

    // 4. Trim
    if (opt.trim) {
        string_ = string_.trim();
    }

    // 5. Post-charmap replacements (respecting original ignore ranges)
    const replaceAfterOption: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);
    if (replaceAfterOption.length > 0) {
        string_ = replaceString(string_, replaceAfterOption, ignoreRanges);
    }

    return string_;
};

export default transliterate;
