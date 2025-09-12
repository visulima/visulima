import { inspect } from "node:util";

import type { VisulimaError } from "./visulima-error";

/**
 * Will return an array of all causes in the error in the order they occurred.
 */

const getErrorCauses = <E = Error | VisulimaError | unknown>(error: E): E[] => {
    const seen = new Set();
    const causes = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentError: E | any = error;

    // eslint-disable-next-line no-loops/no-loops
    while (currentError) {
        // Check for circular reference
        if (seen.has(currentError)) {
            // eslint-disable-next-line no-console
            console.error(`Circular reference detected in error causes: ${inspect(error)}`);

            break;
        }

        causes.push(currentError);
        seen.add(currentError);

        if (!currentError.cause) {
            break;
        }

        currentError = currentError.cause;
    }

    return causes as E[];
};

export default getErrorCauses;
