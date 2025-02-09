import type { SplitByCase } from "./types";
import { splitByWords, type SplitOptions } from "./utils/case-helpers";

/**
 * Splits a string into "words" by:
 * – first splitting on any explicit separator (by default: "-", "_", "/", "." and space)
 * – then breaking on camel–case boundaries (including between digits and letters)
 * – and finally handling "acronym boundaries" so that for example:
 *
 *     "FOOBar"   → [ "FOO", "Bar" ]
 *     "ABCdef"   → [ "ABC", "def" ]
 *     "ATest"    → [ "A", "Test" ]
 *     "FooBARb"  → [ "Foo", "BAR", "b" ]
 *     "FIZz"     → [ "FI", "Zz" ]  (because "FIZ" isn't "known")
 *
 * The options allow you to supply:
 * – a custom list of separators,
 * – a list of known acronyms (for which an uppercase run is kept intact),
 * – and a "normalize" flag (if true, any "all–uppercase" token not in the known list is title–cased).
 *
 * @example
 *   splitByCase("XMLHttpRequest")
 *     // → [ "XML", "Http", "Request" ]
 *
 *   splitByCase("foo\Bar.fuzz-FIZz", { separators: ["\\",".","-"] })
 *     // → [ "foo", "Bar", "fuzz", "FI", "Zz" ]
 */
export const splitByCase = <T extends string = string>(input: T, splitOptions?: SplitOptions): SplitByCase<T> => {
    if (typeof input !== "string" || input === "") {
        return [] as unknown as SplitByCase<T>;
    }

    return splitByWords(input, splitOptions) as unknown as SplitByCase<T>;
};

export type { SplitOptions };
