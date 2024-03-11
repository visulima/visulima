/**
 * Error thrown when a directory is not empty.
 */
class NotEmptyError extends Error {
    /**
     * Error code.
     * @type {string}
     */
    public code = "ENOTEMPTY";

    /**
     * Name of the error class.
     * @type {string}
     */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "NotEmptyError";

    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOTEMPTY: Directory not empty, ${message}`);
    }
}

export default NotEmptyError;
