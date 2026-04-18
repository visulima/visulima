import type { JSONPath } from "jsonc-parser";
import { applyEdits, modify, parse } from "jsonc-parser";

import type { JsoncFormattingOptions } from "../types";

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

type WalkContext = {
    formattingOptions: JsoncFormattingOptions;
    text: string;
};

const applyModification = (context: WalkContext, path: JSONPath, value: unknown): void => {
    const edits = modify(context.text, path, value, { formattingOptions: context.formattingOptions });

    context.text = applyEdits(context.text, edits);
};

const walkObject = (
    context: WalkContext,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    path: JSONPath,
    walk: (nestedContext: WalkContext, old: unknown, next: unknown, path: JSONPath) => void,
): void => {
    const keys = new Set<string>([...Object.keys(oldValue), ...Object.keys(newValue)]);

    for (const key of keys) {
        const keyPath: JSONPath = [...path, key];

        if (key in newValue) {
            if (key in oldValue) {
                walk(context, oldValue[key], newValue[key], keyPath);
            } else {
                applyModification(context, keyPath, newValue[key]);
            }
        } else {
            applyModification(context, keyPath, undefined);
        }
    }
};

const walkValue = (context: WalkContext, oldValue: unknown, newValue: unknown, path: JSONPath): void => {
    if (oldValue === newValue) {
        return;
    }

    if (isPlainObject(oldValue) && isPlainObject(newValue)) {
        walkObject(context, oldValue, newValue, path, walkValue);

        return;
    }

    if (Array.isArray(oldValue) && Array.isArray(newValue) && oldValue.length === newValue.length) {
        for (const [index, oldItem] of oldValue.entries()) {
            walkValue(context, oldItem, newValue[index], [...path, index]);
        }

        return;
    }

    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
        return;
    }

    applyModification(context, path, newValue);
};

/**
 * Build an updated JSONC string that preserves comments and formatting by applying
 * the minimal set of `jsonc-parser` `modify()` edits required to make `original`
 * match `next`. Walks both trees recursively — only leaves that differ are edited,
 * so untouched siblings keep their comments and whitespace.
 * @param original The original JSONC source string.
 * @param next The new value to merge into the source.
 * @param formattingOptions Formatting options forwarded to `jsonc-parser`.
 * @returns The updated JSONC source string.
 */
const mergeJsoncPreservingComments = (original: string, next: unknown, formattingOptions: JsoncFormattingOptions): string => {
    const existing = parse(original, [], { allowTrailingComma: true }) as unknown;
    const context: WalkContext = { formattingOptions, text: original };

    walkValue(context, existing, next, []);

    return context.text;
};

/**
 * Derive `jsonc-parser` formatting options from an indent specifier (number, tab, or spaces).
 * @param indent The indent value — number of spaces, a tab string, or any whitespace string.
 * @returns Partial formatting options compatible with `jsonc-parser`.
 */
export const formattingFromIndent = (indent: number | string | undefined): JsoncFormattingOptions => {
    if (typeof indent === "number") {
        return { insertSpaces: true, tabSize: indent };
    }

    if (typeof indent === "string") {
        if (indent === "\t" || indent.includes("\t")) {
            return { insertSpaces: false, tabSize: indent.length || 1 };
        }

        return { insertSpaces: true, tabSize: indent.length || 2 };
    }

    return { insertSpaces: true, tabSize: 2 };
};

/**
 * Compute the final JSONC string to write given the original source (if any) and the new value.
 * Centralises the branch between comment-preserving merge and fresh JSON stringification.
 * @param existingText The original file contents, or `undefined` if the file does not exist.
 * @param data The new data.
 * @param preserveComments Whether comments should be preserved when an existing file is present.
 * @param indent Indent specifier for fresh writes and for deriving formatting options.
 * @param trailingNewline Trailing newline detected from the existing file (or a default).
 * @param formattingOptions Caller-supplied overrides merged on top of derived formatting.
 * @param replacer Optional `JSON.stringify` replacer used when writing fresh content.
 * @returns The JSONC string to write.
 */
export const buildJsoncOutput = (
    existingText: string | undefined,
    data: unknown,
    preserveComments: boolean,
    indent: number | string,
    trailingNewline: string,
    formattingOptions: JsoncFormattingOptions | undefined,
    replacer: unknown,
): string => {
    if (preserveComments && existingText !== undefined) {
        const resolvedFormatting = { ...formattingFromIndent(indent), ...formattingOptions };
        let merged = mergeJsoncPreservingComments(existingText, data, resolvedFormatting);

        if (trailingNewline && !merged.endsWith("\n")) {
            merged += trailingNewline;
        }

        return merged;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return `${JSON.stringify(data, replacer as any, indent)}${trailingNewline}`;
};

export default mergeJsoncPreservingComments;
