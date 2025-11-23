import type { FileMeta } from "../react/types";

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
 * Parses error response from API.
 */
export const parseApiError = async (response: Response): Promise<Error> => {
    try {
        const errorData: ApiError = await response.json();

        return new Error(errorData.error?.message || `Request failed: ${response.status} ${response.statusText}`);
    } catch {
        return new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
};

/**
 * Extracts file metadata from response headers.
 */
export const extractFileMetaFromHeaders = (id: string, headers: Headers): FileMeta => {
    const contentType = headers.get("Content-Type");
    const contentLength = headers.get("Content-Length");
    const lastModified = headers.get("Last-Modified");
    const _etag = headers.get("ETag");

    const fileMeta: FileMeta = {
        contentType: contentType || undefined,
        id,
        size: contentLength ? Number.parseInt(contentLength, 10) : undefined,
    };

    if (lastModified) {
        fileMeta.createdAt = new Date(lastModified).toISOString();
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
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
};

/**
 * Fetches file with error handling.
 */
export const fetchFile = async (url: string): Promise<Blob> => {
    const response = await fetch(url, {
        method: "GET",
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.blob();
};

/**
 * Fetches JSON with error handling.
 */
export const fetchJson = async <T = unknown>(url: string): Promise<T> => {
    const response = await fetch(url, {
        method: "GET",
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.json() as Promise<T>;
};

/**
 * Fetches with HEAD method for metadata.
 */
export const fetchHead = async (url: string): Promise<Headers> => {
    const response = await fetch(url, {
        method: "HEAD",
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return response.headers;
};

/**
 * Deletes with error handling.
 */
export const deleteRequest = async (url: string): Promise<void> => {
    const response = await fetch(url, {
        method: "DELETE",
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
): Promise<{ etag?: string; location?: string; uploadExpires?: string }> =>
    new Promise((resolve, reject) => {
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
                    etag: xhr.getResponseHeader("ETag") || undefined,
                    location: xhr.getResponseHeader("Location") || undefined,
                    uploadExpires: xhr.getResponseHeader("X-Upload-Expires") || undefined,
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
        xhr.send(file);
    });

/**
 * PATCH request for chunk uploads.
 */
export const patchChunk = async (
    url: string,
    chunk: Blob,
    offset: number,
    checksum?: string,
): Promise<{ etag?: string; location?: string; uploadComplete?: boolean; uploadExpires?: string; uploadOffset?: number }> => {
    const headers: HeadersInit = {
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
    });

    if (!response.ok) {
        throw await parseApiError(response);
    }

    return {
        etag: response.headers.get("ETag") || undefined,
        location: response.headers.get("Location") || undefined,
        uploadComplete: response.headers.get("X-Upload-Complete") === "true",
        uploadExpires: response.headers.get("X-Upload-Expires") || undefined,
        uploadOffset: response.headers.get("X-Upload-Offset") ? Number.parseInt(response.headers.get("X-Upload-Offset")!, 10) : undefined,
    };
};
