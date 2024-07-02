import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import type { CodeFrameOptions, ColorizeMethod } from "../../code-frame";
import { codeFrame } from "../../code-frame";
import type { Trace } from "../../stacktrace";
import { parseStacktrace } from "../../stacktrace";
import type { VisulimaError } from "../visulima-error";

const getPrefix = (indentation: number | "\t", deep: number): string => {
    if (deep === 0) {
        return "";
    }

    if (indentation === "\t") {
        return "\t".repeat(deep);
    }

    return " ".repeat(indentation * deep);
};

const getRelativePath = (filePath: string, cwdPath: string) => {
    /**
     * Node.js error stack is all messed up. Some lines have file info
     * enclosed in parentheses and some are not
     */
    const path = filePath.replace("async file:", "file:");

    return relative(cwdPath, path.startsWith("file:") ? fileURLToPath(path) : path);
};

/**
 * Returns the error message
 */
const getMessage = (error: AggregateError | Error | VisulimaError, { color, hideErrorTitle, indentation }: Options, deep: number): string =>
    getPrefix(indentation, deep) + (hideErrorTitle ? color.title(error.message) : color.title(error.name + ": " + error.message)) + "\n";

const getHint = (error: AggregateError | Error | VisulimaError, { color, indentation }: Options, deep: number): string | undefined => {
    if ((error as VisulimaError).hint === undefined) {
        return undefined;
    }

    const prefix = getPrefix(indentation, deep);

    let message = "";

    if (Array.isArray((error as VisulimaError).hint)) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const line of (error as VisulimaError).hint as string[]) {
            message += prefix + line + "\n";
        }
    } else {
        message += prefix + ((error as VisulimaError).hint as string);
    }

    return color.hint(message);
};

const getMainFrame = (trace: Trace, { color, cwd: cwdPath, displayShortPath, indentation }: Options, deep = 0): string => {
    const filePath = displayShortPath ? getRelativePath(trace.file as string, cwdPath) : trace.file;

    const { fileLine, method } = color;

    return (
        getPrefix(indentation, deep) +
        "at " +
        (trace.methodName ? method(trace.methodName) + " " : "") +
        fileLine(filePath as string) +
        ":" +
        fileLine(trace.line + "")
    );
};

const getCode = (
    trace: Trace,
    { color, indentation, linesAbove, linesBelow, showGutter, showLineNumbers, tabWidth }: Options,
    deep: number,
): string | undefined => {
    if (trace.file === undefined) {
        return undefined;
    }

    const filePath = trace.file.replace("file://", "");

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(filePath)) {
        return undefined;
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fileContent = readFileSync(filePath, "utf8");

    return codeFrame(
        fileContent,
        {
            start: { column: trace.column, line: trace.line as number },
        },
        { color, linesAbove, linesBelow, prefix: getPrefix(indentation, deep), showGutter, showLineNumbers, tabWidth },
    );
};

const getErrors = (error: AggregateError, options: Options, deep: number): string | undefined => {
    if (error.errors.length === 0) {
        return undefined;
    }

    const prefix = getPrefix(options.indentation, deep);

    let message = prefix + "Errors:\n\n";
    let first = true;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,@typescript-eslint/naming-convention,no-underscore-dangle
    for (const error_ of error.errors) {
        if (first) {
            first = false;
        } else {
            message += "\n\n";
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        message += internalRenderError(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            error_,
            { ...options, framesMaxLimit: 0, hideErrorCodeView: options.hideErrorErrorsCodeView },
            deep + 1,
        );
    }

    return "\n" + message;
};

const getCause = (error: AggregateError | Error | VisulimaError, options: Options, deep: number): string => {
    let message = getPrefix(options.indentation, deep) + "Caused by:\n\n";

    const cause = error.cause as Error;

    message += getMessage(cause, options, deep);

    const stacktrace = parseStacktrace(cause);
    const mainFrame = stacktrace.shift() as Trace;

    const hint = getHint(cause, options, deep);

    if (hint) {
        message += hint + "\n";
    }

    message += getMainFrame(mainFrame, options, deep);

    if (!options.hideErrorCauseCodeView) {
        message += "\n" + getCode(mainFrame, options, deep);
    }

    if (cause.cause) {
        message += "\n" + getCause(cause, options, deep + 1);
    } else if (cause instanceof AggregateError) {
        message += "\n" + getErrors(cause, options, deep);
    }

    return "\n" + message;
};

const getStacktrace = (stack: Trace[], options: Options): string => {
    const frames = stack.slice(0, options.framesMaxLimit);

    return (frames.length > 0 ? "\n" : "") + frames.map((frame) => getMainFrame(frame, options)).join("\n");
};

const internalRenderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options>, deep: number): string => {
    const config = {
        cwd: cwd(),
        displayShortPath: false,
        framesMaxLimit: Number.POSITIVE_INFINITY,
        hideErrorCauseCodeView: false,
        hideErrorCodeView: false,
        hideErrorErrorsCodeView: false,
        hideErrorTitle: false,
        hideMessage: false,
        indentation: 4,
        linesAbove: 2,
        linesBelow: 3,
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

    const stack = parseStacktrace(error);
    const mainFrame = stack.shift();

    return [
        options.hideMessage ? undefined : getMessage(error, config, deep),
        "",
        getHint(error, config, deep),
        "",
        mainFrame ? getMainFrame(mainFrame, config, deep) : undefined,
        mainFrame && !config.hideErrorCodeView ? getCode(mainFrame, config, deep) : undefined,
        error instanceof AggregateError ? getErrors(error, config, deep) : undefined,
        error.cause === undefined ? undefined : getCause(error, config, deep),
        stack.length > 0 ? getStacktrace(stack, config) : undefined,
    ]
        .filter(Boolean)
        .join("\n");
};

export type Options = Omit<CodeFrameOptions, "message | prefix"> & {
    color: CodeFrameOptions["color"] & {
        fileLine: ColorizeMethod;
        hint: ColorizeMethod;
        method: ColorizeMethod;
        title: ColorizeMethod;
    };
    cwd: string;
    displayShortPath: boolean;
    framesMaxLimit: number;
    hideErrorCauseCodeView: boolean;
    hideErrorCodeView: boolean;
    hideErrorErrorsCodeView: boolean;
    hideErrorTitle: boolean;
    hideMessage: boolean;
    indentation: number | "\t";
};

export const renderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options> = {}): string => internalRenderError(error, options, 0);
