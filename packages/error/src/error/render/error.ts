import { existsSync, readFileSync } from "node:fs";
import { relative } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath } from "node:url";

import type { CodeFrameOptions, ColorizeMethod } from "../../code-frame";
import { codeFrame } from "../../code-frame";
import type { Trace } from "../../stacktrace";
import { parseStacktrace } from "../../stacktrace";
import getErrorCauses from "../get-error-causes";
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
const getMessage = (error: AggregateError | Error | VisulimaError, { color, hideErrorTitle }: Options, prefix: string): string =>
    prefix + (hideErrorTitle ? color.title(error.message) : color.title(error.name + ": " + error.message)) + "\n";

const getHint = (error: AggregateError | Error | VisulimaError, { color }: Options, prefix: string): string | undefined => {
    if ((error as VisulimaError).hint === undefined) {
        return undefined;
    }

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

const getMainFrame = (trace: Trace, { color, cwd: cwdPath, displayShortPath }: Options, prefix: string): string => {
    const filePath = displayShortPath ? getRelativePath(trace.file as string, cwdPath) : trace.file;

    const { fileLine, method } = color;

    return prefix + "at " + (trace.methodName ? method(trace.methodName) + " " : "") + fileLine(filePath as string) + ":" + fileLine(trace.line + "");
};

const getCode = (trace: Trace, options: Options, prefix: string): string | undefined => {
    const { color, linesAbove, linesBelow, showGutter, showLineNumbers, tabWidth } = options;

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
        { color, linesAbove, linesBelow, prefix, showGutter, showLineNumbers, tabWidth },
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
    let message = "Caused by:\n\n";

    const causes = getErrorCauses(error.cause as Error | VisulimaError);

    // eslint-disable-next-line no-param-reassign
    deep += 1;

    const prefix = getPrefix(options.indentation, deep);

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const cause of causes) {
        message += prefix + options.color.title(cause.name + ": " + cause.message) + "\n";

        const stacktrace = parseStacktrace(cause);
        const mainFrame = stacktrace.shift() as Trace;

        const hint = getHint(cause, options, prefix);

        if (hint) {
            message += hint + "\n";
        }

        message += getMainFrame(mainFrame, options, prefix);

        if (!options.hideErrorCauseCodeView) {
            // eslint-disable-next-line no-param-reassign
            deep += 1;

            message += "\n" + getCode(mainFrame, options, getPrefix(options.indentation, deep));
        }

        if (cause.cause) {
            // eslint-disable-next-line no-param-reassign
            deep += 1;

            message += getCause(cause, options, deep);
        } else if (cause instanceof AggregateError) {
            message += "\n" + getErrors(cause, options, deep);
        }
    }

    return "\n" + message;
};

const getStacktrace = (stack: Trace[], options: Options): string => {
    const frames = stack.slice(0, options.framesMaxLimit);

    return (frames.length > 0 ? "\n" : "") + frames.map((frame) => getMainFrame(frame, options, "")).join("\n");
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
    const prefix = getPrefix(config.indentation, deep);

    return [
        options.hideMessage ? undefined : getMessage(error, config, prefix),
        "",
        getHint(error, config, prefix),
        "",
        mainFrame ? getMainFrame(mainFrame, config, prefix) : undefined,
        mainFrame && !config.hideErrorCodeView ? getCode(mainFrame, config, prefix) : undefined,
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
