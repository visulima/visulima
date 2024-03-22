/**
 * Error thrown when an operation is not permitted.
 */
class PermissionError extends Error {
    /**
     * Creates a new instance.
     * @param {string} message The error message.
     */
    public constructor(message: string) {
        super(`EPERM: Operation not permitted, ${message}`);
    }

    get code() {
        return "EPERM";
    }

    set code(_name) {
        throw new Error("Cannot overwrite code EPERM");
    }

    override get name() {
        return "PermissionError";
    }

    override set name(_name) {
        throw new Error("Cannot overwrite name of PermissionError");
    }
}

export default PermissionError;
