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
const getMessage = (error: AggregateError | Error | VisulimaError, options: Options): string | undefined => {
    if (options.hideMessage) {
        return undefined;
    }

    const { color, hideErrorTitle } = options;

    const { title } = color;

    return (hideErrorTitle ? title(error.message) : title(error.name + ": " + error.message)) + "\n";
};

const getHint = (error: AggregateError | Error | VisulimaError, options: Options): string | undefined => {
    if ((error as VisulimaError).hint === undefined) {
        return undefined;
    }

    const { hint } = options.color;

    let message = "";

    if (Array.isArray((error as VisulimaError).hint)) {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const line of (error as VisulimaError).hint as string[]) {
            message += line + "\n";
        }
    } else {
        message += (error as VisulimaError).hint as string;
    }

    return hint(message);
};

const getMainFrame = (trace: Trace, options: Options): string => {
    const filePath = options.displayShortPath ? getRelativePath(trace.file as string, options.cwd) : trace.file;

    const { fileLine, method } = options.color;

    return "at " + (trace.methodName ? method(trace.methodName) + " " : "") + fileLine(filePath as string) + ":" + fileLine(trace.line + "");
};

const getCode = (trace: Trace, options: Options): string | undefined => {
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
        { color, linesAbove, linesBelow, showGutter, showLineNumbers, tabWidth },
    );
};

const getErrors = (error: AggregateError, options: Options): string | undefined => {
    if (error.errors.length === 0) {
        return undefined;
    }

    let message = "Errors:\n\n";
    let first = true;
    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax,@typescript-eslint/naming-convention,no-underscore-dangle
    for (const error_ of error.errors) {
        if (first) {
            first = false;
        } else {
            message += "\n\n";
        }

        // eslint-disable-next-line @typescript-eslint/no-use-before-define,@typescript-eslint/no-unsafe-argument
        message += renderError(error_, { ...options, framesMaxLimit: 0, hideErrorCodeView: options.hideErrorErrorsCodeView });
    }

    return "\n" + message;
};

const getCause = (error: AggregateError | Error | VisulimaError, options: Options): string | undefined => {
    if (error.cause !== undefined) {
        let message = "Caused by:\n\n";

        const causes = getErrorCauses(error.cause as Error | VisulimaError);

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const cause of causes) {
            message += options.color.title(cause.name + ": " + cause.message) + "\n";

            const stacktrace = parseStacktrace(cause);
            const mainFrame = stacktrace.shift() as Trace;

            const hint = getHint(cause, options);

            if (hint) {
                message += hint + "\n";
            }

            message += getMainFrame(mainFrame, options);

            if (!options.hideErrorCauseCodeView) {
                message += "\n" + getCode(mainFrame, options);
            }
        }

        return "\n" + message;
    }

    return undefined;
};

const getStacktrace = (stack: Trace[], options: Options): string => {
    const frames = stack.slice(0, options.framesMaxLimit);

    return (frames.length > 0 ? "\n" : "") + frames.map((frame) => getMainFrame(frame, options)).join("\n");
};

export type Options = Omit<CodeFrameOptions, "message"> & {
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
};

export const renderError = (error: AggregateError | Error | VisulimaError, options: Partial<Options> = {}): string => {
    const config = {
        cwd: cwd(),
        displayShortPath: false,
        framesMaxLimit: Number.POSITIVE_INFINITY,
        hideErrorCauseCodeView: false,
        hideErrorCodeView: false,
        hideErrorErrorsCodeView: false,
        hideErrorTitle: false,
        hideMessage: false,
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
        linesAbove: 2,
        linesBelow: 3,
        showGutter: true,
        showLineNumbers: true,
        tabWidth: 4,
    } satisfies Options;

    const stack = parseStacktrace(error);
    const mainFrame = stack.shift();

    return [
        getMessage(error, config),
        "",
        getHint(error, config),
        "",
        mainFrame ? getMainFrame(mainFrame, config) : undefined,
        mainFrame && !config.hideErrorCodeView ? getCode(mainFrame, config) : undefined,
        error instanceof AggregateError ? getErrors(error, config) : undefined,
        getCause(error, config),
        stack.length > 0 ? getStacktrace(stack, config) : undefined,
    ]
        .filter(Boolean)
        .join("\n");
};
