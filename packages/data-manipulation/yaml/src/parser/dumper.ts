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
import { resolvesToNonString } from "../schema/resolve-scalar";
import type { ScalarTag } from "../schema/tags";
import { stringifyCustomTag } from "../schema/tags";
import type { StringifyOptions } from "../types";

interface DumpContext {
    blockQuote: "folded" | "literal" | boolean;
    collectionStyle: "any" | "block" | "flow";
    customTags?: ScalarTag[];
    falseStr: string;
    flowCollectionPadding: boolean;
    flowLevel: number;
    forceQuotes: boolean;
    indent: number;
    indentSeq: boolean;
    keepUndefined: boolean;
    lineWidth: number;
    nullStr: string;
    replacer?: (key: string, value: unknown) => unknown;
    singleQuote: boolean;
    skipInvalid: boolean;
    sortKeys: boolean | ((a: string, b: string) => number);
    stack: Set<object>;
    trueStr: string;
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

/**
 * Strip trailing newlines without a regex. `/\n+$/` is unanchored at the start,
 * so the engine retries the match at every offset and re-walks the run each
 * time — quadratic on a value ending in many newlines, which untrusted input
 * reaches trivially via a block scalar full of blank lines.
 */
const stripTrailingNewlines = (value: string): string => {
    let end = value.length;

    while (end > 0 && value.codePointAt(end - 1) === 0x0a) {
        end -= 1;
    }

    return end === value.length ? value : value.slice(0, end);
};
const NEWLINE_OR_TAB_GLOBAL = /[\n\t]/g;
const TAB = /\t/;
// Single-line text made of non-space runs joined by exactly one space each — the
// only shape that survives being wrapped into (and folded back out of) a folded
// block scalar without changing its whitespace.
const FOLDABLE_RE = /^\S+(?: \S+)*$/;

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

    // `<<` is the merge key. Emitted plain it is read back as a merge directive
    // instead of a literal key, so the document does not round-trip.
    if (value === "<<") {
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

    if (value.endsWith("\n")) {
        // `dump()` appends a single trailing newline after the whole node, so the
        // body must drop one — for both clip (default) and keep (`+`). Keep is
        // needed whenever there is more than one trailing newline to preserve.
        if (value.endsWith("\n\n")) {
            chomp = "+";
        }

        content = value.slice(0, -1);
    } else {
        chomp = "-";
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

/** Greedily wrap single-spaced words into lines no wider than `width`. */
const foldText = (value: string, width: number): string[] => {
    const words = value.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        if (current === "") {
            current = word;
        } else if (current.length + 1 + word.length <= width) {
            current += ` ${word}`;
        } else {
            lines.push(current);
            current = word;
        }
    }

    if (current !== "") {
        lines.push(current);
    }

    return lines;
};

/**
 * Emit a long single-line string as a folded (`>`) block scalar wrapped to
 * `lineWidth`. Uses strip chomping (`>-`) because the source has no trailing
 * newline, so parsing folds the introduced breaks back into single spaces and
 * reproduces the original value exactly.
 */
const writeFolded = (value: string, level: number, context: DumpContext): string => {
    const contentIndent = indentOf(level + 1, context);
    const width = Math.max(1, context.lineWidth - contentIndent.length);
    const body = foldText(value, width)
        .map((line) => contentIndent + line)
        .join("\n");

    return `>-\n${body}`;
};

const shouldFold = (value: string, level: number, context: DumpContext): boolean => {
    if (context.lineWidth <= 0) {
        return false;
    }

    // Cheapest gate first: only long values are worth the space/shape checks.
    const available = context.lineWidth - (level + 1) * context.indent;

    if (value.length <= available) {
        return false;
    }

    return value.includes(" ") && FOLDABLE_RE.test(value);
};

// eslint-disable-next-line sonarjs/cognitive-complexity
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
        const blockAllowed = context.blockQuote !== false && !inFlow && !LEADING_WS.test(value) && !TRAILING_INLINE_WS.test(stripTrailingNewlines(value));

        if (blockAllowed) {
            // `folded` still falls back to literal when the text cannot be
            // folded without changing its whitespace.
            if (context.blockQuote === "folded" && FOLDABLE_RE.test(value.replaceAll("\n", " "))) {
                return writeFolded(value.replaceAll("\n", " "), level, context);
            }

            return writeLiteral(value, level, context);
        }

        return writeDoubleQuoted(value, false);
    }

    // `singleQuote` only chooses *how* to quote, never *whether* to — a plain
    // key must stay plain, as it does in `yaml`.
    if (isPlainSafe(value, inFlow) && !resolvesToNonString(value)) {
        if (!inFlow && shouldFold(value, level, context)) {
            return writeFolded(value, level, context);
        }

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
    const tagged = stringifyCustomTag(context.customTags, value);

    if (tagged !== undefined) {
        return tagged;
    }

    if (Array.isArray(value)) {
        // Flow output needs the same cycle guard as the block writers: a parsed
        // document can legitimately contain shared/self-referential nodes
        // (`&a [ *a ]`), and without this the recursion exhausts the stack with a
        // RangeError instead of a YAMLStringifyError.
        guardCircular(value, context);
        context.stack.add(value);

        const items = value.map((item, index) => writeFlow(applyReplacer(context, String(index), item), level, context));

        context.stack.delete(value);

        return context.flowCollectionPadding ? `[ ${items.join(", ")} ]` : `[${items.join(", ")}]`;
    }

    if (typeof value === "object" && value !== null) {
        guardCircular(value, context);
        context.stack.add(value);

        const entries = sortedEntries(value as Record<string, unknown>, context);
        const parts = entries.map(([key, item]) => {
            const keyString = writeScalar(key, level, context, true);

            return `${keyString}: ${writeFlow(applyReplacer(context, key, item), level, context)}`;
        });

        context.stack.delete(value);

        return context.flowCollectionPadding ? `{ ${parts.join(", ")} }` : `{${parts.join(", ")}}`;
    }

    return writeLeaf(value, level, context, true);
};

const writeLeaf = (value: unknown, level: number, context: DumpContext, inFlow: boolean): string => {
    if (value === null || value === undefined) {
        return context.nullStr;
    }

    switch (typeof value) {
        case "bigint": {
            return value.toString();
        }
        case "boolean": {
            return value ? context.trueStr : context.falseStr;
        }
        case "number": {
            return representNumber(value);
        }
        case "string": {
            return writeScalar(value, level, context, inFlow);
        }
        default: {
            if (context.skipInvalid) {
                return context.nullStr;
            }

            throw new YAMLStringifyError(`cannot serialize a value of type "${typeof value}"`);
        }
    }
};

const writeNode = (value: unknown, level: number, context: DumpContext): string => {
    const tagged = stringifyCustomTag(context.customTags, value);

    if (tagged !== undefined) {
        return tagged;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "[]";
        }

        if (rendersAsFlow(level, context)) {
            return writeFlow(value, level, context);
        }

        return writeBlockSequence(value, level, context);
    }

    if (typeof value === "object" && value !== null && Object.prototype.toString.call(value) === "[object Object]") {
        if (Object.keys(value).length === 0) {
            return "{}";
        }

        if (rendersAsFlow(level, context)) {
            return writeFlow(value, level, context);
        }

        return writeBlockMapping(value as Record<string, unknown>, level, context);
    }

    // Dates, class instances, etc. fall through to their primitive form.
    return writeLeaf(value, level, context, false);
};

const guardCircular = (value: object, context: DumpContext): void => {
    if (context.stack.has(value)) {
        throw new YAMLStringifyError("cannot serialize a circular structure to YAML");
    }
};

/**
 * Whether a collection at `level` is emitted in flow style. The block writers
 * and `writeNode` must agree on this for a given node, so both ask here rather
 * than re-deriving the comparison — they previously disagreed by one level,
 * which spliced a block collection inline and silently corrupted the output.
 */
const rendersAsFlow = (level: number, context: DumpContext): boolean => {
    if (context.collectionStyle === "flow") {
        return true;
    }

    if (context.collectionStyle === "block") {
        return false;
    }

    return context.flowLevel >= 0 && level >= context.flowLevel;
};

/**
 * Render one child of a block collection.
 *
 * Collections are rendered one level deeper, so `writeNode` reaches the same
 * flow/block verdict the caller does. Scalars keep the parent level because the
 * leaf writers (`writeLiteral` / `writeFolded` / `shouldFold`) already add the
 * extra level when computing their content indent.
 *
 * `block` reports whether the child came back as a multi-line block collection —
 * false for a flow child, a scalar, and for a collection that `skipInvalid`
 * emptied into an inline `[]` / `{}`.
 */
const writeChild = (item: unknown, level: number, context: DumpContext): { block: boolean; text: string } => {
    // A value claimed by a custom tag renders as an inline scalar however its
    // JS shape looks — a class instance is still `!tag text`, not a mapping.
    const isCollection = isBlockCollection(item) && stringifyCustomTag(context.customTags, item) === undefined;
    const text = writeNode(item, isCollection ? level + 1 : level, context);
    const block = isCollection && !rendersAsFlow(level + 1, context) && text !== "[]" && text !== "{}";

    return { block, text };
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

        if (item === undefined && context.skipInvalid && !context.keepUndefined) {
            continue;
        }

        const { block, text } = writeChild(item, level, context);

        lines.push(indent + marker + (block ? text.slice(childPrefixLength) : text));
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

        if (item === undefined && context.skipInvalid && !context.keepUndefined) {
            continue;
        }

        if (item === undefined && !context.keepUndefined) {
            continue;
        }

        const keyString = writeScalar(key, level, context, true);
        const { block, text } = writeChild(item, level, context);

        lines.push(block ? `${indent + keyString}:\n${text}` : `${indent + keyString}: ${text}`);
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
        blockQuote: options.blockQuote ?? true,
        collectionStyle: options.collectionStyle ?? "any",
        customTags: typeof options.customTags === "function" ? options.customTags([]) : options.customTags,
        falseStr: options.falseStr ?? "false",
        flowCollectionPadding: options.flowCollectionPadding ?? true,
        flowLevel: options.flowLevel ?? -1,
        forceQuotes: options.forceQuotes ?? false,
        indent: options.indent ?? 2,
        indentSeq: options.indentSeq ?? true,
        keepUndefined: options.keepUndefined ?? false,
        lineWidth: options.lineWidth ?? 80,
        nullStr: options.nullStr ?? "null",
        replacer: options.replacer,
        singleQuote: options.singleQuote ?? false,
        skipInvalid: options.skipInvalid ?? false,
        sortKeys: options.sortKeys ?? false,
        stack: new Set<object>(),
        trueStr: options.trueStr ?? "true",
    };

    // A block sequence entry is `-` plus a separating space, so an indentation
    // width of 1 leaves no room for the marker: it emitted `-value`, which
    // re-parses as a single scalar rather than a sequence.
    if (context.indent < 2) {
        throw new YAMLStringifyError("indentation width must be at least 2");
    }

    const root = applyReplacer(context, "", value);

    if (root === undefined) {
        return options.directives ? "---\n" : "\n";
    }

    const body = writeNode(root, 0, context);
    const prefix = options.directives ? "---\n" : "";

    return `${prefix}${body}\n`;
};
