import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { format } from "node:url";

import { paginate } from "@visulima/pagination";
import createHttpError from "http-errors";
import mime from "mime";

import { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";
import type MediaTransformer from "../../transformer/media-transformer";
import type { ErrorResponses } from "../../utils/errors";
import { ErrorMap, ERRORS } from "../../utils/errors";
import { HeaderUtilities } from "../../utils/headers";
import { COMMON_PATH_NAMES, getBaseUrl, uuidRegex } from "../../utils/http";
import type { ResponseBodyType } from "../../utils/types";
import type { ResponseFile, ResponseList, UploadOptions } from "../types";

/**
 * Splits a GET path into the addressed file id, an optional extension and whether `/metadata` was requested.
 * @param path Request path (without query string)
 * @returns The parsed target, or `undefined` when the path does not address a file
 */
const parseFilePath = (path: string): { ext?: string; isMetadataRequest: boolean; uuid: string } | undefined => {
    const segments = path
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            try {
                return decodeURIComponent(segment);
            } catch {
                return segment;
            }
        });
    const isMetadataRequest = segments.length >= 2 && segments[segments.length - 1] === "metadata";
    const idSegment = segments[segments.length - (isMetadataRequest ? 2 : 1)];

    if (!idSegment) {
        return undefined;
    }

    const extensionMatch = /^(.+)\.([^.]+)$/.exec(idSegment);
    const uuid = extensionMatch?.[1] ?? idSegment;

    if (COMMON_PATH_NAMES.includes(uuid.toLowerCase())) {
        return undefined;
    }

    return { ext: extensionMatch?.[2], isMetadataRequest, uuid };
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

    public constructor({ disableTerminationForFinishedUploads, mediaTransformer, storage }: UploadOptions<TFile>) {
        super();

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
        const relative = format({ pathname: `${pathname}/${file.id}`, query });

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
     * Resolves a GET request for a single file (or its `/metadata`) from the request path.
     * Platform-agnostic: shared by the Node and Fetch handlers.
     * @param path Request path (without query string).
     * @param searchParams Query parameters of the request (used for media transformations).
     * @param hasRange Whether the request carries a `Range` header (forces streaming).
     * @returns The file response, or `undefined` when the path does not address a file and a list should be returned instead.
     * @throws {HttpError} 404 when the file or its metadata is not found.
     */
    protected async getFileResponse(path: string, searchParams: URLSearchParams, hasRange: boolean): Promise<ResponseFile<TFile> | undefined> {
        const target = parseFilePath(path);

        if (target) {
            const { ext, isMetadataRequest, uuid } = target;

            try {
                BaseStorage.assertSafeId(uuid);
            } catch {
                throw createHttpError(400, `Invalid file id: "${uuid}"`);
            }

            // Handle metadata requests (check this before UUID validation)
            if (isMetadataRequest) {
                try {
                    const file = await this.storage.getMeta(uuid);

                    return {
                        ...file,
                        content: JSON.stringify(file),
                        headers: {
                            "Content-Type": HeaderUtilities.createContentType({
                                charset: "utf8",
                                mediaType: "application/json",
                            }),
                            ...(file.expiredAt === undefined ? {} : { "X-Upload-Expires": file.expiredAt.toString() }),
                            ...(file.modifiedAt === undefined ? {} : { "Last-Modified": file.modifiedAt.toString() }),
                        },
                        statusCode: 200,
                    };
                } catch (error: unknown) {
                    const errorWithCode = error as { UploadErrorCode?: string };

                    if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                        throw createHttpError(404, "File metadata not found");
                    }

                    throw error;
                }
            }

            // UUID-like segments are always file ids. Other segments of at least 8 characters (e.g. a
            // nanoid) may be a file id or a collection path such as `/api/attachments`, so they fall back
            // to the list when no such file exists.
            const isUuidLike = uuidRegex.test(uuid);

            if (!isUuidLike && uuid.length < 8) {
                // Not a file id - treat as list request
                return undefined;
            }

            // Handle regular file requests
            try {
                // Check if transformation parameters are present and media transformer is available
                const queryParameters = Object.fromEntries(searchParams.entries());
                const hasTransformationParameters = Object.keys(queryParameters).length > 0 && this.mediaTransformer;

                if (hasTransformationParameters && this.mediaTransformer) {
                    // Use media transformer for transformation
                    try {
                        const transformedResult = await this.mediaTransformer.handle(uuid, queryParameters);

                        return {
                            content: transformedResult.buffer,
                            headers: {
                                "Content-Length": String(transformedResult.size),
                                "Content-Type": `${transformedResult.mediaType}/${transformedResult.format}`,
                                "X-Media-Type": transformedResult.mediaType,
                                "X-Original-Format": transformedResult.originalFile?.contentType?.split("/")[1] || "",
                                "X-Transformed-Format": transformedResult.format,
                                ...(transformedResult.originalFile?.expiredAt === undefined
                                    ? {}
                                    : { "X-Upload-Expires": transformedResult.originalFile.expiredAt.toString() }),
                                ...(transformedResult.originalFile?.modifiedAt === undefined
                                    ? {}
                                    : { "Last-Modified": transformedResult.originalFile.modifiedAt.toString() }),
                                ...(transformedResult.originalFile?.ETag === undefined ? {} : { ETag: transformedResult.originalFile.ETag }),
                            },
                            statusCode: 200,
                        } as unknown as ResponseFile<TFile>;
                    } catch (transformError: unknown) {
                        // If transformation fails, check if it's a validation error
                        if ((transformError as { name?: string }).name === "ValidationError") {
                            throw createHttpError(400, (transformError as Error).message);
                        }

                        // For other transformation errors, fall back to serving original file
                        this.logger?.warn(`Media transformation failed: ${(transformError as Error).message}`);
                    }
                }

                // Get file metadata first to determine if we should stream
                const fileMeta = await this.storage.getMeta(uuid);

                // Check if we should use streaming for large files
                const useStreaming = hasRange || (fileMeta.size && fileMeta.size > 1024 * 1024); // Stream files > 1MB

                if (useStreaming && this.storage.getStream) {
                    // Use streaming for better memory efficiency
                    try {
                        const streamResult = await this.storage.getStream({ id: uuid });
                        let contentType = streamResult.headers?.["Content-Type"] || fileMeta.contentType;

                        if (contentType.includes("image") && typeof ext === "string") {
                            contentType = mime.getType(ext) || contentType;
                        }

                        return {
                            headers: {
                                ...streamResult.headers,
                                "Accept-Ranges": "bytes", // Indicate we support range requests
                                "Content-Type": contentType,
                            },
                            size: streamResult.size,
                            statusCode: 200,
                            stream: streamResult.stream,
                            ...fileMeta,
                            contentType,
                        };
                    } catch (streamError) {
                        // Fall back to regular file serving if streaming fails
                        this.logger?.warn(`Streaming failed, falling back to buffer: ${streamError}`);
                    }
                }

                // Serve original file (fallback or no transformation requested)
                const file = await this.storage.get({ id: uuid });

                let { contentType } = file;

                if (contentType.includes("image") && typeof ext === "string") {
                    contentType = mime.getType(ext) || contentType;
                }

                const { ETag, expiredAt, modifiedAt, size } = file;

                return {
                    headers: {
                        "Accept-Ranges": "bytes", // Indicate we support range requests
                        "Content-Length": String(size),
                        "Content-Type": contentType,
                        ...(expiredAt === undefined ? {} : { "X-Upload-Expires": expiredAt.toString() }),
                        ...(modifiedAt === undefined ? {} : { "Last-Modified": modifiedAt.toString() }),
                        ...(ETag === undefined ? {} : { ETag }),
                    },
                    statusCode: 200,
                    ...file,
                    contentType,
                } as unknown as ResponseFile<TFile>;
            } catch (error: unknown) {
                const errorWithCode = error as { UploadErrorCode?: string };

                if (!isUuidLike && errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND) {
                    // Ambiguous segment that is not a stored file - treat as list request
                    return undefined;
                }

                if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                    throw createHttpError(404, "File not found");
                }

                throw error;
            }
        }

        return undefined;
    }

    /**
     * Returns a list of uploaded files with optional pagination support.
     * @param searchParams Query parameters (`limit`, `page`) of the request.
     * @returns Promise resolving to a paginated or complete list of uploaded files.
     */
    protected async listFiles(searchParams: URLSearchParams): Promise<ResponseList<TFile>> {
        const limit = searchParams.get("limit");
        const page = searchParams.get("page");

        const list = await this.storage.list(Number(limit || 1000));

        if (list.length === 0) {
            return {
                data: [],
                headers: {},
                statusCode: 200,
            };
        }

        const pageNumber = Number(page);
        const limitNumber = Number(limit);

        // URLSearchParams.get() returns string | null (never undefined); only
        // paginate when both params are actually present and numeric, otherwise
        // fall through to the plain-array shape below.
        if (page !== null && limit !== null && Number.isFinite(pageNumber) && Number.isFinite(limitNumber)) {
            return {
                data: paginate(pageNumber, limitNumber, list.length, list),
                headers: {},
                statusCode: 200,
            };
        }

        return {
            data: list,
            headers: {},
            statusCode: 200,
        };
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
