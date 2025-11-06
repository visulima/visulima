/**
 * Error thrown when a log entry exceeds the maximum allowed size.
 */
class LogSizeError extends Error {
    /**
     * The log entry data that caused the error
     */
    public readonly logData: Record<string, unknown>;

    /**
     * The actual size of the log entry in bytes
     */
    public readonly actualSize: number;

    /**
     * The maximum allowed size in bytes
     */
    public readonly maxSize: number;

    /**
     * Creates a new LogSizeError instance.
     * @param message Descriptive error message explaining the size violation
     * @param logData The log entry data that caused the error
     * @param actualSize Size of the log entry in bytes
     * @param maxSize Maximum allowed size in bytes
     * @example
     * ```typescript
     * throw new LogSizeError("Log too large", logData, 2000000, 1000000);
     * ```
     */
    public constructor(message: string, logData: Record<string, unknown>, actualSize: number, maxSize: number) {
        super(message);
        this.name = "LogSizeError";
        this.logData = logData;
        this.actualSize = actualSize;
        this.maxSize = maxSize;
    }
}

export default LogSizeError;
