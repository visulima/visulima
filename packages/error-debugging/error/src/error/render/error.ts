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
        return prefix.toString();
    }

    if (indentation === "\t") {
        return prefix + "\t".repeat(deep);
    }

    return prefix + " ".repeat(indentation * deep);
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
            message += `${(spaces + line).toString()}\n`;
        }
    } else {
        message += spaces + ((error as VisulimaError).hint as string);
    }

    return color.hint(message);
};

const getMainFrame = (trace: Trace, { color, cwd: cwdPath, displayShortPath, indentation, prefix }: Options, deep = 0): string => {
    const filePath = displayShortPath ? getRelativePath(trace.file as string, cwdPath) : trace.file;

    const { fileLine, method } = color;

    return `${getPrefix(prefix, indentation, deep)}at ${trace.methodName ? `${method(trace.methodName)} ` : ""}${fileLine(filePath as string)}:${fileLine(
        trace.line?.toString() ?? "",
    )}`.toString();
};

const getCode = (
    trace: Trace,
    { color, indentation, linesAbove, linesBelow, prefix, showGutter, showLineNumbers, tabWidth }: Options,
    deep: number,
): string | undefined => {
    if (trace.file === undefined) {
        return undefined;
    }

    const filePath = trace.file.replace("file://", "");

    if (!existsSync(filePath)) {
        return undefined;
    }

    const fileContent = readFileSync(filePath, "utf8");

    return codeFrame(
        fileContent,
        {
            start: { column: trace.column, line: trace.line as number },
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
        message += internalRenderError(error_, { ...options, framesMaxLimit: 1, hideErrorCodeView: options.hideErrorErrorsCodeView }, deep + 1);
    }

    return `\n${message}`;
};

const getCause = (error: RenderableError, options: Options, deep: number): string => {
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

    if (cause.cause) {
        message += `\n${getCause(cause, options, deep + 1)}`;
    } else if (cause instanceof AggregateError) {
        const errors = getErrors(cause, options, deep);

        if (errors !== undefined) {
            message += `\n${errors}`;
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
        .join("\n")
        .replaceAll("\\", "/");
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
    filterStacktrace: ((line: string) => boolean) | undefined;
    framesMaxLimit: number;
    hideErrorCauseCodeView: boolean;
    hideErrorCodeView: boolean;
    hideErrorErrorsCodeView: boolean;
    hideErrorTitle: boolean;
    hideMessage: boolean;
    indentation: number | "\t";
    prefix: string;
};

export const renderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options> = {}): string => {
    if (options.framesMaxLimit !== undefined && options.framesMaxLimit <= 0) {
        throw new RangeError("The 'framesMaxLimit' option must be a positive number");
    }

    return internalRenderError(error, options, 0);
};
