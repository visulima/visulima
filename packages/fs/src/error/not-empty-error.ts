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

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public get code(): string {
        return "ENOTEMPTY";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public set code(_name) {
        throw new Error("Cannot overwrite code ENOTEMPTY");
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/class-literal-property-style
    public override get name(): string {
        return "NotEmptyError";
    }

    // eslint-disable-next-line class-methods-use-this,@typescript-eslint/explicit-module-boundary-types
    public override set name(_name) {
        throw new Error("Cannot overwrite name of NotEmptyError");
    }
}

export default NotEmptyError;
