import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { format } from "node:url";

import { paginate } from "@visulima/pagination";
import createHttpError from "http-errors";
import mime from "mime";

import type { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";
import type MediaTransformer from "../../transformer/media-transformer";
import type { ErrorResponses } from "../../utils/errors";
import { ErrorMap, ERRORS } from "../../utils/errors";
import { HeaderUtilities } from "../../utils/headers";
import { assertSafeUrlId, COMMON_PATH_NAMES, getBaseUrl, uuidRegex } from "../../utils/http";
import type { ResponseBodyType } from "../../utils/types";
import type { ResponseFile, ResponseList, UploadOptions } from "../types";
import { parseIntegerHeader } from "../utils/request-parser";

/**
 * A file addressed by a GET/download path.
 */
export interface FileTarget {
    /** Extension given in the URL (`id.ext`), used to refine image content types. */
    ext?: string;
    /** Whether `/:id/metadata` was requested. */
    isMetadataRequest: boolean;
    /** Whether the id has the shape of a generated id; other ids may also be a collection path. */
    isUuidLike: boolean;
    /** The file id. */
    uuid: string;
}

/**
 * Splits a GET/download path into the addressed file id, an optional extension and whether `/metadata` was requested.
 * A trailing `/metadata` or `/download` segment addresses the id before it. Segments are used as-is (not URL-decoded),
 * like the id parsers of the mutating methods, so every method addresses the same id.
 * @param path Request path (without query string)
 * @returns The parsed target, or `undefined` when the path does not address a file
 * @throws {HttpError} 400 when the id is unsafe (path traversal, absolute path, …)
 */
export const parseFilePath = (path: string): FileTarget | undefined => {
    const segments = path.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const hasActionSegment = segments.length >= 2 && (lastSegment === "metadata" || lastSegment === "download");
    const idSegment = segments[segments.length - (hasActionSegment ? 2 : 1)];

    if (!idSegment) {
        return undefined;
    }

    const extensionMatch = /^(.+)\.([^.]+)$/.exec(idSegment);
    const uuid = extensionMatch?.[1] ?? idSegment;

    if (COMMON_PATH_NAMES.includes(uuid.toLowerCase())) {
        return undefined;
    }

    assertSafeUrlId(uuid);

    return { ext: extensionMatch?.[2], isMetadataRequest: hasActionSegment && lastSegment === "metadata", isUuidLike: uuidRegex.test(uuid), uuid };
};

/**
 * Refines an image content type from the extension given in the URL (e.g. `id.webp`).
 * @param contentType Stored content type
 * @param extension Extension from the URL
 * @returns The content type to serve
 */
export const resolveContentType = (contentType: string, extension: string | undefined): string => {
    if (extension === undefined || !contentType.includes("image")) {
        return contentType;
    }

    return mime.getType(extension) || contentType;
};

/**
 * Builds the optional `X-Upload-Expires` / `Last-Modified` / `ETag` headers of a stored file.
 */
const fileStateHeaders = (file: Pick<UploadFile, "ETag" | "expiredAt" | "modifiedAt"> | undefined): Record<string, string> => {
    return {
        ...(file?.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() }),
        ...(file?.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() }),
        ...(file?.ETag === undefined ? {} : { ETag: file.ETag }),
    };
};

/**
 * Maximum number of files a list request (`allowList`) reads from storage, and the maximum `limit`.
 * This is the HTTP contract, independent of how many requests a provider needs to fetch them.
 */
const MAX_LIST_ITEMS = 1000;

const JSON_CONTENT_TYPE = HeaderUtilities.createContentType({ charset: "utf8", mediaType: "application/json" });

const isNotFound = (error: unknown): boolean => {
    const { UploadErrorCode } = error as { UploadErrorCode?: string };

    return UploadErrorCode === ERRORS.FILE_NOT_FOUND || UploadErrorCode === ERRORS.GONE;
};

/**
 * Core base class containing shared business logic for all handlers.
 * This class is platform-agnostic and contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
abstract class BaseHandlerCore<TFile extends UploadFile> extends EventEmitter {
    /**
     * Response body type for the handler.
     */
    public responseType: ResponseBodyType = "json";

    /**
     * Storage instance for file operations.
     */
    public storage: BaseStorage<TFile>;

    /**
     * Optional media transformer for image/video processing.
     */
    public mediaTransformer?: MediaTransformer;

    /**
     * Whether `GET` on the collection path lists all stored files. See {@link UploadOptions.allowList}.
     */
    public allowList: boolean;

    /**
     * Whether to disable termination for finished uploads.
     */
    public disableTerminationForFinishedUploads?: boolean;

    /**
     * Logger instance for debugging and error reporting.
     */
    protected logger?: Console;

    /**
     * Gets the logger instance.
     * @returns Logger instance or undefined.
     */
    public get loggerInstance(): Console | undefined {
        return this.logger;
    }

    /**
     * Internal error responses configuration.
     */
    protected internalErrorResponses = {} as ErrorResponses;

    /**
     * Gets the error responses configuration.
     * @returns Error responses configuration.
     */
    public get errorResponses(): ErrorResponses {
        return this.internalErrorResponses;
    }

    public constructor({ allowList = false, disableTerminationForFinishedUploads, mediaTransformer, storage }: UploadOptions<TFile>) {
        super();

        this.allowList = allowList;
        this.storage = storage;
        this.mediaTransformer = mediaTransformer;
        this.disableTerminationForFinishedUploads = disableTerminationForFinishedUploads;
        this.logger = this.storage?.logger;

        this.assembleErrors();
    }

    /**
     * Sets custom error responses.
     * @param value Partial error responses to override defaults.
     */
    public set errorResponses(value: Partial<ErrorResponses>) {
        this.assembleErrors(value);
    }

    /**
     * Assemble error responses by merging defaults with custom overrides.
     * @param customErrors Custom error responses to override defaults
     */
    public assembleErrors = (customErrors = {}): void => {
        this.internalErrorResponses = {
            ...ErrorMap,
            ...this.internalErrorResponses,
            ...this.storage.errorResponses,
            ...customErrors,
        };
    };

    /**
     * Parses HTTP Range header and returns start/end byte positions for partial content requests.
     * @param rangeHeader HTTP Range header value (e.g., "bytes=0-1023").
     * @param fileSize Total size of the file in bytes.
     * @returns Object with start and end positions, or undefined if range is invalid.
     */
    // eslint-disable-next-line class-methods-use-this
    public parseRangeHeader(rangeHeader: string | undefined, fileSize: number): { end: number; start: number } | undefined {
        if (!rangeHeader?.startsWith("bytes=")) {
            return undefined;
        }

        const ranges = rangeHeader.slice(6).split(",");

        if (ranges.length !== 1) {
            // Multiple ranges not supported
            return undefined;
        }

        const range = ranges[0]?.trim();

        if (!range) {
            return undefined;
        }

        const parts = range.split("-");

        if (parts.length !== 2) {
            return undefined;
        }

        const [startString, endString] = parts;
        let start: number;
        let end: number;

        if (startString && endString) {
            // bytes=start-end
            start = Number.parseInt(startString, 10);
            end = Number.parseInt(endString, 10);
        } else if (startString && !endString) {
            // bytes=start- (open-ended range)
            start = Number.parseInt(startString, 10);
            end = fileSize - 1;
        } else if (!startString && endString) {
            // bytes=-end (suffix range)
            const suffixLength = Number.parseInt(endString, 10);

            start = Math.max(0, fileSize - suffixLength);
            end = fileSize - 1;
        } else {
            return undefined; // Invalid range (both empty)
        }

        // Validate range
        if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
            return undefined;
        }

        return { end, start };
    }

    /**
     * Build file URL from request and file data.
     * Platform-agnostic version that accepts URL string.
     *
     * When `useRelativeLocation` is `false` (the default) the absolute origin is resolved from, in
     * order: an absolute `requestUrl` (the fetch runtimes pass `request.url`, which carries the
     * origin), then the host/proto derived from `requestHeaders` (the Node runtimes pass the request
     * headers, since `request.url` there is only a path). If neither yields a host the Location
     * stays relative rather than emitting a bogus `http://localhost` origin.
     * @param requestUrl Request URL string (absolute on fetch runtimes, path-only on Node).
     * @param file File object containing ID and content type
     * @param requestHeaders Optional request headers used to recover host/proto on Node runtimes.
     * @returns Constructed file URL with extension based on content type
     */
    protected buildFileUrlFromString(requestUrl: string, file: TFile, requestHeaders?: IncomingMessage["headers"]): string {
        const url = new URL(requestUrl, "http://localhost");
        const { pathname } = url;
        const query = Object.fromEntries(url.searchParams.entries());
        const relative = format({ pathname: `${pathname.replace(/\/$/, "")}/${file.id}`, query });

        let baseUrl = "";

        if (!this.storage.config.useRelativeLocation) {
            // An absolute requestUrl (fetch runtimes) already carries the origin.
            if (/^https?:\/\//iu.test(requestUrl)) {
                baseUrl = url.origin;
            } else if (requestHeaders) {
                // Node runtimes: request.url is a path, so recover host/proto from the headers.
                baseUrl = getBaseUrl({ headers: requestHeaders } as IncomingMessage);
            }
        }

        return `${baseUrl}${relative}.${mime.getExtension(file.contentType)}`;
    }

    /**
     * Negotiates content type based on Accept header and supported formats.
     * Platform-agnostic version that accepts header string.
     * @param acceptHeader Accept header value
     * @param supportedTypes Array of supported MIME types to match against
     * @returns Best matching content type or undefined if no match found
     */
    // eslint-disable-next-line class-methods-use-this
    public negotiateContentTypeFromHeader(acceptHeader: string | undefined, supportedTypes: string[]): string | undefined {
        if (!acceptHeader) {
            return undefined;
        }

        return HeaderUtilities.getPreferredMediaType(acceptHeader, supportedTypes);
    }

    /**
     * Resolves a GET request: the addressed file, or - when listing is enabled - the list of files.
     * @param path Request path (without query string).
     * @param searchParams Query parameters of the request.
     * @param hasRange Whether the request carries a `Range` header.
     * @param list Produces the file list for paths that do not address a file.
     * @returns The file or list response.
     * @throws {HttpError} 404 when the path does not address a stored file and listing is disabled.
     */
    protected async resolveGet(
        path: string,
        searchParams: URLSearchParams,
        hasRange: boolean,
        list: () => Promise<ResponseList<TFile>>,
    ): Promise<ResponseFile<TFile> | ResponseList<TFile>> {
        const file = await this.getFileResponse(path, searchParams, hasRange);

        if (file) {
            return file;
        }

        if (!this.allowList) {
            throw createHttpError(404, "File not found");
        }

        return list();
    }

    /**
     * Resolves a GET request for a single file (or its `/metadata`) from the request path.
     * Platform-agnostic: shared by the Node and Fetch handlers.
     *
     * UUID-like segments are always file ids. Any other segment may be a file id (e.g. a nanoid or a
     * PUT-chosen id) or a collection path such as `/api/attachments`, so it falls back to the list
     * when no such file exists.
     * @param path Request path (without query string).
     * @param searchParams Query parameters of the request (used for media transformations).
     * @param hasRange Whether the request carries a `Range` header (forces streaming).
     * @returns The file response, or `undefined` when the path does not address a file and a list should be returned instead.
     * @throws {HttpError} 400 for unsafe ids, 404 when the file or its metadata is not found.
     */
    protected async getFileResponse(path: string, searchParams: URLSearchParams, hasRange: boolean): Promise<ResponseFile<TFile> | undefined> {
        const target = parseFilePath(path);

        if (!target) {
            return undefined;
        }

        if (target.isMetadataRequest) {
            return this.getMetadataResponse(target.uuid);
        }

        let fileMeta: TFile;

        try {
            fileMeta = await this.storage.getMeta(target.uuid);
        } catch (error: unknown) {
            if (!isNotFound(error)) {
                throw error;
            }

            if (!target.isUuidLike) {
                // Ambiguous segment that is not a stored file - treat as list request
                return undefined;
            }

            throw createHttpError(404, "File not found");
        }

        try {
            return (await this.getTransformedResponse(target.uuid, searchParams)) ?? (await this.getStoredFileResponse(fileMeta, target.ext, hasRange));
        } catch (error: unknown) {
            if (isNotFound(error)) {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Serves the stored metadata of a file as JSON.
     * @param id File id.
     * @returns The metadata response.
     * @throws {HttpError} 404 when the file does not exist.
     */
    private async getMetadataResponse(id: string): Promise<ResponseFile<TFile>> {
        let file: TFile;

        try {
            file = await this.storage.getMeta(id);
        } catch (error: unknown) {
            if (isNotFound(error)) {
                throw createHttpError(404, "File metadata not found");
            }

            throw error;
        }

        const { ETag: _etag, ...stateHeaders } = fileStateHeaders(file);

        return {
            ...file,
            content: JSON.stringify(file),
            headers: { "Content-Type": JSON_CONTENT_TYPE, ...stateHeaders },
            statusCode: 200,
        };
    }

    /**
     * Applies the media transformer when the request carries transformation query parameters.
     * @param id File id.
     * @param searchParams Query parameters of the request.
     * @returns The transformed response, or `undefined` when no transformation applies (or it failed and the original should be served).
     * @throws {HttpError} 400 when the transformation parameters are invalid.
     */
    private async getTransformedResponse(id: string, searchParams: URLSearchParams): Promise<ResponseFile<TFile> | undefined> {
        const queryParameters = Object.fromEntries(searchParams.entries());

        if (!this.mediaTransformer || Object.keys(queryParameters).length === 0) {
            return undefined;
        }

        try {
            const transformed = await this.mediaTransformer.handle(id, queryParameters);

            return {
                content: transformed.buffer,
                headers: {
                    "Content-Length": String(transformed.size),
                    "Content-Type": `${transformed.mediaType}/${transformed.format}`,
                    "X-Media-Type": transformed.mediaType,
                    "X-Original-Format": transformed.originalFile?.contentType?.split("/")[1] || "",
                    "X-Transformed-Format": transformed.format,
                    ...fileStateHeaders(transformed.originalFile),
                },
                statusCode: 200,
            } as unknown as ResponseFile<TFile>;
        } catch (error: unknown) {
            if ((error as { name?: string }).name === "ValidationError") {
                throw createHttpError(400, (error as Error).message);
            }

            // For other transformation errors, fall back to serving the original file
            this.logger?.warn(`Media transformation failed: ${(error as Error).message}`);

            return undefined;
        }
    }

    /**
     * Serves the original file, streamed for range requests and files over 1 MB when the storage supports it.
     * @param fileMeta Stored metadata of the file.
     * @param extension Extension from the URL.
     * @param hasRange Whether the request carries a `Range` header.
     * @returns The file response.
     */
    private async getStoredFileResponse(fileMeta: TFile, extension: string | undefined, hasRange: boolean): Promise<ResponseFile<TFile>> {
        const useStreaming = hasRange || (fileMeta.size !== undefined && fileMeta.size > 1024 * 1024);

        if (useStreaming && this.storage.getStream) {
            try {
                const streamResult = await this.storage.getStream({ id: fileMeta.id });
                const contentType = resolveContentType(streamResult.headers?.["Content-Type"] || fileMeta.contentType, extension);

                return {
                    ...fileMeta,
                    contentType,
                    headers: { ...streamResult.headers, "Accept-Ranges": "bytes", "Content-Type": contentType },
                    size: streamResult.size ?? fileMeta.size,
                    statusCode: 200,
                    stream: streamResult.stream,
                };
            } catch (streamError: unknown) {
                if (isNotFound(streamError)) {
                    throw streamError;
                }

                // Fall back to regular file serving if streaming fails
                this.logger?.warn(`Streaming failed, falling back to buffer: ${streamError}`);
            }
        }

        const file = await this.storage.get({ id: fileMeta.id });
        const contentType = resolveContentType(file.contentType, extension);

        return {
            ...file,
            contentType,
            headers: {
                "Accept-Ranges": "bytes",
                "Content-Length": String(file.size),
                "Content-Type": contentType,
                ...fileStateHeaders(file),
            },
            statusCode: 200,
        } as unknown as ResponseFile<TFile>;
    }

    /**
     * Returns a list of uploaded files with optional pagination support.
     *
     * `limit` and `page` must be positive integers; malformed values are ignored. At most
     * {@link MAX_LIST_ITEMS} files are ever read from storage for one request, whatever the provider's own page size.
     * @param searchParams Query parameters (`limit`, `page`) of the request.
     * @returns Promise resolving to a paginated (when `page` is given) or plain list of uploaded files.
     */
    protected async listFiles(searchParams: URLSearchParams): Promise<ResponseList<TFile>> {
        const limit = parseIntegerHeader(searchParams.get("limit"));
        const page = parseIntegerHeader(searchParams.get("page"));
        const perPage = limit ? Math.min(limit, MAX_LIST_ITEMS) : MAX_LIST_ITEMS;
        const headers = { "Content-Type": JSON_CONTENT_TYPE };

        if (!page) {
            return { data: await this.storage.list(perPage), headers, statusCode: 200 };
        }

        // `paginate` expects the rows of the requested page only; `total` is what storage holds up to the cap
        const list = await this.storage.list(MAX_LIST_ITEMS);

        if (list.length === 0) {
            return { data: [], headers, statusCode: 200 };
        }

        const rows = list.slice((page - 1) * perPage, page * perPage);

        // Serialize explicitly: older @visulima/pagination releases break under JSON.stringify's toJSON(key) call
        return { data: paginate(page, perPage, list.length, rows).toJSON(), headers, statusCode: 200 };
    }

    /**
     * Check for undefined ID or path errors and throw appropriate HTTP errors.
     * @param error The error to check
     */
    // eslint-disable-next-line class-methods-use-this
    protected checkForUndefinedIdOrPath(error: unknown): void {
        if (error instanceof Error && ["Id is undefined", "Invalid request URL", "Path is undefined"].includes(error.message)) {
            // This will be handled by the platform-specific error handler
            throw error;
        }
    }
}

export default BaseHandlerCore;
