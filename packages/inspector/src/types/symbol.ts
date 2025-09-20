import type { InspectType } from "../types";

// eslint-disable-next-line no-control-regex, sonarjs/no-control-regex, no-misleading-character-class, sonarjs/no-misleading-character-class
const symbolEscapeChars = /[\0-\u001F\u007F-\u009F\u00AD\u0600-\u0604\u070F\u17B4\u17B5\u200C-\u200F\u2028-\u202F\u2060-\u206F\uFEFF\uFFF0-\uFFFF]/g;

const escapeCharacters = {
    "\t": String.raw`\t`,
    "\n": String.raw`\n`,
    "\f": String.raw`\f`,
    "\r": String.raw`\r`,
    "\b": String.raw`\b`,
    "\\": "\\\\",
} as const;

const hex = 16;
const unicodeLength = 4;

const escapeSymbolChar = (char: string): string =>
    escapeCharacters[char as keyof typeof escapeCharacters] || `\\u${`0000${(char.codePointAt(0) as number).toString(hex)}`.slice(-unicodeLength)}`;

const escapeSymbolDescription = (description: string): string => {
    if (symbolEscapeChars.test(description)) {
        return description.replaceAll(symbolEscapeChars, escapeSymbolChar);
    }

    return description;
};

const inspectSymbol: InspectType<symbol> = (value: symbol): string => {
    if ("description" in Symbol.prototype) {
        const { description } = value;

        if (description) {
            return `Symbol(${escapeSymbolDescription(description)})`;
        }

        return "Symbol()";
    }

    return value.toString();
};

export default inspectSymbol;
