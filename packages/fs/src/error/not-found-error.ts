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

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public get code(): string {
        return "ENOENT";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code ENOENT");
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public override get name(): string {
        return "NotFoundError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of NotFoundError");
    }
}

export default NotFoundError;
