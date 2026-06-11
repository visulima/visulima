import type { FileMeta, HeadersResolver } from "./types";

/**
 * Error response from the API
 */
export interface ApiError {
    error: {
        code: string;
        message: string;
        name?: string;
    };
}

/**
 * Typed error thrown by all fetch helpers. Carries the HTTP `status` and the
 * server-provided machine-readable `code` (from `error.code`) so consumers can
 * distinguish 404 vs 413 vs a network failure without string-matching the
 * message.
 * @example
 * ```ts
 * try {
 *     await fetchFile(url);
 * } catch (error) {
 *     if (error instanceof UploadError && error.status === 404) {
 *         // handle not-found
 *     }
 * }
 * ```
 */
export class UploadError extends Error {
    /** Server-provided machine-readable error code (`error.code`), if any. */
    public readonly code?: string;

    /** HTTP status code, or 0 for a network/transport failure. */
    public readonly status: number;

    public constructor(message: string, options: { code?: string; status?: number } = {}) {
        super(message);

        this.name = "UploadError";
        this.code = options.code;
        this.status = options.status ?? 0;
    }
}

/**
 * Options shared by the fetch helpers. Lets callers forward an `AbortSignal`
 * (e.g. TanStack Query's `signal`) and attach custom/auth headers.
 */
export interface RequestOptions {
    /** Static or dynamically-resolved headers to attach (e.g. `Authorization`). */
    headers?: HeadersResolver;
    /** Abort signal to cancel the request on unmount/refetch. */
    signal?: AbortSignal;
}

/**
 * Resolves a `HeadersResolver` (static object or sync/async factory) to a plain
 * headers object. Returns an empty object when nothing is provided.
 */
export const resolveHeaders = async (headers?: HeadersResolver): Promise<Record<string, string>> => {
    if (!headers) {
        return {};
    }

    if (typeof headers === "function") {
        return headers();
    }

    return headers;
};

/**
 * Parses error response from API into a typed {@link UploadError} that preserves
 * the HTTP status and the server-provided `error.code`.
 */
export const parseApiError = async (response: Response): Promise<UploadError> => {
    const { status } = response;

    try {
        const errorData = (await response.json()) as ApiError;

        return new UploadError(errorData.error.message || `Request failed: ${String(status)} ${response.statusText}`, {
            code: errorData.error.code,
            status,
        });
    } catch {
        return new UploadError(`Request failed: ${String(status)} ${response.statusText}`, { status });
    }
};

/**
 * Extracts file metadata from response headers.
 */
export const extractFileMetaFromHeaders = (id: string, headers: Headers): FileMeta => {
    const contentType = headers.get("Content-Type");
    const contentLength = headers.get("Content-Length");
    const lastModified = headers.get("Last-Modified");

    const fileMeta: FileMeta = {
        contentType: contentType ?? undefined,
        id,
        size: contentLength ? Number.parseInt(contentLength, 10) : undefined,
    };

    if (lastModified) {
        const date = new Date(lastModified);

        if (!Number.isNaN(date.getTime())) {
            fileMeta.createdAt = date.toISOString();
        }
    }

    return fileMeta;
};

/**
 * Builds URL with query parameters.
 */
export const buildUrl = (baseUrl: string, path: string, params?: Record<string, string | number | boolean | undefined>): string => {
    const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
};

/**
 * Fetches file with error handling.
 */
export const fetchFile = async (url: string, options: RequestOptions = {}): Promise<Blob> => {
    const response = await fetch(url, {
        headers: await resolveHeaders(options.headers),
        method: "GET",
        signal: options.signal,
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.blob();
};

/**
 * Fetches JSON with error handling.
 */
export const fetchJson = async <T = unknown>(url: string, options: RequestOptions = {}): Promise<T> => {
    const response = await fetch(url, {
        headers: await resolveHeaders(options.headers),
        method: "GET",
        signal: options.signal,
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.json() as Promise<T>;
};

/**
 * Fetches with HEAD method for metadata.
 */
export const fetchHead = async (url: string, options: RequestOptions = {}): Promise<Headers> => {
    const response = await fetch(url, {
        headers: await resolveHeaders(options.headers),
        method: "HEAD",
        signal: options.signal,
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.headers;
};

/**
 * Deletes with error handling.
 */
export const deleteRequest = async (url: string, options: RequestOptions = {}): Promise<void> => {
    const response = await fetch(url, {
        headers: await resolveHeaders(options.headers),
        method: "DELETE",
        signal: options.signal,
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }
};

/**
 * PUT request with file upload and progress tracking.
 */
export const putFile = async (
    url: string,
    file: File | Blob,
    onProgress?: (progress: number) => void,
    options: { headers?: HeadersResolver } = {},
): Promise<{ etag?: string; location?: string; uploadExpires?: string }> => {
    const customHeaders = await resolveHeaders(options.headers);

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);

                onProgress(percentComplete);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    etag: xhr.getResponseHeader("ETag") ?? undefined,
                    location: xhr.getResponseHeader("Location") ?? undefined,
                    uploadExpires: xhr.getResponseHeader("X-Upload-Expires") ?? undefined,
                });
            } else {
                parseApiError(new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText }))
                    .then(reject)
                    .catch(reject);
            }
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Network error occurred"));
        });

        xhr.addEventListener("abort", () => {
            reject(new Error("Request aborted"));
        });

        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        for (const [key, value] of Object.entries(customHeaders)) {
            xhr.setRequestHeader(key, value);
        }

        xhr.send(file);
    });
};

/**
 * PATCH request for chunk uploads.
 */
export const patchChunk = async (
    url: string,
    chunk: Blob,
    offset: number,
    checksum?: string,
    options: RequestOptions = {},
): Promise<{ etag?: string; location?: string; uploadComplete?: boolean; uploadExpires?: string; uploadOffset?: number }> => {
    const headers: Record<string, string> = {
        ...await resolveHeaders(options.headers),
        "Content-Type": "application/octet-stream",
        "X-Chunk-Offset": String(offset),
    };

    if (checksum) {
        headers["X-Chunk-Checksum"] = checksum;
    }

    const response = await fetch(url, {
        body: chunk,
        headers,
        method: "PATCH",
        signal: options.signal,
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return {
        etag: response.headers.get("ETag") ?? undefined,
        location: response.headers.get("Location") ?? undefined,
        uploadComplete: response.headers.get("X-Upload-Complete") === "true",
        uploadExpires: response.headers.get("X-Upload-Expires") ?? undefined,
        uploadOffset: (() => {
            const offsetHeader = response.headers.get("X-Upload-Offset");

            return offsetHeader ? Number.parseInt(offsetHeader, 10) : undefined;
        })(),
    };
};
