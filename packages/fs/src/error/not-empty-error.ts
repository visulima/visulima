/**
 * Error thrown when a directory is not empty.
 */
class NotEmptyError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`ENOTEMPTY: Directory not empty, ${message}`);
    }

    get code() {
        return "ENOTEMPTY";
    }

    set code(_name) {
        throw new Error("Cannot overwrite code ENOTEMPTY");
    }

    override get name() {
        return "NotEmptyError";
    }

    override set name(_name) {
        throw new Error("Cannot overwrite name of NotEmptyError");
    }
}

export default NotEmptyError;
