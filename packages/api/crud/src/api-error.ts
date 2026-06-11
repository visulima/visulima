/**
 * Framework-agnostic API error used internally by the base CRUD handler.
 *
 * Previously this package deep-imported `ApiError` from `next/dist/server/api-utils`,
 * which made the "framework-agnostic" core throw on import when `next` was not
 * installed (it is only an optional peer) and was fragile across Next.js majors.
 *
 * `CrudApiError` is a drop-in replacement: it carries an HTTP `statusCode` and a
 * message, and the handler uses `instanceof CrudApiError` to decide whether an
 * error should bypass the adapter's `handleError` hook.
 */
class CrudApiError extends Error {
    public readonly statusCode: number;

    public constructor(statusCode: number, message: string) {
        super(message);

        this.name = "CrudApiError";
        this.statusCode = statusCode;

        // Restore prototype chain for environments that downlevel `extends Error`.
        Object.setPrototypeOf(this, CrudApiError.prototype);
    }
}

export default CrudApiError;
