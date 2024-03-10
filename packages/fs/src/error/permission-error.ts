/**
 * Error thrown when an operation is not permitted.
 */
class PermissionError extends Error {
    /**
     * Name of the error class.
     * @type {string}
     */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "PermissionError";

    /**
     * Error code.
     * @type {string}
     */
    public code = "EPERM";

    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EPERM: Operation not permitted, ${message}`);
    }
}

export default PermissionError;
