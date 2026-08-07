/* eslint-disable max-classes-per-file */
/* eslint-disable import/exports-last */

const BREAK_CHARS = /[\t\n\r ]/;

/**
 * Positional information for a YAML error, pointing at the offending
 * character in the source string.
 */
export interface Mark {
    /** Zero-based column (characters into the current line). */
    column: number;

    /** Zero-based line number. */
    line: number;

    /** Zero-based absolute offset into the source string. */
    position: number;

    /** A short excerpt of the source around the error, if available. */
    snippet?: string;
}

const buildSnippet = (source: string, mark: Mark, indent = 4, maxLength = 79): string => {
    let start = mark.position;
    let end = mark.position;
    let head = "";
    let tail = "";

    while (start > 0 && !BREAK_CHARS.test(source.charAt(start - 1))) {
        start -= 1;

        if (mark.position - start > maxLength / 2 - 1) {
            head = " ... ";
            start += 5;
            break;
        }
    }

    while (end < source.length && !BREAK_CHARS.test(source.charAt(end))) {
        end += 1;

        if (end - mark.position > maxLength / 2 - 1) {
            tail = " ... ";
            end -= 5;
            break;
        }
    }

    const line = source.slice(start, end);
    const pointerPad = " ".repeat(indent + mark.position - start + head.length);

    return `${" ".repeat(indent)}${head}${line}${tail}\n${pointerPad}^`;
};

/**
 * Base class for all errors raised by `@visulima/yaml`.
 */
export class YAMLError extends Error {
    public readonly mark?: Mark;

    public constructor(message: string, mark?: Mark, source?: string) {
        let composed = message;
        let resolvedMark = mark;

        if (mark) {
            composed += ` at line ${String(mark.line + 1)}, column ${String(mark.column + 1)}`;

            if (source !== undefined) {
                // Also expose the excerpt on the mark, so callers rendering their
                // own diagnostics do not have to scrape it back out of `message`.
                const snippet = buildSnippet(source, mark);

                composed += `:\n${snippet}`;
                resolvedMark = { ...mark, snippet };
            }
        }

        super(composed);

        this.name = "YAMLError";
        this.mark = resolvedMark;
    }
}

/**
 * Raised when the parser encounters malformed YAML input.
 */
export class YAMLParseError extends YAMLError {
    public constructor(message: string, mark?: Mark, source?: string) {
        super(message, mark, source);

        this.name = "YAMLParseError";
    }
}

/**
 * Raised when a value cannot be represented as YAML during serialization.
 */
export class YAMLStringifyError extends YAMLError {
    public constructor(message: string, mark?: Mark, source?: string) {
        super(message, mark, source);

        this.name = "YAMLStringifyError";
    }
}

/**
 * A non-fatal notice (e.g. a duplicate mapping key) collected during parsing.
 */
export class YAMLWarning extends YAMLError {
    public constructor(message: string, mark?: Mark, source?: string) {
        super(message, mark, source);

        this.name = "YAMLWarning";
    }
}
