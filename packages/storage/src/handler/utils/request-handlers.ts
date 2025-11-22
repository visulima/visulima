import type { IncomingMessage } from "node:http";

import createHttpError from "http-errors";
import mime from "mime";

import type { BaseStorage } from "../../storage/storage";
import type { UploadFile } from "../../storage/utils/file";
import type MediaTransformer from "../../transformer/media-transformer";
import { ERRORS } from "../../utils/errors";
import filePathUrlMatcher from "../../utils/file-path-url-matcher";
import { HeaderUtilities } from "../../utils/headers";
import { getRealPath, uuidRegex } from "../../utils/http";
import type { ResponseFile, ResponseList } from "../types";
import { buildFileMetadataHeaders } from "./response-builder";

/**
 * Handles metadata endpoint requests.
 * @param storage Storage instance
 * @param uuid File UUID
 * @returns ResponseFile with file metadata as JSON
 */
export const handleMetadataRequest = async <TFile extends UploadFile>(storage: BaseStorage<TFile>, uuid: string): Promise<ResponseFile<TFile>> => {
    const file = await storage.getMeta(uuid);

    return {
        ...file,
        content: JSON.stringify(file),
        headers: {
            "Content-Type": HeaderUtilities.createContentType({
                charset: "utf8",
                mediaType: "application/json",
            }),
            ...buildFileMetadataHeaders(file),
        } as Record<string, string>,
        statusCode: 200,
    } as ResponseFile<TFile>;
};

/**
 * Handles media transformation requests.
 * @param mediaTransformer Media transformer instance
 * @param uuid File UUID
 * @param queryParameters Query parameters for transformation
 * @returns ResponseFile with transformed content
 */
export const handleTransformationRequest = async <TFile extends UploadFile>(
    mediaTransformer: MediaTransformer,
    uuid: string,
    queryParameters: Record<string, string>,
): Promise<ResponseFile<TFile> | undefined> => {
    try {
        const transformedResult = await mediaTransformer.handle(uuid, queryParameters);

        return {
            content: transformedResult.buffer,
            headers: {
                "Content-Length": String(transformedResult.size),
                "Content-Type": `${transformedResult.mediaType}/${transformedResult.format}`,
                "X-Media-Type": transformedResult.mediaType,
                "X-Original-Format": transformedResult.originalFile?.contentType?.split("/")[1] || "",
                "X-Transformed-Format": transformedResult.format,
                ...(transformedResult.originalFile?.expiredAt === undefined ? {} : { "X-Upload-Expires": transformedResult.originalFile.expiredAt.toString() }),
                ...(transformedResult.originalFile?.modifiedAt === undefined ? {} : { "Last-Modified": transformedResult.originalFile.modifiedAt.toString() }),
                ...(transformedResult.originalFile?.ETag === undefined ? {} : { ETag: transformedResult.originalFile.ETag }),
            } as Record<string, string>,
            statusCode: 200,
        } as ResponseFile<TFile>;
    } catch (transformError: unknown) {
        // If transformation fails, check if it's a validation error
        if ((transformError as { name?: string }).name === "ValidationError") {
            throw createHttpError(400, (transformError as Error).message);
        }

        // Return undefined to indicate fallback to original file
        return undefined;
    }
};

/**
 * Handles streaming file requests.
 * @param storage Storage instance
 * @param uuid File UUID
 * @param ext File extension (optional)
 * @param fileMeta File metadata
 * @returns ResponseFile with stream, or undefined if streaming not available
 */
export const handleStreamingRequest = async <TFile extends UploadFile>(
    storage: BaseStorage<TFile>,
    uuid: string,
    extension: string | undefined,
    fileMeta: TFile,
): Promise<ResponseFile<TFile> | undefined> => {
    if (!storage.getStream) {
        return undefined;
    }

    try {
        const streamResult = await storage.getStream({ id: uuid });
        let contentType = streamResult.headers?.["Content-Type"] || fileMeta.contentType;

        if (contentType.includes("image") && typeof extension === "string") {
            contentType = mime.getType(extension) || contentType;
        }

        return {
            headers: {
                ...streamResult.headers,
                "Accept-Ranges": "bytes",
                "Content-Type": contentType,
            } as Record<string, string>,
            size: streamResult.size,
            statusCode: 200,
            stream: streamResult.stream,
            ...fileMeta,
            contentType,
        } as ResponseFile<TFile>;
    } catch {
        // Fall back to regular file serving if streaming fails
        return undefined;
    }
};

/**
 * Handles regular (non-streaming) file requests.
 * @param storage Storage instance
 * @param uuid File UUID
 * @param ext File extension (optional)
 * @returns ResponseFile with file content
 */
export const handleRegularRequest = async <TFile extends UploadFile>(
    storage: BaseStorage<TFile>,
    uuid: string,
    extension: string | undefined,
): Promise<ResponseFile<TFile>> => {
    const file = await storage.get({ id: uuid });

    let { contentType } = file;

    if (contentType.includes("image") && typeof extension === "string") {
        contentType = mime.getType(extension) || contentType;
    }

    const { ETag, expiredAt, modifiedAt, size } = file;

    return {
        headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": String(size),
            "Content-Type": contentType,
            ...(expiredAt === undefined ? {} : { "X-Upload-Expires": expiredAt.toString() }),
            ...(modifiedAt === undefined ? {} : { "Last-Modified": modifiedAt.toString() }),
            ...(ETag === undefined ? {} : { ETag }),
        } as Record<string, string>,
        statusCode: 200,
        ...file,
        contentType,
    } as ResponseFile<TFile>;
};

/**
 * Main GET request handler that routes to appropriate sub-handlers.
 * @param request HTTP request
 * @param storage Storage instance
 * @param mediaTransformer Optional media transformer
 * @param logger Optional logger
 * @returns ResponseFile or ResponseList
 */
export const handleGetRequest = async <TFile extends UploadFile>(
    request: IncomingMessage & { originalUrl?: string },
    storage: BaseStorage<TFile>,
    mediaTransformer?: MediaTransformer,
    logger?: { warn?: (message: string) => void },
): Promise<ResponseFile<TFile> | ResponseList<TFile>> => {
    const pathMatch = filePathUrlMatcher(getRealPath(request));

    if (pathMatch && pathMatch.params.uuid) {
        const { ext, metadata, uuid: rawUuid } = pathMatch.params;
        // If ext is present, uuid includes the extension, so strip it
        const uuid = ext ? rawUuid.replace(new RegExp(String.raw`\.${ext}$`), "") : rawUuid;

        // Handle metadata requests (check this before UUID validation)
        if (metadata === "metadata" && getRealPath(request).endsWith("/metadata")) {
            try {
                return await handleMetadataRequest(storage, uuid);
            } catch (error: unknown) {
                const errorWithCode = error as { UploadErrorCode?: string };

                if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                    throw createHttpError(404, "File metadata not found");
                }

                throw error;
            }
        }

        // For non-metadata requests, validate UUID format
        if (!uuidRegex.test(uuid)) {
            // Invalid UUID format - treat as list request
            // Note: list handler would need to be passed in or called differently
            throw createHttpError(404, "Invalid file ID format");
        }

        // Handle regular file requests
        try {
            // Check if transformation parameters are present and media transformer is available
            const url = new URL(request.url || "", "http://localhost");
            const queryParameters = Object.fromEntries(url.searchParams.entries());
            const hasTransformationParameters = Object.keys(queryParameters).length > 0 && mediaTransformer;

            if (hasTransformationParameters && mediaTransformer) {
                const transformed = await handleTransformationRequest(mediaTransformer, uuid, queryParameters);

                if (transformed) {
                    return transformed;
                }

                logger?.warn("Media transformation failed, falling back to original file");
            }

            // Get file metadata first to determine if we should stream
            const fileMeta = await storage.getMeta(uuid);

            // Check if we should use streaming for large files
            const useStreaming = request.headers.range || (fileMeta.size && fileMeta.size > 1024 * 1024); // Stream files > 1MB

            if (useStreaming) {
                const streamed = await handleStreamingRequest(storage, uuid, ext, fileMeta);

                if (streamed) {
                    return streamed;
                }

                logger?.warn("Streaming failed, falling back to buffer");
            }

            // Serve original file (fallback or no transformation requested)
            return await handleRegularRequest(storage, uuid, ext);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === ERRORS.FILE_NOT_FOUND || errorWithCode.UploadErrorCode === ERRORS.GONE) {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    throw createHttpError(404, "File not found");
};
