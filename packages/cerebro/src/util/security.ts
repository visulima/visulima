/**
 * Security utilities for preventing injection attacks and malicious inputs
 */

/**
 * Maximum allowed length for argument values to prevent DoS attacks
 */
const MAX_ARGUMENT_LENGTH = 10_000;

/**
 * Maximum allowed number of arguments to prevent DoS attacks
 */
const MAX_ARGS = 100;

/**
 * Dangerous characters that could be used for injection attacks
 */
const DANGEROUS_CHARS = new Set(["\n", "\r", "\t", "\0", "\"", "$", "&", "'", "(", ")", ";", "<", ">", "[", "\\", "]", "`", "{", "|", "}"]);

/**
 * Sanitizes a command argument to prevent injection attacks.
 * @param argument The argument string to sanitize.
 * @returns The sanitized argument with whitespace trimmed.
 * @throws {TypeError} If the argument is not a string.
 * @throws {Error} If the argument exceeds maximum length or contains dangerous characters.
 */
export const sanitizeArgument = (argument: string): string => {
    if (typeof argument !== "string") {
        throw new TypeError("Argument must be a string");
    }

    // Check length limit
    if (argument.length > MAX_ARGUMENT_LENGTH) {
        throw new Error(`Argument is too long (maximum ${MAX_ARGUMENT_LENGTH} characters)`);
    }

    // Check for dangerous characters
    for (const char of argument) {
        if (DANGEROUS_CHARS.has(char)) {
            throw new Error(`Argument contains dangerous character: ${char}`);
        }
    }

    // Trim whitespace
    return argument.trim();
};

/**
 * Sanitizes an array of arguments.
 * @param args The array of arguments to sanitize.
 * @returns Array of sanitized arguments.
 * @throws {TypeError} If args is not an array or if any argument is not a string.
 * @throws {Error} If there are too many arguments or if any argument is invalid.
 */
export const sanitizeArguments = (args: ReadonlyArray<string>): string[] => {
    if (!Array.isArray(args)) {
        throw new TypeError("Arguments must be an array");
    }

    if (args.length > MAX_ARGS) {
        throw new Error(`Too many arguments (maximum ${MAX_ARGS})`);
    }

    return args.map((argument) => sanitizeArgument(argument));
};

/**
 * Validates that a file path is safe (prevents directory traversal).
 * @param path The file path to validate.
 * @returns The validated path with whitespace trimmed.
 * @throws {TypeError} If the path is not a string.
 * @throws {Error} If the path contains traversal sequences, is absolute, or exceeds maximum length.
 */
export const validateSafePath = (path: string): string => {
    if (typeof path !== "string") {
        throw new TypeError("Path must be a string");
    }

    const sanitizedPath = path.trim();

    // Check for directory traversal attempts
    if (sanitizedPath.includes("..") || sanitizedPath.includes("../") || sanitizedPath.includes("..\\")) {
        throw new Error("Path contains directory traversal sequences");
    }

    // Check for absolute paths that could be dangerous
    if (sanitizedPath.startsWith("/") || /^[A-Z]:/i.test(sanitizedPath)) {
        throw new Error("Absolute paths are not allowed");
    }

    // Check length
    if (sanitizedPath.length > 1000) {
        throw new Error("Path is too long");
    }

    return sanitizedPath;
};

/**
 * Rate limiting helper to prevent brute force attacks
 * Automatically cleans up expired entries to prevent memory leaks
 */
export class RateLimiter {
    private attempts = new Map<string, { count: number; resetTime: number }>();

    private readonly maxAttempts: number;

    private readonly windowMs: number;

    /**
     * Creates a new RateLimiter instance.
     * @param maxAttempts Maximum number of attempts allowed within the time window (default: 5).
     * @param windowMs Time window in milliseconds (default: 60000).
     */
    public constructor(maxAttempts = 5, windowMs = 60_000) {
        if (maxAttempts <= 0 || windowMs <= 0) {
            throw new Error("maxAttempts and windowMs must be positive numbers");
        }

        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    /**
     * Checks if the key has exceeded the rate limit.
     * @param key Unique identifier for the rate limit check.
     * @returns true if the request is allowed, false if rate limit exceeded.
     */
    public checkLimit(key: string): boolean {
        const now = Date.now();
        const record = this.attempts.get(key);

        if (!record || now > record.resetTime) {
            this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
            this.cleanup(now);

            return true;
        }

        if (record.count >= this.maxAttempts) {
            return false;
        }

        record.count += 1;

        return true;
    }

    /**
     * Resets the rate limit for a specific key.
     * @param key The key to reset.
     */
    public reset(key: string): void {
        this.attempts.delete(key);
    }

    /**
     * Removes expired entries from the attempts map.
     * @param now Current timestamp.
     */
    private cleanup(now: number): void {
        for (const [key, record] of this.attempts.entries()) {
            if (now > record.resetTime) {
                this.attempts.delete(key);
            }
        }
    }
}
