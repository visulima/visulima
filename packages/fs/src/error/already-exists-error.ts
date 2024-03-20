/**
 * Error thrown when file already exists.
 */
class AlreadyExistsError extends Error {
    /**
     * Name of the error class.
     * @type {string}
     */
    // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
    override readonly name = "AlreadyExistsError";

    /**
     * Error code.
     * @type {string}
     */
    public code = "EEXIST";

    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EEXIST: ${message}`);
    }
}

export default AlreadyExistsError;
