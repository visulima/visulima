/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-use-before-define */

/**
 * YAML 1.2 serializer.
 *
 * Emits block style by default and falls back to flow style for empty
 * collections (and for anything nested deeper than `flowLevel`). Scalar style
 * is chosen automatically: plain when safe, single-quoted when it only needs
 * escaping of quotes, literal (`|`) for multi-line strings, and double-quoted
 * for anything containing control characters.
 */

import { YAMLStringifyError } from "../errors";
import { resolvePlainScalar } from "../schema/resolve-scalar";
import type { StringifyOptions } from "../types";

interface DumpContext {
    flowLevel: number;
    forceQuotes: boolean;
    indent: number;
    replacer?: (key: string, value: unknown) => unknown;
    skipInvalid: boolean;
    sortKeys: boolean | ((a: string, b: string) => number);
    stack: Set<object>;
}

// C0 controls (excluding TAB/LF which are stripped before this test), DEL,
// C1 controls, LINE/PARAGRAPH separators and non-characters force double quoting.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029\uFFFE\uFFFF]/;

// Characters that may not start a plain scalar (using \u escapes for the
// quote/backtick/backslash members so both prettier and eslint stay happy).
const PLAIN_LEADING_INDICATORS = new Set("!\u0022#%&'*,-:>?@[\\]\u0060{|}");

const LEADING_TRAILING_WS = /^\s|\s$/;
const NEWLINE_OR_TAB = /[\n\t]/;
const MAPPING_OR_COMMENT = /:[ \t]|:$|[ \t]#/;
const FLOW_INDICATORS = /[,[\]{}]/;
const LEADING_WS = /^\s/;
const TRAILING_INLINE_WS = /[ \t]$/;
// A single-character class with `+$` cannot backtrack catastrophically.
// eslint-disable-next-line sonarjs/slow-regex
const TRAILING_NEWLINES = /\n+$/;
const NEWLINE_OR_TAB_GLOBAL = /[\n\t]/g;
const TAB = /\t/;

const indentOf = (level: number, context: DumpContext): string => " ".repeat(level * context.indent);

const compareStrings = (a: string, b: string): number => {
    if (a < b) {
        return -1;
    }

    if (a > b) {
        return 1;
    }

    return 0;
};

const isPlainSafe = (value: string, inFlow: boolean): boolean => {
    if (value.length === 0) {
        return false;
    }

    if (PLAIN_LEADING_INDICATORS.has(value[0]!)) {
        return false;
    }

    if (LEADING_TRAILING_WS.test(value)) {
        return false;
    }

    if (NEWLINE_OR_TAB.test(value)) {
        return false;
    }

    // `: ` (or a trailing colon) starts a mapping; ` #` starts a comment.
    if (MAPPING_OR_COMMENT.test(value)) {
        return false;
    }

    if (inFlow && FLOW_INDICATORS.test(value)) {
        return false;
    }

    return true;
};

const wouldResolveToNonString = (value: string): boolean => resolvePlainScalar(value).resolved;

const writeSingleQuoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const writeDoubleQuoted = (value: string, forceQuotes: boolean): string => {
    let result = "";

    for (const char of value) {
        const code = char.codePointAt(0)!;

        switch (char) {
            case "\n": {
                result += String.raw`\n`;
                break;
            }
            case "\t": {
                result += String.raw`\t`;
                break;
            }
            case "\r": {
                result += String.raw`\r`;
                break;
            }
            case "\0": {
                result += String.raw`\0`;
                break;
            }
            case "\f": {
                result += String.raw`\f`;
                break;
            }
            case "\v": {
                result += String.raw`\v`;
                break;
            }
            case "\b": {
                result += String.raw`\b`;
                break;
            }
            case "\u001B": {
                result += String.raw`\e`;
                break;
            }
            case "\u0022": {
                result += String.raw`\"`;
                break;
            }
            case "\\": {
                result += "\\\\";
                break;
            }
            default: {
                const hex = code.toString(16).toUpperCase();

                if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) {
                    result += String.raw`\x${hex.padStart(2, "0")}`;
                } else if (forceQuotes && code > 0x7e) {
                    result += code <= 0xff ? String.raw`\x${hex.padStart(2, "0")}` : String.raw`\u${hex.padStart(4, "0")}`;
                } else {
                    result += char;
                }
            }
        }
    }

    return `"${result}"`;
};

const writeLiteral = (value: string, level: number, context: DumpContext): string => {
    const contentIndent = indentOf(level + 1, context);

    let chomp = "";
    let content = value;

    if (!value.endsWith("\n")) {
        chomp = "-";
    } else if (value.endsWith("\n\n")) {
        chomp = "+";
    } else {
        content = value.slice(0, -1);
    }

    const body = content
        .split("\n")
        .map((line) => {
            if (line === "") {
                return "";
            }

            return contentIndent + line;
        })
        .join("\n");

    return `|${chomp}\n${body}`;
};

const writeScalar = (value: string, level: number, context: DumpContext, inFlow: boolean): string => {
    if (value === "") {
        return "\u0022\u0022";
    }

    if (CONTROL_CHARS.test(value.replaceAll(NEWLINE_OR_TAB_GLOBAL, ""))) {
        return writeDoubleQuoted(value, context.forceQuotes);
    }

    if (context.forceQuotes) {
        return writeDoubleQuoted(value, true);
    }

    const hasNewline = value.includes("\n");

    if (hasNewline) {
        if (!inFlow && !LEADING_WS.test(value) && !TRAILING_INLINE_WS.test(value.replace(TRAILING_NEWLINES, ""))) {
            return writeLiteral(value, level, context);
        }

        return writeDoubleQuoted(value, false);
    }

    if (isPlainSafe(value, inFlow) && !wouldResolveToNonString(value)) {
        return value;
    }

    if (TAB.test(value)) {
        return writeDoubleQuoted(value, false);
    }

    return writeSingleQuoted(value);
};

const representNumber = (value: number): string => {
    if (Number.isNaN(value)) {
        return ".nan";
    }

    if (value === Number.POSITIVE_INFINITY) {
        return ".inf";
    }

    if (value === Number.NEGATIVE_INFINITY) {
        return "-.inf";
    }

    if (Object.is(value, -0)) {
        return "-0";
    }

    return String(value);
};

const sortedEntries = (object: Record<string, unknown>, context: DumpContext): [string, unknown][] => {
    const entries = Object.entries(object);

    if (context.sortKeys === true) {
        entries.sort(([a], [b]) => compareStrings(a, b));
    } else if (typeof context.sortKeys === "function") {
        const comparator = context.sortKeys;

        entries.sort(([a], [b]) => comparator(a, b));
    }

    return entries;
};

const isBlockCollection = (value: unknown): boolean => {
    if (Array.isArray(value)) {
        return value.length > 0;
    }

    return typeof value === "object" && value !== null && Object.keys(value).length > 0;
};

const applyReplacer = (context: DumpContext, key: string, value: unknown): unknown => {
    let output = value;

    if (output !== null && typeof output === "object" && typeof (output as { toJSON?: unknown }).toJSON === "function") {
        output = (output as { toJSON: () => unknown }).toJSON();
    }

    if (context.replacer) {
        output = context.replacer(key, output);
    }

    return output;
};

const writeFlow = (value: unknown, level: number, context: DumpContext): string => {
    if (Array.isArray(value)) {
        const items = value.map((item) => writeFlow(applyReplacer(context, "", item), level, context));

        return `[${items.join(", ")}]`;
    }

    if (typeof value === "object" && value !== null) {
        const entries = sortedEntries(value as Record<string, unknown>, context);
        const parts = entries.map(([key, item]) => {
            const keyString = writeScalar(key, level, context, true);

            return `${keyString}: ${writeFlow(applyReplacer(context, key, item), level, context)}`;
        });

        return `{${parts.join(", ")}}`;
    }

    return writeLeaf(value, level, context, true);
};

const writeLeaf = (value: unknown, level: number, context: DumpContext, inFlow: boolean): string => {
    if (value === null || value === undefined) {
        return "null";
    }

    switch (typeof value) {
        case "bigint": {
            return value.toString();
        }
        case "boolean": {
            return value ? "true" : "false";
        }
        case "number": {
            return representNumber(value);
        }
        case "string": {
            return writeScalar(value, level, context, inFlow);
        }
        default: {
            if (context.skipInvalid) {
                return "null";
            }

            throw new YAMLStringifyError(`cannot serialize a value of type "${typeof value}"`);
        }
    }
};

const writeNode = (value: unknown, level: number, context: DumpContext): string => {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "[]";
        }

        if (context.flowLevel >= 0 && level >= context.flowLevel) {
            return writeFlow(value, level, context);
        }

        return writeBlockSequence(value, level, context);
    }

    if (typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]") {
        if (Object.keys(value).length === 0) {
            return "{}";
        }

        if (context.flowLevel >= 0 && level >= context.flowLevel) {
            return writeFlow(value, level, context);
        }

        return writeBlockMapping(value as Record<string, unknown>, level, context);
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value) && Object.prototype.toString.call(value) !== "[object Object]") {
        // Dates, class instances, etc. — fall back to their primitive form.
        return writeLeaf(value, level, context, false);
    }

    return writeLeaf(value, level, context, false);
};

const guardCircular = (value: object, context: DumpContext): void => {
    if (context.stack.has(value)) {
        throw new YAMLStringifyError("cannot serialize a circular structure to YAML");
    }
};

const writeBlockSequence = (value: unknown[], level: number, context: DumpContext): string => {
    guardCircular(value, context);
    context.stack.add(value);

    const indent = indentOf(level, context);
    const marker = `-${" ".repeat(context.indent - 1)}`;
    const childPrefixLength = (level + 1) * context.indent;
    const lines: string[] = [];

    for (const [index, element] of value.entries()) {
        const item = applyReplacer(context, String(index), element);

        if (item === undefined && context.skipInvalid) {
            continue;
        }

        if (isBlockCollection(item) && !(context.flowLevel >= 0 && level + 1 >= context.flowLevel)) {
            const child = writeNode(item, level + 1, context);

            lines.push(indent + marker + child.slice(childPrefixLength));
        } else {
            lines.push(indent + marker + writeNode(item, level, context));
        }
    }

    context.stack.delete(value);

    if (lines.length === 0) {
        return "[]";
    }

    return lines.join("\n");
};

const writeBlockMapping = (value: Record<string, unknown>, level: number, context: DumpContext): string => {
    guardCircular(value, context);
    context.stack.add(value);

    const indent = indentOf(level, context);
    const entries = sortedEntries(value, context);
    const lines: string[] = [];

    for (const [key, rawItem] of entries) {
        const item = applyReplacer(context, key, rawItem);

        if (item === undefined && context.skipInvalid) {
            continue;
        }

        const keyString = writeScalar(key, level, context, true);

        if (isBlockCollection(item) && !(context.flowLevel >= 0 && level + 1 >= context.flowLevel)) {
            const child = writeNode(item, level + 1, context);

            lines.push(`${indent + keyString}:\n${child}`);
        } else {
            lines.push(`${indent + keyString}: ${writeNode(item, level, context)}`);
        }
    }

    context.stack.delete(value);

    if (lines.length === 0) {
        return "{}";
    }

    return lines.join("\n");
};

/** Serialize a JavaScript value to a YAML document string. */
// eslint-disable-next-line import/prefer-default-export
export const dump = (value: unknown, options: StringifyOptions = {}): string => {
    const context: DumpContext = {
        flowLevel: options.flowLevel ?? -1,
        forceQuotes: options.forceQuotes ?? false,
        indent: options.indent ?? 2,
        replacer: options.replacer,
        skipInvalid: options.skipInvalid ?? false,
        sortKeys: options.sortKeys ?? false,
        stack: new Set<object>(),
    };

    if (context.indent < 1) {
        throw new YAMLStringifyError("indentation width must be at least 1");
    }

    const root = applyReplacer(context, "", value);

    if (root === undefined) {
        return options.directives ? "---\n" : "\n";
    }

    const body = writeNode(root, 0, context);
    const prefix = options.directives ? "---\n" : "";

    return `${prefix}${body}\n`;
};
