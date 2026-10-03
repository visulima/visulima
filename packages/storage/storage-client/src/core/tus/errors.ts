/* eslint-disable max-classes-per-file -- the gone error specialises the response error; they belong together */

/**
 * A TUS request the server answered with an unexpected HTTP status.
 */
export class TusResponseError extends Error {
    public readonly status: number;

    public constructor(message: string, status: number) {
        super(message);
        this.name = "TusResponseError";
        this.status = status;
    }
}

/**
 * Thrown when the server reports the upload resource no longer exists
 * (404 / 410, or 403 on HEAD), so the client must not keep PATCHing it.
 */
export class TusUploadGoneError extends TusResponseError {
    public constructor(status: number) {
        super(`Upload expired or not found (${String(status)})`, status);
        this.name = "TusUploadGoneError";
    }
}
