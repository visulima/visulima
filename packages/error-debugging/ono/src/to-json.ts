import type { Trace } from "@visulima/error";
import { parseStacktrace } from "@visulima/error";
import { getErrorCauses } from "@visulima/error/error";
import type { SolutionFinder } from "@visulima/error/solution";

import findSolution from "./utils/find-solution";
import runtime from "./utils/runtimes";

/** A single parsed stack frame in the structured error payload. */
interface OnoJsonFrame {
    column?: number;
    file?: string;
    line?: number;
    methodName?: string;
    raw: string;
    type?: string;
}

/** A single error in the cause chain. */
interface OnoJsonError {
    frames: OnoJsonFrame[];
    message: string;
    name: string;
}

/** Structured, JSON-serializable representation of a rendered error. */
interface OnoJson {
    /** Detected runtime (node, bun, deno, workerd, …) or undefined when unknown. */
    runtime?: string;
    /** Suggested solution found by the configured solution finders, if any. */
    solution?: { body: string; header: string };
    /** The error and its full cause chain, outermost first. */
    stack: OnoJsonError[];
}

type ToJsonOptions = {
    solutionFinders?: SolutionFinder[];
};

const ensureError = (value: unknown): Error => {
    if (value instanceof Error) {
        return value;
    }

    return new Error(String(value));
};

const toFrame = (trace: Trace): OnoJsonFrame => {
    return {
        column: trace.column,
        file: trace.file,
        line: trace.line,
        methodName: trace.methodName,
        raw: trace.raw,
        type: trace.type,
    };
};

/**
 * Build a structured, JSON-serializable representation of an error — its name/message, the parsed
 * stack frames for the error and every entry in its `cause` chain, the detected runtime, and a
 * suggested solution (using the same solution-finder protocol as the HTML/ANSI renderers).
 *
 * Useful for API servers that want to return parsed error data when the client requests
 * `Accept: application/json`, mirroring Youch's `toJSON()`.
 * @param error the value thrown (any value is coerced to an `Error`).
 * @param options optional custom solution finders.
 * @returns a plain object safe to pass to `JSON.stringify`.
 * @example
 * ```typescript
 * const payload = await toJSON(error);
 * response.json(payload);
 * ```
 */
const toJSON = async (error: unknown, options: ToJsonOptions = {}): Promise<OnoJson> => {
    const errorInstance = ensureError(error);
    const causes = getErrorCauses(errorInstance);

    const stack: OnoJsonError[] = causes.map((cause) => {
        const causeError = ensureError(cause);

        return {
            frames: parseStacktrace(causeError).map((trace) => toFrame(trace)),
            message: causeError.message,
            name: causeError.name,
        };
    });

    const solution = await findSolution(errorInstance, options.solutionFinders ?? []);

    return {
        runtime,
        solution: solution ? { body: solution.body, header: solution.header ?? "" } : undefined,
        stack,
    };
};

export type { OnoJson, OnoJsonError, OnoJsonFrame, ToJsonOptions };

export default toJSON;
