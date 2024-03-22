/**
 * Error thrown when file already exists.
 */
class AlreadyExistsError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EEXIST: ${message}`);
    }

    get code() {
        return "EEXIST";
    }

    set code(_name) {
        throw new Error("Cannot overwrite code EEXIST");
    }

    override get name() {
        return "AlreadyExistsError";
    }

    override set name(_name) {
        throw new Error("Cannot overwrite name of AlreadyExistsError");
    }
}

export default AlreadyExistsError;
