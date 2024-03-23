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

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public get code(): string {
        return "EISDIR";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code EISDIR");
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public override get name(): string {
        return "DirectoryError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of DirectoryError");
    }
}

export default DirectoryError;
