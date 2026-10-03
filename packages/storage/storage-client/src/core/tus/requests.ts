import { TusResponseError, TusUploadGoneError } from "./errors";
import { encodeMetadata, isGoneStatus, parseOffsetHeader, resolveUploadUrl, TUS_RESUMABLE_VERSION } from "./protocol";

type BuildHeaders = (url: string, method: string, requestHeaders: Record<string, string>) => Promise<Record<string, string>>;

export interface TusRequestsOptions {
    /** Merges adapter-level headers with the per-request TUS protocol headers. */
    buildHeaders: BuildHeaders;
    /** TUS creation endpoint. */
    endpoint: string;
}

export interface TusRequests {
    /** POST a new upload; resolves with its absolute URL and the server's initial offset. */
    create: (file: File, metadata: Record<string, string>) => Promise<{ initialOffset: number; uploadUrl: string }>;
    /** HEAD the upload and return the server's offset; throws `TusUploadGoneError` when it no longer exists. */
    getOffset: (uploadUrl: string, signal?: AbortSignal) => Promise<number>;
    /** Raw HEAD request against the upload URL. */
    head: (uploadUrl: string, signal?: AbortSignal) => Promise<Response>;
    /** PATCH one chunk at `offset`; resolves with the server's new offset. */
    patch: (uploadUrl: string, offset: number, chunk: Blob, signal: AbortSignal) => Promise<number>;
    /** Best-effort DELETE (Termination extension); never rejects. */
    terminate: (uploadUrl: string) => Promise<void>;
}

/**
 * The raw TUS 1.0.0 requests (Core + Creation + Termination), with the
 * protocol's status handling applied.
 */
export const createTusRequests = ({ buildHeaders, endpoint }: TusRequestsOptions): TusRequests => {
    const head = async (uploadUrl: string, signal?: AbortSignal): Promise<Response> =>
        fetch(uploadUrl, {
            headers: await buildHeaders(uploadUrl, "HEAD", { "Tus-Resumable": TUS_RESUMABLE_VERSION }),
            method: "HEAD",
            signal,
        });

    /**
     * According to TUS protocol: HEAD returns 200 OK with Upload-Offset, or 404/410/403
     * if the upload doesn't exist — surfaced as `TusUploadGoneError` so the caller
     * re-creates the upload instead of PATCHing a dead URL.
     */
    const getOffset = async (uploadUrl: string, signal?: AbortSignal): Promise<number> => {
        const response = await head(uploadUrl, signal);

        if (!response.ok) {
            if (isGoneStatus(response.status, true)) {
                throw new TusUploadGoneError(response.status);
            }

            throw new TusResponseError(`Failed to get upload offset: ${String(response.status)} ${response.statusText}`, response.status);
        }

        return parseOffsetHeader(response.headers.get("Upload-Offset"));
    };

    return {
        /**
         * According to TUS protocol: POST returns 201 Created (or 200 if Creation With Upload extension is used).
         * Headers: Location (required), Tus-Resumable (required), Upload-Offset (optional, if data was uploaded).
         */
        create: async (file: File, metadata: Record<string, string>): Promise<{ initialOffset: number; uploadUrl: string }> => {
            const response = await fetch(endpoint, {
                headers: await buildHeaders(endpoint, "POST", {
                    "Tus-Resumable": TUS_RESUMABLE_VERSION,
                    "Upload-Length": file.size.toString(),
                    "Upload-Metadata": encodeMetadata({ filename: file.name, filetype: file.type, ...metadata }),
                }),
                method: "POST",
            });

            if (response.status !== 201 && response.status !== 200) {
                throw new TusResponseError(`Failed to create upload: ${String(response.status)} ${response.statusText}`, response.status);
            }

            const location = response.headers.get("Location");

            if (!location) {
                throw new Error("No Location header in response");
            }

            return {
                initialOffset: parseOffsetHeader(response.headers.get("Upload-Offset")),
                uploadUrl: resolveUploadUrl(location, endpoint),
            };
        },

        getOffset,

        head,

        /**
         * According to TUS protocol: PATCH returns 204 No Content (200 tolerated for older servers).
         * Headers: Tus-Resumable (required), Upload-Offset (required), Upload-Expires (optional).
         * Can return 409 Conflict if Upload-Offset doesn't match server's offset.
         */
        patch: async (uploadUrl: string, offset: number, chunk: Blob, signal: AbortSignal): Promise<number> => {
            const response = await fetch(uploadUrl, {
                body: chunk,
                headers: await buildHeaders(uploadUrl, "PATCH", {
                    "Content-Length": chunk.size.toString(), // Explicitly set Content-Length as required by TUS protocol
                    "Content-Type": "application/offset+octet-stream",
                    "Tus-Resumable": TUS_RESUMABLE_VERSION,
                    "Upload-Offset": offset.toString(),
                }),
                method: "PATCH",
                signal,
            });

            // TUS protocol: PATCH must return 204 No Content. Also accept 200, which
            // @visulima/storage <= 2.0.25 sent for the completing chunk (#899).
            if (response.status !== 204 && response.status !== 200) {
                if (response.status === 409) {
                    // Offset mismatch: continue from the server's offset.
                    return getOffset(uploadUrl, signal);
                }

                // The upload resource is gone — the caller re-creates it instead of retrying.
                if (isGoneStatus(response.status)) {
                    throw new TusUploadGoneError(response.status);
                }

                if (response.status === 415) {
                    throw new TusResponseError("Content-Type must be application/offset+octet-stream", response.status);
                }

                throw new TusResponseError(`Failed to upload chunk: ${String(response.status)} ${response.statusText}`, response.status);
            }

            // TUS protocol: Response must include Upload-Offset header
            const newOffsetHeader = response.headers.get("Upload-Offset");

            if (!newOffsetHeader) {
                throw new Error("Missing Upload-Offset header in PATCH response");
            }

            const parsed = Number.parseInt(newOffsetHeader, 10);

            if (!Number.isFinite(parsed)) {
                throw new TypeError("Invalid Upload-Offset header in PATCH response");
            }

            return parsed;
        },

        terminate: async (uploadUrl: string): Promise<void> => {
            try {
                await fetch(uploadUrl, {
                    headers: await buildHeaders(uploadUrl, "DELETE", { "Tus-Resumable": TUS_RESUMABLE_VERSION }),
                    method: "DELETE",
                });
            } catch {
                // Best effort: the server may not support termination or be unreachable.
            }
        },
    };
};
