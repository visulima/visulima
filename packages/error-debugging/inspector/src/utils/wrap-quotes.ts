import type { Options } from "../types";

const wrapQuotes = (string_: string, options: Options): string => {
    const quoteChar = options.quoteStyle === "double" ? "\"" : "'";

    // Embedded double quotes are intentionally left as-is (see the
    // "does not escape double quotes" test); only the surrounding quote
    // character differs by quoteStyle.
    return quoteChar + string_ + quoteChar;
};

export default wrapQuotes;
