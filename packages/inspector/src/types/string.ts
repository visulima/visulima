import type { Options } from "../types";
import truncate from "../utils/truncate";
import wrapQuotes from "../utils/wrap-quotes";

// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex, no-misleading-character-class, sonarjs/no-misleading-character-class
const stringEscapeChars = /['\0-\u001F\u007F-\u009F\u00AD\u0600-\u0604\u070F\u17B4\u17B5\u200C-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\uFFF0-\uFFFF]/g;

const escapeCharacters = {
    "\t": String.raw`\t`,
    "\n": String.raw`\n`,
    "\f": String.raw`\f`,
    "\r": String.raw`\r`,
    "\b": String.raw`\b`,
    "'": String.raw`\'`,
    "\\": "\\\\",
} as const;

const hex = 16;
const unicodeLength = 4;

const escape = (char: string): string =>

    escapeCharacters[char as keyof typeof escapeCharacters] || `\\u${`0000${(char.codePointAt(0) as number).toString(hex)}`.slice(-unicodeLength)}`;

const inspectString = (string_: string, options: Options): string => {
    if (stringEscapeChars.test(string_)) {
        // eslint-disable-next-line no-param-reassign
        string_ = string_.replaceAll(stringEscapeChars, escape);
    }

    return options.stylize(wrapQuotes(truncate(string_, options.maxStringLength - 2), options), "string");
};

export default inspectString;
