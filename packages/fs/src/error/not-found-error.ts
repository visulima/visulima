/**
 * Error thrown when a file or directory is not found.
 */
class NotFoundError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOENT: ${message}`);
    }

    get code() {
        return "ENOENT";
    }

    set code(_name) {
        throw new Error("Cannot overwrite code ENOENT");
    }

    override get name() {
        return "NotFoundError";
    }

    override set name(_name) {
        throw new Error("Cannot overwrite name of NotFoundError");
    }
}

export default NotFoundError;
