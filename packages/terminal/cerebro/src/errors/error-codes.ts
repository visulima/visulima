/**
 * Error code constants for type safety.
 */
export const ErrorCodes = {
    CACHE_DIRECTORY_NOT_FOUND: "CACHE_DIRECTORY_NOT_FOUND",
    COMMAND_LOADER_ERROR: "COMMAND_LOADER_ERROR",
    COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
    COMMAND_VALIDATION_ERROR: "COMMAND_VALIDATION_ERROR",
    CONFLICTING_OPTIONS: "CONFLICTING_OPTIONS",
    DUPLICATE_COMMAND: "DUPLICATE_COMMAND",
    INVALID_ARGUMENT: "INVALID_ARGUMENT",
    INVALID_CHOICE: "INVALID_CHOICE",
    INVALID_COMMAND: "INVALID_COMMAND",
    INVALID_COMMAND_NAME: "INVALID_COMMAND_NAME",
    INVALID_INPUT: "INVALID_INPUT",
    INVALID_PLUGIN_NAME: "INVALID_PLUGIN_NAME",
    INVALID_RUNTIME: "INVALID_RUNTIME",
    INVALID_SHELL: "INVALID_SHELL",
    MISSING_ARGUMENT: "MISSING_ARGUMENT",
    PLUGIN_ERROR: "PLUGIN_ERROR",
    SECURITY_ERROR: "SECURITY_ERROR",
    SURPLUS_ARGUMENT: "SURPLUS_ARGUMENT",
    UNKNOWN_OPTION: "UNKNOWN_OPTION",
    UPDATE_NOTIFIER_ERROR: "UPDATE_NOTIFIER_ERROR",
    VERSION_FETCH_ERROR: "VERSION_FETCH_ERROR",
    VERSION_PARSE_ERROR: "VERSION_PARSE_ERROR",
} as const satisfies Record<string, string>;

// fallow-ignore-next-line unused-type -- public companion type for the exported ErrorCodes const; kept for consumers narrowing error codes
export type ErrorCode = keyof typeof ErrorCodes;

/**
 * Codes for failures caused by what the user typed — a misspelled flag, a
 * missing positional, a command that doesn't exist.
 *
 * These are control flow, not defects in the CLI, so `errorHandlerPlugin`
 * prints their message (and hint) alone. A stack for "Found unknown option
 * --json" is eight frames of bundle internals that tell the user nothing
 * and push the one actionable line off-screen.
 *
 * Codes absent from this set (plugin failures, loader failures, duplicate
 * command registration) point at broken code and keep their stack.
 */
export const USER_FACING_ERROR_CODES: ReadonlySet<string> = new Set<string>([
    ErrorCodes.COMMAND_NOT_FOUND,
    ErrorCodes.COMMAND_VALIDATION_ERROR,
    ErrorCodes.CONFLICTING_OPTIONS,
    ErrorCodes.INVALID_ARGUMENT,
    ErrorCodes.INVALID_CHOICE,
    ErrorCodes.INVALID_INPUT,
    ErrorCodes.MISSING_ARGUMENT,
    ErrorCodes.SURPLUS_ARGUMENT,
    ErrorCodes.UNKNOWN_OPTION,
]);

/** True when `error` is a Cerebro error caused by user input. */
export const isUserFacingCerebroError = (error: unknown): boolean => {
    const code = (error as { code?: unknown } | null)?.code;

    return typeof code === "string" && USER_FACING_ERROR_CODES.has(code);
};
