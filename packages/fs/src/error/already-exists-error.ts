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

    // eslint-disable-next-line class-methods-use-this
    public get code(): string {
        return "EEXIST";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EEXIST");
    }

    // eslint-disable-next-line class-methods-use-this
    public override get name(): string {
        return "AlreadyExistsError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of AlreadyExistsError");
    }
}

export default AlreadyExistsError;
