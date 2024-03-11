/**
 * Error thrown when a file or directory is not found.
 */
class NotFoundError extends Error {
    /**
     * Name of the error class.
     * @type {string}
     */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "NotFoundError";

    /**
     * Error code.
     * @type {string}
     */
    public code = "ENOENT";

    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOENT: No such file or directory, ${message}`);
    }
}

export default NotFoundError;
