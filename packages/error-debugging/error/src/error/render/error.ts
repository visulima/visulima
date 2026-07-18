import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
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
type ResolvedFrame = { source?: string; trace: Trace };

const resolveFrame = (trace: Trace, resolver: SourceMapResolver | undefined): ResolvedFrame => {
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

const getMainFrame = (resolved: ResolvedFrame, options: Options, deep = 0): string => {
    const { color, cwd: cwdPath, displayShortPath, indentation, prefix } = options;
    const { trace: frame } = resolved;

    let filePath: string;

    if (frame.file === undefined) {
        filePath = "<unknown>";
    } else {
        filePath = displayShortPath ? getRelativePath(frame.file, cwdPath) : normalizePathSeparators(frame.file);
    }

    const { fileLine, method } = color;

    return `${getPrefix(prefix, indentation, deep)}at ${frame.methodName ? `${method(frame.methodName)} ` : ""}${fileLine(filePath)}:${fileLine(
        frame.line?.toString() ?? "",
    )}`;
};

/**
 * Decide whether a file referenced by a stack frame may be read from disk for a code frame.
 *
 * Security: `error.stack` can contain attacker-controlled absolute paths when rendering an error
 * that was deserialized or otherwise sourced from untrusted input. Reading those paths verbatim
 * leaks arbitrary local file contents into the rendered output (local file disclosure). By default
 * we therefore only read files that resolve inside `options.cwd`. Set `allowAllFilePaths: true` to
 * restore reading arbitrary absolute paths (only safe for trusted, locally-thrown errors).
 */
const isReadableSourcePath = (filePath: string, options: Options): boolean => {
    if (options.allowAllFilePaths) {
        return true;
    }

    const root = resolve(options.cwd);
    const resolved = resolve(root, filePath);

    return resolved === root || resolved.startsWith(root + sep);
};

const getCode = (resolved: ResolvedFrame, options: Options, deep: number): string | undefined => {
    const { color, indentation, linesAbove, linesBelow, prefix, showGutter, showLineNumbers, tabWidth } = options;
    const { source: resolvedSource, trace: frame } = resolved;

    if (frame.file === undefined) {
        return undefined;
    }

    let fileContent: string;

    if (resolvedSource === undefined) {
        const filePath = frame.file.replace("file://", "");

        // Refuse to read files outside the project cwd unless explicitly allowed (prevents local
        // file disclosure when the stack came from untrusted input).
        if (!isReadableSourcePath(filePath, options)) {
            return undefined;
        }

        if (!existsSync(filePath)) {
            return undefined;
        }

        fileContent = readFileSync(filePath, "utf8");
    } else {
        // The resolver supplied the original source directly (e.g. inlined sourcesContent).
        fileContent = resolvedSource;
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

    const cause = (error as { cause?: unknown }).cause;

    if (!(cause instanceof Error)) {
        // Non-Error cause (string, number, plain object, ...). Render its value as the title and
        // skip the stack/code-frame/hint handling that only applies to real errors.
        let causeText: string;

        if (typeof cause === "object") {
            try {
                causeText = JSON.stringify(cause);
            } catch {
                causeText = String(cause);
            }
        } else {
            causeText = String(cause);
        }

        message += `${getPrefix(options.prefix, options.indentation, deep)}${options.color.title(causeText)}\n`;

        return `\n${message}`;
    }

    message += getMessage(cause, options, deep);

    const stacktrace = parseStacktrace(cause);
    const mainFrame = stacktrace.shift();

    const hint = getHint(cause, options, deep);

    if (hint) {
        message += `${hint}\n`;
    }

    if (mainFrame) {
        const resolvedMainFrame = resolveFrame(mainFrame, options.sourceMap);

        message += getMainFrame(resolvedMainFrame, options, deep);

        if (!options.hideErrorCauseCodeView) {
            const code = getCode(resolvedMainFrame, options, deep);

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
        message += seen.has(cause)
            ? `\n${getPrefix(options.prefix, options.indentation, deep + 1)}Caused by: [Circular]`
            : `\n${getCause(cause, options, deep + 1, seen)}`;
    }

    return `\n${message}`;
};

const getStacktrace = (stack: Trace[], options: Options): string =>
    (stack.length > 0 ? "\n" : "") + stack.map((frame) => getMainFrame(resolveFrame(frame, options.sourceMap), options)).join("\n");

const internalRenderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options>, deep: number): string => {
    const config = {
        allowAllFilePaths: false,
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
    const resolvedMainFrame = mainFrame ? resolveFrame(mainFrame, config.sourceMap) : undefined;

    return [
        options.hideMessage ? undefined : getMessage(error, config, deep),
        getHint(error, config, deep),
        resolvedMainFrame ? getMainFrame(resolvedMainFrame, config, deep) : undefined,
        resolvedMainFrame && !config.hideErrorCodeView ? getCode(resolvedMainFrame, config, deep) : undefined,
        error instanceof AggregateError ? getErrors(error, config, deep) : undefined,
        error.cause === undefined || error.cause === null ? undefined : getCause(error, config, deep),
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

export type Options = {
    /**
     * Read source files for code frames from anywhere on disk, including absolute paths outside
     * `cwd`. Defaults to `false`, in which case only files resolving inside `cwd` are read — this
     * prevents local file disclosure when rendering errors whose stack came from untrusted input
     * (e.g. a deserialized error). Enable only for trusted, locally-thrown errors.
     * @default false
     */
    allowAllFilePaths: boolean;
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
} & Omit<CodeFrameOptions, "message | prefix">;

export const renderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options> = {}): string => {
    if (options.framesMaxLimit !== undefined && options.framesMaxLimit <= 0) {
        throw new RangeError("The 'framesMaxLimit' option must be a positive number");
    }

    return internalRenderError(error, options, 0);
};
