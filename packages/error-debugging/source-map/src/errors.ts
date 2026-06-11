/**
 * Thrown when the JS source file or its referenced `.map` file cannot be read
 * from disk. The originating error (e.g. an `ENOENT` `Error` with a `code`
 * property) is preserved on the `cause` property so consumers can still inspect
 * `error.cause.code === "ENOENT"`.
 */
export class SourceMapReadError extends Error {
    public override readonly name = "SourceMapReadError";

    public constructor(context: string, cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);

        super(`${context}:\n${message}`, { cause });

        // Restore prototype chain for environments that down-level `extends Error`.
        Object.setPrototypeOf(this, SourceMapReadError.prototype);
    }
}

/**
 * Thrown when a source map's contents cannot be parsed into a usable trace map.
 * The originating parse error is preserved on the `cause` property.
 */
export class SourceMapParseError extends Error {
    public override readonly name = "SourceMapParseError";

    public constructor(context: string, cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);

        super(`${context}:\n${message}`, { cause });

        // Restore prototype chain for environments that down-level `extends Error`.
        Object.setPrototypeOf(this, SourceMapParseError.prototype);
    }
}
