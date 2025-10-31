/**
 * Security utilities for preventing injection attacks and malicious inputs
 */

/**
 * Maximum allowed length for argument values to prevent DoS attacks
 */
const MAX_ARGUMENT_LENGTH = 10_000;

/**
 * Dangerous characters that could be used for injection attacks
 */
const DANGEROUS_CHARS = new Set(["\n", "\r", "\t", "\0", "\"", "$", "&", "'", "(", ")", ";", "<", ">", "[", "\\", "]", "`", "{", "|", "}"]);

/**
 * Sanitizes a command argument to prevent injection attacks
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
 * Sanitizes an array of arguments
 */
export const sanitizeArguments = (args: ReadonlyArray<string>): string[] => {
    if (!Array.isArray(args)) {
        throw new TypeError("Arguments must be an array");
    }

    // Limit total number of arguments to prevent DoS
    const MAX_ARGS = 100;

    if (args.length > MAX_ARGS) {
        throw new Error(`Too many arguments (maximum ${MAX_ARGS})`);
    }

    return args.map(sanitizeArgument);
};

/**
 * Validates that a file path is safe (prevents directory traversal)
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
 */
export class RateLimiter {
    private attempts = new Map<string, { count: number; resetTime: number }>();

    private readonly maxAttempts: number;

    private readonly windowMs: number;

    public constructor(maxAttempts = 5, windowMs = 60_000) {
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    public checkLimit(key: string): boolean {
        const now = Date.now();
        const record = this.attempts.get(key);

        if (!record || now > record.resetTime) {
            this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });

            return true;
        }

        if (record.count >= this.maxAttempts) {
            return false;
        }

        record.count++;

        return true;
    }

    public reset(key: string): void {
        this.attempts.delete(key);
    }
}
