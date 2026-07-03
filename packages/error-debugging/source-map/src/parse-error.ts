/**
 * Thrown when a source map could be read but could not be parsed (invalid JSON
 * or an invalid Source Map v3 document). The originating parse error is
 * preserved on `cause`.
 */
// eslint-disable-next-line import/prefer-default-export -- named export keeps the error-class API discoverable
export class SourceMapParseError extends Error {
    public override readonly name = "SourceMapParseError";

    public constructor(context: string, cause: unknown) {
        const message = cause instanceof Error ? cause.message : String(cause);

        super(`${context}:\n${message}`, { cause });

        Object.setPrototypeOf(this, SourceMapParseError.prototype);
    }
}
