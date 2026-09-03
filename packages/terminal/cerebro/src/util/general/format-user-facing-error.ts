import { isUserFacingCerebroError } from "../../errors/error-codes";

/**
 * Renders a bad-input failure as the message plus any hints, or returns
 * `undefined` when the error is not one the user caused.
 *
 * Shared by `errorHandlerPlugin` and by `Cli.run`'s pre-lifecycle catch.
 * They are two separate code paths and the input errors go through the
 * *second* one: `UNKNOWN_OPTION`, `MISSING_ARGUMENT`, `CONFLICTING_OPTIONS`
 * and friends are all raised inside `#executeCommandInternal`, before the
 * plugin manager's lifecycle try/catch exists to see them. Classifying them
 * only in the plugin left the case the classification was written for —
 * `Found unknown option "--json"` — still printing a stack trace.
 * @param error The thrown value.
 * @returns The text to log, or `undefined` to fall through to normal rendering.
 */
export const formatUserFacingError = (error: unknown): string | undefined => {
    if (!isUserFacingCerebroError(error)) {
        return undefined;
    }

    const { hint, message } = error as { hint?: string[] | string; message: string };
    // `hint` is `ErrorHint = string | string[]`. Reading it as a bare string
    // dropped every array hint without a word.
    const hintLines = (Array.isArray(hint) ? hint : [hint]).filter((line): line is string => typeof line === "string" && line.length > 0);

    return hintLines.length > 0 ? [message, ...hintLines].join("\n") : message;
};
