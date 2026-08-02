import nodeBuiltin from "../util/node-builtin";
import type { VisulimaError } from "./visulima-error";

const nodeUtility = nodeBuiltin("node:util");

/**
 * Describes an error for the diagnostic below, without ever throwing in the attempt.
 *
 * Nothing else in this module needs Node core, so it stays loadable and callable on an edge
 * runtime — but only if this one cosmetic `inspect` cannot take the walk down with it. `inspect`
 * is unavailable there, and a `toString` that throws (or a symbol) would defeat the plain fallback
 * too, so both are guarded: a diagnostic must never replace the error being examined.
 * @param error The value whose cause chain turned out to be circular.
 * @returns The richest description that could be produced.
 */
const describeError = (error: unknown): string => {
    try {
        return nodeUtility().inspect(error);
    } catch {
        // No `node:util` on this runtime — fall back to plain stringification.
    }

    try {
        return String(error);
    } catch {
        return "<unprintable>";
    }
};

/**
 * Will return an array of all causes in the error in the order they occurred.
 */

const getErrorCauses = <E = Error | VisulimaError>(error: E): E[] => {
    const seen = new Set<unknown>();
    const causes: E[] = [];

    let currentError: unknown = error;

    while (currentError) {
        // Check for circular reference
        if (seen.has(currentError)) {
            // eslint-disable-next-line no-console
            console.error(`Circular reference detected in error causes: ${describeError(error)}`);

            break;
        }

        causes.push(currentError as E);
        seen.add(currentError);

        if (typeof currentError !== "object" || !("cause" in currentError)) {
            break;
        }

        currentError = (currentError as Record<string, unknown>).cause;
    }

    return causes;
};

export default getErrorCauses;
