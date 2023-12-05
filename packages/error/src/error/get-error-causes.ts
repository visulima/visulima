import type { VisulimaError } from "./visulima-error";

/**
 * Will return an array of all causes in the error in the order they occurred.
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
const getErrorCauses = <E = Error | VisulimaError | unknown>(error: E): E[] => {
    const causes = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-redundant-type-constituents
    let currentError: E | any = error;

    // eslint-disable-next-line no-loops/no-loops
    while (currentError) {
        causes.push(currentError);

        if (!currentError.cause) {
            break;
        }

        currentError = currentError.cause;
    }

    return causes as E[];
};

export default getErrorCauses;
