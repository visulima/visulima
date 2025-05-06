import { baseBlocksCharmap, unicodeBlockMap as generatedUnicodeBlockMap } from "./charmap/loader";
import replaceString from "./replace-string";
import type { Charmap, IntervalArray, OptionReplaceArray, OptionReplaceCombined, OptionsTransliterate } from "./types";
import { findStringOccurrences, hasChinese, hasPunctuationOrSpace } from "./utils";

let activeCharmap: Charmap = { ...baseBlocksCharmap };
const loadedBlocks = new Set<string>();

// Uses the unicodeBlockMap imported from the loader
async function getBlockNameForCodepoint(codePoint: number): Promise<string | null> {
    for (const [start, end, blockName] of generatedUnicodeBlockMap) {
        if (codePoint >= start && codePoint <= end) {
            return blockName; // blockName here is like 'block-0400-04ff'
        }
    }

    return null;
}

async function ensureBlockLoaded(codePoint: number): Promise<void> {
    const blockName = await getBlockNameForCodepoint(codePoint);

    if (blockName && !loadedBlocks.has(blockName)) {
        try {
            const blockModule = await import(`./charmap/blocks/${blockName}.ts`);

            activeCharmap = { ...activeCharmap, ...blockModule.default };

            loadedBlocks.add(blockName);
        } catch (error) {
            console.error(`Failed to lazy load charmap block: ${blockName}`, error);

            loadedBlocks.add(blockName);
        }
    }
}

const formatReplaceOption = (option: OptionReplaceCombined): OptionReplaceArray => {
    if (Array.isArray(option)) {
        // Ensure it's a deep clone if modification is a concern, though structuredClone is fine.
        return option.map((entry) => [...entry] as [RegExp | string, string | undefined]);
    }

    const replaceArray: OptionReplaceArray = [];

    for (const key in option as Record<string, string>) {
        if (Object.prototype.hasOwnProperty.call(option, key)) {
            const value = (option as Record<string, string>)[key];
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
 * @returns The transliterated string as a Promise.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const transliterate = async (source: string, options?: OptionsTransliterate): Promise<string> => {
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

    const replaceOptionBefore: OptionReplaceArray = formatReplaceOption(opt.replaceBefore);
    const initialIgnoreRangesBefore: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(input, opt.ignore) : [];
    if (replaceOptionBefore.length > 0) {
        input = replaceString(input, replaceOptionBefore, initialIgnoreRangesBefore);
    }

    const finalIgnoreRanges: IntervalArray = opt.ignore.length > 0 ? findStringOccurrences(input, opt.ignore) : [];

    let result = "";
    const stringLength = input.length;
    let lastCharWasChinese = false;

    for (let index = 0; index < stringLength; ) {
        let char: string;
        let charLength = 1;

        const currentCode = input.charCodeAt(index);
        if (currentCode >= 0xd8_00 && currentCode <= 0xdb_ff && index + 1 < stringLength) {
            const nextCode = input.charCodeAt(index + 1);
            if (nextCode >= 0xdc_00 && nextCode <= 0xdf_ff) {
                char = input[index]! + input[index + 1]!;
                charLength = 2;
            } else {
                char = input[index]!;
            }
        } else {
            char = input[index]!;
        }

        let s: string | null | undefined;
        const charEndIndex = index + charLength - 1;
        const isIgnored = finalIgnoreRanges.some((range) => !(range[1] < index || range[0] > charEndIndex));

        if (isIgnored) {
            s = char;
        } else {
            const codePoint = char.codePointAt(0);
            if (codePoint === undefined) {
                s = opt.unknown;
            } else {
                await ensureBlockLoaded(codePoint);
                const codePointString = String(codePoint);
                s = activeCharmap[codePointString];

                if (s === undefined) {
                    s = hasChinese(char) ? char : opt.unknown;
                } else if (s === null) {
                    s = opt.unknown;
                }
            }
        }

        const determinedCharWasChinese = !isIgnored && hasChinese(char);
        if (opt.fixChineseSpacing && !isIgnored) {
            const sIsDefinedAndNotEmpty = typeof s === "string" && s.length > 0;

            if (
                lastCharWasChinese &&
                ((determinedCharWasChinese && sIsDefinedAndNotEmpty) ||
                    (!determinedCharWasChinese && sIsDefinedAndNotEmpty && s[0] && !hasPunctuationOrSpace(s[0])))
            ) {
                result += " ";
            }

            lastCharWasChinese = determinedCharWasChinese;
        } else {
            lastCharWasChinese = false;
        }

        result += s;
        index += charLength;
    }

    input = result;

    if (opt.trim) {
        input = input.trim();
    }

    const replaceOptionAfter: OptionReplaceArray = formatReplaceOption(opt.replaceAfter);

    if (replaceOptionAfter.length > 0) {
        input = replaceString(input, replaceOptionAfter, finalIgnoreRanges);
    }

    return input;
};

export default transliterate;
