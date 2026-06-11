import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import type { CodeFrameOptions, ColorizeMethod } from "../../code-frame";
import { codeFrame } from "../../code-frame";
import type { Trace } from "../../stacktrace";
import { parseStacktrace } from "../../stacktrace";
import type { VisulimaError } from "../visulima-error";

/**
 * Error types that can be rendered.
 */
type RenderableError = AggregateError | Error | VisulimaError;

const getPrefix = (prefix: string, indentation: number | "\t", deep: number): string => {
    if (deep === 0) {
        return prefix;
    }

    if (indentation === "\t") {
        return prefix + "\t".repeat(deep);
    }

    return prefix + " ".repeat(indentation * deep);
};

/**
 * Normalize Windows backslash path separators to forward slashes.
 *
 * This is applied only to file paths (not the whole rendered output) so that backslashes inside
 * error messages or code-frame source lines (e.g. a regex `\d` or a `C:\` string literal) are left
 * untouched.
 */
const normalizePathSeparators = (filePath: string): string => filePath.replaceAll("\\", "/");

const getRelativePath = (filePath: string, cwdPath: string) => {
    /**
     * Node.js error stack is all messed up. Some lines have file info
     * enclosed in parentheses and some are not
     */
    const path = filePath.replace("async file:", "file:");

    return normalizePathSeparators(relative(cwdPath, path.startsWith("file:") ? fileURLToPath(path) : path));
};

/**
 * Returns the error message.
 */
const getTitleText = (error: RenderableError, hideErrorTitle: boolean, color: Options["color"]): string => {
    if (hideErrorTitle) {
        return color.title(error.message);
    }

    const messagePart = error.message ? `: ${error.message}` : "";

    return color.title(error.name + messagePart);
};

const getMessage = (error: RenderableError, { color, hideErrorTitle, indentation, prefix }: Options, deep: number): string =>
    `${getPrefix(prefix, indentation, deep)}${getTitleText(error, hideErrorTitle, color)}\n`;

const getHint = (error: RenderableError, { color, indentation, prefix }: Options, deep: number): string | undefined => {
    if ((error as VisulimaError).hint === undefined) {
        return undefined;
    }

    const spaces = getPrefix(prefix, indentation, deep);

    let message = "";

    if (Array.isArray((error as VisulimaError).hint)) {
        for (const line of (error as VisulimaError).hint as string[]) {
            message += `${spaces + line}\n`;
        }
    } else {
        message += spaces + ((error as VisulimaError).hint as string);
    }

    return color.hint(message);
};

/**
 * Apply the optional source-map resolver to a parsed frame.
 *
 * When a resolver is configured (e.g. to map compiled `*.js:line:col` positions back to the
 * original TS/JSX source), it is given the frame's file/line/column and may return a resolved
 * location plus, optionally, the original source content for the code frame. A thrown or undefined
 * result leaves the frame untouched, so a broken resolver never breaks rendering.
 */
const resolveFrame = (trace: Trace, resolver: SourceMapResolver | undefined): { source?: string; trace: Trace } => {
    if (!resolver || trace.file === undefined || trace.line === undefined) {
        return { trace };
    }

    try {
        const resolved = resolver({ column: trace.column, file: trace.file, line: trace.line });

        if (!resolved) {
            return { trace };
        }

        return {
            source: resolved.source,
            trace: {
                ...trace,
                column: resolved.column ?? trace.column,
                file: resolved.file ?? trace.file,
                line: resolved.line ?? trace.line,
            },
        };
    } catch {
        return { trace };
    }
};

const getMainFrame = (trace: Trace, options: Options, deep = 0): string => {
    const { color, cwd: cwdPath, displayShortPath, indentation, prefix } = options;
    const { trace: frame } = resolveFrame(trace, options.sourceMap);

    const filePath = displayShortPath ? getRelativePath(frame.file as string, cwdPath) : normalizePathSeparators(frame.file as string);

    const { fileLine, method } = color;

    return `${getPrefix(prefix, indentation, deep)}at ${frame.methodName ? `${method(frame.methodName)} ` : ""}${fileLine(filePath as string)}:${fileLine(
        frame.line?.toString() ?? "",
    )}`;
};

const getCode = (trace: Trace, options: Options, deep: number): string | undefined => {
    const { color, indentation, linesAbove, linesBelow, prefix, showGutter, showLineNumbers, tabWidth } = options;
    const { source: resolvedSource, trace: frame } = resolveFrame(trace, options.sourceMap);

    if (frame.file === undefined) {
        return undefined;
    }

    let fileContent: string;

    if (resolvedSource !== undefined) {
        // The resolver supplied the original source directly (e.g. inlined sourcesContent).
        fileContent = resolvedSource;
    } else {
        const filePath = frame.file.replace("file://", "");

        if (!existsSync(filePath)) {
            return undefined;
        }

        fileContent = readFileSync(filePath, "utf8");
    }

    return codeFrame(
        fileContent,
        {
            start: { column: frame.column, line: frame.line as number },
        },
        { color, linesAbove, linesBelow, prefix: getPrefix(prefix, indentation, deep), showGutter, showLineNumbers, tabWidth },
    );
};

const getErrors = (error: AggregateError, options: Options, deep: number): string | undefined => {
    if (error.errors.length === 0) {
        return undefined;
    }

    let message = `${getPrefix(options.prefix, options.indentation, deep)}Errors:\n\n`;
    let first = true;

    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    for (const error_ of error.errors) {
        if (first) {
            first = false;
        } else {
            message += "\n\n";
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        message += internalRenderError(error_ as Error, { ...options, framesMaxLimit: 1, hideErrorCodeView: options.hideErrorErrorsCodeView }, deep + 1);
    }

    return `\n${message}`;
};

const getCause = (error: RenderableError, options: Options, deep: number, seen: Set<unknown> = new Set()): string => {
    seen.add(error);

    let message = `${getPrefix(options.prefix, options.indentation, deep)}Caused by:\n\n`;

    const cause = error.cause as Error;

    message += getMessage(cause, options, deep);

    const stacktrace = parseStacktrace(cause);
    const mainFrame = stacktrace.shift();

    const hint = getHint(cause, options, deep);

    if (hint) {
        message += `${hint}\n`;
    }

    if (mainFrame) {
        message += getMainFrame(mainFrame, options, deep);

        if (!options.hideErrorCauseCodeView) {
            const code = getCode(mainFrame, options, deep);

            if (code !== undefined) {
                message += `\n${code}`;
            }
        }
    }

    if (cause instanceof AggregateError) {
        const errors = getErrors(cause, options, deep);

        if (errors !== undefined) {
            message += `\n${errors}`;
        }
    }

    if (cause.cause) {
        if (seen.has(cause)) {
            message += `\n${getPrefix(options.prefix, options.indentation, deep + 1)}Caused by: [Circular]`;
        } else {
            message += `\n${getCause(cause, options, deep + 1, seen)}`;
        }
    }

    return `\n${message}`;
};

const getStacktrace = (stack: Trace[], options: Options): string =>
    (stack.length > 0 ? "\n" : "") + stack.map((frame) => getMainFrame(frame, options)).join("\n");

const internalRenderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options>, deep: number): string => {
    const config = {
        cwd: cwd(),
        displayShortPath: false,
        filterStacktrace: undefined,
        framesMaxLimit: Number.POSITIVE_INFINITY,
        hideErrorCauseCodeView: false,
        hideErrorCodeView: false,
        hideErrorErrorsCodeView: false,
        hideErrorTitle: false,
        hideMessage: false,
        indentation: 4,
        linesAbove: 2,
        linesBelow: 3,
        prefix: "",
        showGutter: true,
        showLineNumbers: true,
        tabWidth: 4,
        ...options,
        color: {
            fileLine: (value: string) => value,
            gutter: (value: string) => value,
            hint: (value: string) => value,
            marker: (value: string) => value,
            message: (value: string) => value,
            method: (value: string) => value,
            title: (value: string) => value,
            ...options.color,
        },
    } satisfies Options;

    const stack = parseStacktrace(error, {
        filter: options.filterStacktrace,
        frameLimit: config.framesMaxLimit,
    });

    const mainFrame = stack.shift();

    return [
        options.hideMessage ? undefined : getMessage(error, config, deep),
        getHint(error, config, deep),
        mainFrame ? getMainFrame(mainFrame, config, deep) : undefined,
        mainFrame && !config.hideErrorCodeView ? getCode(mainFrame, config, deep) : undefined,
        error instanceof AggregateError ? getErrors(error, config, deep) : undefined,
        error.cause === undefined ? undefined : getCause(error, config, deep),
        stack.length > 0 ? getStacktrace(stack, config) : undefined,
    ]
        .filter(Boolean)
        .join("\n");
};

/**
 * The compiled position of a stack frame handed to a {@link SourceMapResolver}.
 */
export interface SourceMapLocation {
    column?: number;
    file: string;
    line: number;
}

/**
 * The resolved original position returned by a {@link SourceMapResolver}. Any omitted field falls
 * back to the compiled value. `source`, when provided, is used directly as the code-frame content
 * (e.g. from an inlined `sourcesContent`) instead of reading the resolved file from disk.
 */
export interface ResolvedSourceLocation {
    column?: number;
    file?: string;
    line?: number;
    source?: string;
}

/**
 * Pluggable hook that maps a compiled `*.js:line:col` position back to its original source position
 * (e.g. TS/JSX). Return `undefined` (or throw) to leave the frame untouched. Synchronous so it can
 * be used by the synchronous `renderError`; resolve/inline your maps ahead of time.
 */
export type SourceMapResolver = (location: SourceMapLocation) => ResolvedSourceLocation | undefined;

export type Options = Omit<CodeFrameOptions, "message | prefix"> & {
    color: CodeFrameOptions["color"] & {
        fileLine: ColorizeMethod;
        hint: ColorizeMethod;
        method: ColorizeMethod;
        title: ColorizeMethod;
    };
    cwd: string;
    displayShortPath: boolean;
    filterStacktrace: ((line: string) => boolean) | undefined;
    framesMaxLimit: number;
    hideErrorCauseCodeView: boolean;
    hideErrorCodeView: boolean;
    hideErrorErrorsCodeView: boolean;
    hideErrorTitle: boolean;
    hideMessage: boolean;
    indentation: number | "\t";
    prefix: string;
    /** Optional source-map resolver to map compiled frame positions back to original source. */
    sourceMap?: SourceMapResolver;
};

export const renderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options> = {}): string => {
    if (options.framesMaxLimit !== undefined && options.framesMaxLimit <= 0) {
        throw new RangeError("The 'framesMaxLimit' option must be a positive number");
    }

    return internalRenderError(error, options, 0);
};
