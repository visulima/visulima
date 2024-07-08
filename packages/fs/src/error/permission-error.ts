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

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "EPERM";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EPERM");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "PermissionError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of PermissionError");
    }
}

export default PermissionError;
