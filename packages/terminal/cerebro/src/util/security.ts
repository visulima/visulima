/**
 * Security utilities for validating CLI argument inputs.
 *
 * The caps here exist to guard against accidental or malicious DoS-style inputs
 * (millions of argv tokens, multi-megabyte single arguments). They are
 * intentionally generous defaults and can be tuned — or disabled entirely — via
 * {@link SanitizeOptions}, because legitimate invocations (e.g. a shell glob
 * expanding to thousands of file paths: `mycli fmt src/**\/*.ts`) can far exceed
 * any small fixed limit.
 */

/**
 * Default maximum allowed length for a single argument value.
 *
 * Generous enough to never trip real-world flags/paths while still catching
 * pathological multi-megabyte inputs.
 */
const DEFAULT_MAX_ARGUMENT_LENGTH = 1_000_000;

/**
 * Default maximum allowed number of arguments.
 *
 * Set high so shell-glob expansions (which routinely exceed a few hundred
 * paths) are never rejected; the cap only protects against truly pathological
 * argv sizes.
 */
const DEFAULT_MAX_ARGS = 100_000;

/**
 * Dangerous characters that could be used for injection attacks.
 *
 * Only consulted when {@link SanitizeOptions.checkDangerousChars} is enabled;
 * cerebro never passes argv to a shell, so this is opt-in.
 */
const DANGEROUS_CHARS = new Set(["\n", "\r", "\t", "\0", "\"", "$", "&", "'", "(", ")", ";", "<", ">", "[", "\\", "]", "`", "{", "|", "}"]);

/**
 * Options controlling argument sanitization.
 */
interface SanitizeOptions {
    /**
     * Reject arguments containing shell-dangerous characters.
     * @default false
     */
    checkDangerousChars?: boolean;

    /**
     * Maximum allowed length for a single argument. Pass `Number.POSITIVE_INFINITY`
     * (or any falsy-but-defined `0`) to disable the check.
     * @default DEFAULT_MAX_ARGUMENT_LENGTH
     */
    maxArgumentLength?: number;

    /**
     * Maximum allowed number of arguments. Pass `Number.POSITIVE_INFINITY` to
     * disable the check.
     * @default DEFAULT_MAX_ARGS
     */
    maxArguments?: number;

    /**
     * Trim leading/trailing whitespace from each argument. Off by default so
     * intentionally whitespace-padded values are preserved verbatim.
     * @default false
     */
    trim?: boolean;
}

/**
 * Sanitizes a command argument.
 * @param argument The argument string to sanitize.
 * @param options Sanitization options (or a boolean for back-compat: `true` enables the dangerous-char check).
 * @returns The (optionally trimmed) argument.
 * @throws {TypeError} If the argument is not a string.
 * @throws {Error} If the argument exceeds maximum length or contains dangerous characters.
 */
const sanitizeArgument = (argument: string, options: SanitizeOptions | boolean = {}): string => {
    if (typeof argument !== "string") {
        throw new TypeError("Argument must be a string");
    }

    const resolved: SanitizeOptions = typeof options === "boolean" ? { checkDangerousChars: options } : options;
    const maxArgumentLength = resolved.maxArgumentLength ?? DEFAULT_MAX_ARGUMENT_LENGTH;

    if (Number.isFinite(maxArgumentLength) && maxArgumentLength > 0 && argument.length > maxArgumentLength) {
        throw new Error(`Argument is too long (maximum ${String(maxArgumentLength)} characters)`);
    }

    if (resolved.checkDangerousChars) {
        for (const char of argument) {
            if (DANGEROUS_CHARS.has(char)) {
                throw new Error(`Argument contains dangerous character: ${char}`);
            }
        }
    }

    return resolved.trim ? argument.trim() : argument;
};

/**
 * Sanitizes an array of arguments.
 * @param args The array of arguments to sanitize.
 * @param options Sanitization options (or a boolean for back-compat: `true` enables the dangerous-char check).
 * @returns Array of sanitized arguments.
 * @throws {TypeError} If args is not an array or if any argument is not a string.
 * @throws {Error} If there are too many arguments or if any argument is invalid.
 */
const sanitizeArguments = (args: ReadonlyArray<string>, options: SanitizeOptions | boolean = {}): string[] => {
    if (!Array.isArray(args)) {
        throw new TypeError("Arguments must be an array");
    }

    const resolved: SanitizeOptions = typeof options === "boolean" ? { checkDangerousChars: options } : options;
    const maxArguments = resolved.maxArguments ?? DEFAULT_MAX_ARGS;

    if (Number.isFinite(maxArguments) && maxArguments > 0 && args.length > maxArguments) {
        throw new Error(`Too many arguments (maximum ${String(maxArguments)})`);
    }

    return args.map((argument) => sanitizeArgument(argument, resolved));
};

export type { SanitizeOptions };
export { DEFAULT_MAX_ARGS, DEFAULT_MAX_ARGUMENT_LENGTH, sanitizeArgument, sanitizeArguments };
