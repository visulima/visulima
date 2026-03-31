/**
 * Shared utility for option parsing across command handlers.
 */

/**
 * Converts a CLI option value (which may be undefined, a single string,
 * or an array of strings) into a normalized string array.
 */
const toStringArray = (value: unknown): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? (value as string[]) : [value as string];
};

/**
 * Safely extracts an error message from an unknown caught value.
 * Handles Error instances, strings, and other types.
 */
const errorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return String(error);
};

export { errorMessage, toStringArray };
