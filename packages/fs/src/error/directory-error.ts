/**
 * Error thrown when an operation is not allowed on a directory.
 */
class DirectoryError extends Error {
    /**
     * Name of the error class.
     * @type {string}
     */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "DirectoryError";

    /**
     * Error code.
     * @type {string}
     */
    public code = "EISDIR";

    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EISDIR: Illegal operation on a directory, ${message}`);
    }
}

export default DirectoryError;
