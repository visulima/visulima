/**
 * Error thrown when an operation is not allowed on a directory.
 */
class DirectoryError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EISDIR: Illegal operation on a directory, ${message}`);
    }

    get code() {
        return "EISDIR";
    }

    set code(_name) {
        throw new Error("Cannot overwrite code EISDIR");
    }

    override get name() {
        return "DirectoryError";
    }

    override set name(_name) {
        throw new Error("Cannot overwrite name of DirectoryError");
    }
}

export default DirectoryError;
