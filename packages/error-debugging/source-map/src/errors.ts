/**
 * Thrown when the JS source file or its referenced `.map` file cannot be read
 * from disk. The originating error (e.g. an `ENOENT` `Error` with a `code`
 * property) is preserved on the `cause` property so consumers can still inspect
 * `error.cause.code === "ENOENT"`.
 */
// eslint-disable-next-line import/prefer-default-export -- two sibling error classes share this module
export class SourceMapReadError extends Error {
    public override readonly name = "SourceMapReadError";

    public constructor(context: string, cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);

        super(`${context}:\n${message}`, { cause });

        // Restore prototype chain for environments that down-level `extends Error`.
        Object.setPrototypeOf(this, SourceMapReadError.prototype);
    }
}
