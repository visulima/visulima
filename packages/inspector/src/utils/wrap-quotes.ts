import type { Options } from "../types";

const wrapQuotes = (string_: string, options: Options): string => {
    const quoteChar = options.quoteStyle === "double" ? "\"" : "'";

    if (options.quoteStyle === "double") {
        // eslint-disable-next-line no-param-reassign
        string_ = string_.replaceAll("\"", "\"");
    }

    return quoteChar + string_ + quoteChar;
};

export default wrapQuotes;
