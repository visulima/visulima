import { inspect } from "node:util";

import type { VisulimaError } from "./visulima-error";

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
            console.error(`Circular reference detected in error causes: ${inspect(error)}`);

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
