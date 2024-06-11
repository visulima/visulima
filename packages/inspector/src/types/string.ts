import type { InspectType, Options } from "../types";
import truncate from "../utils/truncate";
import wrapQuotes from "../utils/wrap-quotes";

// eslint-disable-next-line no-misleading-character-class,@rushstack/security/no-unsafe-regexp
const stringEscapeChars = new RegExp(
    // eslint-disable-next-line no-useless-concat,regexp/no-control-character
    "['\\0-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0604\\u070f\\u17b4\\u17b5" + "\\u200c-\\u200f\\u2028-\\u202f\\u2060-\\u206f\\ufeff\\ufff0-\\uffff]",
    "g",
);

const escapeCharacters = {
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
    "'": "\\'",
    "\\": "\\\\",
} as const;

const hex = 16;
const unicodeLength = 4;

const escape = (char: string): string =>
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    escapeCharacters[char as keyof typeof escapeCharacters] || `\\u${`0000${(char.codePointAt(0) as number).toString(hex)}`.slice(-unicodeLength)}`;

const inspectString: InspectType<string> = (string_: string, options: Options): string => {
    if (stringEscapeChars.test(string_)) {
        // eslint-disable-next-line no-param-reassign
        string_ = string_.replaceAll(stringEscapeChars, escape);
    }

    return options.stylize(wrapQuotes(`${truncate(string_, options.truncate - 2)}`, options), "string");
};

export default inspectString;
