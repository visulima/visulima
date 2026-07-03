/**
 * Options for creating a PailError.
 *
 * Extends standard error properties with self-documenting fields
 * that provide actionable context for debugging, particularly useful
 * for AI-assisted log analysis.
 */
interface PailErrorOptions {
    /** The root cause of this error */
    cause?: unknown;
    /** A suggested resolution or steps to fix the issue */
    fix?: string;
    /** A link to relevant documentation or issue tracker */
    link?: string;
    /** The error message */
    message: string;
    /** HTTP status code associated with this error */
    status?: number;
    /** An explanation of what caused the failure */
    why?: string;
}

/**
 * Self-documenting error class for structured logging.
 *
 * Inspired by evlog's structured error approach, PailError extends the native
 * Error class with additional fields that make log entries immediately actionable:
 * - `why`: Explains what caused the failure
 * - `fix`: Suggests how to resolve the issue
 * - `link`: Points to relevant documentation
 * - `status`: HTTP status code for request-related errors
 *
 * These fields are preserved through the logging pipeline and displayed by reporters,
 * making it easier for both humans and AI agents to understand and resolve issues.
 * @example
 * ```typescript
 * import { PailError, createPailError } from "@visulima/pail/error";
 *
 * // Using the class directly
 * throw new PailError({
 *   message: "Payment processing failed",
 *   status: 402,
 *   why: "The customer's card was declined by the payment provider",
 *   fix: "Retry with a different payment method or contact the card issuer",
 *   link: "https://docs.example.com/payments/declined",
 * });
 *
 * // Using the factory function
 * throw createPailError("Connection timeout");
 *
 * // With full options
 * throw createPailError({
 *   message: "Database connection failed",
 *   why: "Connection pool exhausted after 30s timeout",
 *   fix: "Increase pool size or check for connection leaks",
 * });
 * ```
 */
class PailError extends Error {
    /** HTTP status code (defaults to 500) */
    public readonly status: number;

    /** Explanation of what caused the failure */
    public readonly why: string | undefined;

    /** Suggested resolution steps */
    public readonly fix: string | undefined;

    /** Link to relevant documentation */
    public readonly link: string | undefined;

    public constructor(options: PailErrorOptions | string) {
        const resolvedOptions = typeof options === "string" ? { message: options } : options;

        super(resolvedOptions.message, resolvedOptions.cause === undefined ? undefined : { cause: resolvedOptions.cause });

        this.name = "PailError";
        this.status = resolvedOptions.status ?? 500;
        this.why = resolvedOptions.why;
        this.fix = resolvedOptions.fix;
        this.link = resolvedOptions.link;
    }

    /**
     * Converts the error to a JSON-serializable object.
     *
     * Includes all self-documenting fields in the output for structured logging.
     * @returns A plain object representation of the error
     */
    public toJSON(): Record<string, unknown> {
        const json: Record<string, unknown> = {
            message: this.message,
            name: this.name,
            status: this.status,
        };

        if (this.why) {
            json.why = this.why;
        }

        if (this.fix) {
            json.fix = this.fix;
        }

        if (this.link) {
            json.link = this.link;
        }

        if (this.stack) {
            json.stack = this.stack;
        }

        if (this.cause !== undefined) {
            json.cause = this.cause instanceof Error ? { message: this.cause.message, name: this.cause.name, stack: this.cause.stack } : this.cause;
        }

        return json;
    }

    /**
     * Returns a formatted string representation including self-documenting fields.
     * @returns Formatted error string with why/fix/link context
     */
    public override toString(): string {
        let output = `${this.name} [${String(this.status)}]: ${this.message}`;

        if (this.why) {
            output += `\n  Why: ${this.why}`;
        }

        if (this.fix) {
            output += `\n  Fix: ${this.fix}`;
        }

        if (this.link) {
            output += `\n  Link: ${this.link}`;
        }

        if (this.cause !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string -- we explicitly want String() conversion for non-Error causes
            const causeMessage = this.cause instanceof Error ? this.cause.message : String(this.cause);

            output += `\n  Cause: ${causeMessage}`;
        }

        return output;
    }
}

/**
 * Factory function for creating PailError instances.
 *
 * A convenient shorthand for creating PailError objects. Accepts either
 * a string message or a full PailErrorOptions object.
 * @param options Error message string or PailErrorOptions object
 * @returns A new PailError instance
 * @example
 * ```typescript
 * import { createPailError } from "@visulima/pail/error";
 *
 * throw createPailError("Something went wrong");
 *
 * throw createPailError({
 *   message: "Auth failed",
 *   status: 401,
 *   why: "Token expired",
 *   fix: "Refresh the authentication token",
 * });
 * ```
 */
const createPailError = (options: PailErrorOptions | string): PailError => new PailError(options);

export { createPailError, PailError };
export type { PailErrorOptions };
