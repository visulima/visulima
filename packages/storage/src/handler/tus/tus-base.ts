import createHttpError from "http-errors";

import type { Checksum, FileInit, UploadFile } from "../../storage/utils/file";
import { Metadata } from "../../storage/utils/file";
import { HeaderUtilities } from "../../utils/headers";
import type { Headers } from "../../utils/types";
import type { ResponseFile } from "../types";

const TUS_RESUMABLE_VERSION = "1.0.0";
const TUS_VERSION_VERSION = "1.0.0";

/**
 * Parse TUS protocol metadata string into object.
 * @param encoded Base64-encoded metadata string (optional, defaults to empty string)
 * @returns Parsed metadata object with decoded values
 */
export const parseMetadata = (encoded = ""): Metadata => {
    const kvPairs = encoded.split(",").map((kv) => kv.split(" "));
    const metadata = Object.create(Metadata.prototype) as Record<string, string>;

    Object.values(kvPairs).forEach(([key, value]) => {
        if (key) {
            metadata[key] = value ? Buffer.from(value, "base64").toString() : "";
        }
    });

    return metadata;
};

/**
 * Serialize metadata object to TUS protocol format.
 * @param object Metadata object to serialize
 * @returns Base64-encoded metadata string in TUS format
 */
export const serializeMetadata = (object: Metadata | Record<string, unknown> | undefined): string => {
    if (!object || Object.keys(object).length === 0) {
        return "";
    }

    return Object.entries(object)
        .map(([key, value]) => {
            if (value === undefined) {
                return key;
            }

            return `${key} ${Buffer.from(String(value)).toString("base64")}`;
        })
        .toString();
};

/**
 * Base class containing shared TUS protocol business logic.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
export abstract class TusBase<TFile extends UploadFile> {
    /**
     * Storage instance for file operations.
     */
    protected get storage(): {
        checkIfExpired: (file: TFile) => Promise<void>;
        checksumTypes: string[];
        config: { useRelativeLocation?: boolean };
        create: (config: FileInit) => Promise<TFile>;
        delete: (options: { id: string }) => Promise<TFile>;
        getMeta: (id: string) => Promise<TFile>;
        maxUploadSize: number;
        tusExtension: string[];
        update: (options: { id: string }, updates: { id?: string; metadata?: Record<string, unknown>; size?: number }) => Promise<TFile>;
        write: (options: { body: unknown; checksum?: string; checksumAlgorithm?: string; contentLength: number; id: string; start: number }) => Promise<TFile>;
    } {
        // This will be overridden by subclasses
        throw new Error("storage must be implemented");
    }

    /**
     * Whether to disable termination for finished uploads.
     * Must be implemented by subclasses via getter.
     */
    protected abstract get disableTerminationForFinishedUploads(): boolean;

    /**
     * Build file URL from request URL and file data.
     * @param requestUrl Request URL string
     * @param file File object containing ID
     * @returns Constructed file URL for TUS protocol
     */
    protected buildFileUrl(requestUrl: string, file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }

    /**
     * Handle OPTIONS request with TUS protocol capabilities.
     * @param methods Array of supported HTTP methods
     * @returns ResponseFile with TUS headers
     */
    protected handleOptions(methods: string[]): ResponseFile<TFile> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            "Access-Control-Allow-Methods": methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "Tus-Checksum-Algorithm": this.storage.checksumTypes.join(","),
            "Tus-Extension": this.storage.tusExtension.toString(),
            "Tus-Max-Size": this.storage.maxUploadSize,
            "Tus-Version": TUS_VERSION_VERSION,
        };

        return { headers: headers as Record<string, string | number>, statusCode: 204 } as ResponseFile<TFile>;
    }

    /**
     * Handle TUS POST (create upload).
     * @param uploadLength Upload length header value
     * @param uploadDeferLength Upload defer length header value
     * @param uploadConcat Upload concat header value
     * @param metadataHeader Upload metadata header value
     * @param requestUrl Request URL for Location header
     * @param bodyStream Request body stream (for creation-with-upload)
     * @param contentLength Content length (for creation-with-upload)
     * @param contentType Content type (for creation-with-upload)
     * @returns Promise resolving to ResponseFile with upload result
     */
    protected async handlePost(
        uploadLength: string | undefined,
        uploadDeferLength: string | undefined,
        uploadConcat: string | undefined,
        metadataHeader: string | undefined,
        requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
        contentType: string,
    ): Promise<ResponseFile<TFile>> {
        // Handle Creation-Defer-Length extension
        if (uploadDeferLength !== undefined) {
            if (!this.storage.tusExtension.includes("creation-defer-length")) {
                throw createHttpError(501, "creation-defer-length extension is not (yet) supported.");
            }

            // When defer-length is enabled, Upload-Length is optional
            if (uploadLength === undefined) {
                // Create upload with undefined size
                const metadata = metadataHeader ? parseMetadata(metadataHeader) : {};
                const config: FileInit = { metadata };

                let file = await this.storage.create(config);

                // 'creation-with-upload' block - check if content type is application/offset+octet-stream
                if (contentType === "application/offset+octet-stream" && contentLength > 0) {
                    file = await this.storage.write({
                        ...file,
                        body: bodyStream,
                        contentLength,
                        start: 0,
                    });
                }

                let headers: Headers = {};

                // The Upload-Expires response header indicates the time after which the unfinished upload expires.
                if (this.storage.tusExtension.includes("expiration") && typeof file.expiredAt === "number" && file.size === undefined) {
                    headers = { "Upload-Expires": new Date(file.expiredAt).toUTCString() };
                }

                // Build TUS headers and ensure Location header is set
                const locationUrl = this.buildFileUrl(requestUrl, file);

                headers = { ...headers, ...this.buildHeaders(file, { Location: locationUrl }) };

                // Ensure Location header is present (TUS protocol requirement)
                if (!headers.Location) {
                    headers.Location = locationUrl;
                }

                if (file.bytesWritten > 0) {
                    headers["Upload-Offset"] = file.bytesWritten.toString();
                }

                // For defer-length, always include Upload-Defer-Length header
                headers["Upload-Defer-Length"] = "1";

                const statusCode = file.bytesWritten > 0 ? 200 : 201;

                return { ...file, headers: headers as Record<string, string | number>, statusCode };
            }
        }

        // Handle Concatenation extension
        if (uploadConcat) {
            if (!this.storage.tusExtension.includes("concatenation")) {
                throw createHttpError(501, "Concatenation extension is not (yet) supported. Disable parallel upload in the tus client.");
            }

            const parsedMetadata = metadataHeader ? parseMetadata(metadataHeader) : {};

            // Parse Upload-Concat header: "partial" or "final;id1 id2 id3"
            if (uploadConcat === "partial") {
                // Create a partial upload
                // Partial uploads don't require Upload-Length (can use defer-length)
                const config: FileInit = {
                    metadata: { ...parsedMetadata, uploadConcat: "partial" },
                    size: uploadLength,
                };

                let file = await this.storage.create(config);

                // 'creation-with-upload' block
                if (contentType === "application/offset+octet-stream" && contentLength > 0) {
                    file = await this.storage.write({
                        ...file,
                        body: bodyStream,
                        contentLength,
                        start: 0,
                    });
                }

                let headers: Headers = {};

                if (this.storage.tusExtension.includes("expiration") && typeof file.expiredAt === "number" && file.bytesWritten !== (file.size ?? 0)) {
                    headers = { "Upload-Expires": new Date(file.expiredAt).toUTCString() };
                }

                const locationUrl = this.buildFileUrl(requestUrl, file);

                headers = { ...headers, ...this.buildHeaders(file, { Location: locationUrl }) };

                if (!headers.Location) {
                    headers.Location = locationUrl;
                }

                if (file.bytesWritten > 0) {
                    headers["Upload-Offset"] = file.bytesWritten.toString();
                }

                headers["Upload-Concat"] = "partial";

                const statusCode = file.bytesWritten > 0 ? 200 : 201;

                return { ...file, headers: headers as Record<string, string | number>, statusCode };
            }

            if (uploadConcat.startsWith("final;")) {
                // Create a final upload that concatenates partial uploads
                const partialIds = uploadConcat.slice(6).trim().split(/\s+/).filter(Boolean);

                if (partialIds.length === 0) {
                    throw createHttpError(400, "Upload-Concat final must include at least one partial upload ID");
                }

                // Verify all partial uploads exist and are completed
                let totalSize = 0;
                const partialFiles: TFile[] = [];

                for (const partialId of partialIds) {
                    try {
                        const partialFile = await this.storage.getMeta(partialId);

                        await this.storage.checkIfExpired(partialFile);

                        // Verify it's a partial upload
                        if (partialFile.metadata?.uploadConcat !== "partial") {
                            throw createHttpError(400, `Upload ${partialId} is not a partial upload`);
                        }

                        // Verify it's completed
                        if (partialFile.status !== "completed" || partialFile.size === undefined) {
                            throw createHttpError(409, `Partial upload ${partialId} is not completed`);
                        }

                        partialFiles.push(partialFile);
                        totalSize += partialFile.size;
                    } catch (error: unknown) {
                        const errorWithCode = error as { statusCode?: number };

                        if (errorWithCode.statusCode === 404 || errorWithCode.statusCode === 410) {
                            throw createHttpError(409, `Partial upload ${partialId} not found or expired`);
                        }

                        throw error;
                    }
                }

                // Create final upload with concatenation metadata
                const config: FileInit = {
                    metadata: {
                        ...parsedMetadata,
                        partialIds,
                        uploadConcat: `final;${partialIds.join(" ")}`,
                    },
                    size: totalSize,
                };

                const file = await this.storage.create(config);

                // Concatenate the partial uploads
                await this.concatenateFiles(file, partialFiles);

                const locationUrl = this.buildFileUrl(requestUrl, file);
                const headers: Headers = {
                    ...this.buildHeaders(file, { Location: locationUrl }),
                    "Upload-Concat": uploadConcat,
                };

                return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
            }

            throw createHttpError(400, "Invalid Upload-Concat header format");
        }

        // Validate that either upload-length or upload-defer-length is specified
        if (uploadLength === undefined && uploadDeferLength === undefined) {
            throw createHttpError(400, "Either upload-length or upload-defer-length must be specified.");
        }

        if (uploadLength !== undefined && Number.isNaN(Number(uploadLength))) {
            throw createHttpError(400, "Invalid upload-length");
        }

        const metadata = metadataHeader ? parseMetadata(metadataHeader) : {};
        const config: FileInit = { metadata, size: uploadLength };

        let file = await this.storage.create(config);

        // 'creation-with-upload' block - check if content type is application/offset+octet-stream
        if (contentType === "application/offset+octet-stream" && contentLength > 0) {
            file = await this.storage.write({
                ...file,
                body: bodyStream,
                contentLength,
                start: 0,
            });
        }

        let headers: Headers = {};

        // The Upload-Expires response header indicates the time after which the unfinished upload expires.
        if (
            this.storage.tusExtension.includes("expiration")
            && typeof file.expiredAt === "number"
            && file.bytesWritten !== Number.parseInt(uploadLength as string, 10)
        ) {
            headers = { "Upload-Expires": new Date(file.expiredAt).toUTCString() };
        }

        // Build TUS headers and ensure Location header is set
        const locationUrl = this.buildFileUrl(requestUrl, file);

        headers = { ...headers, ...this.buildHeaders(file, { Location: locationUrl }) };

        // Ensure Location header is present (TUS protocol requirement)
        if (!headers.Location) {
            headers.Location = locationUrl;
        }

        if (file.bytesWritten > 0) {
            headers["Upload-Offset"] = file.bytesWritten.toString();
        }

        const statusCode = file.bytesWritten > 0 ? 200 : 201;

        return { ...file, headers: headers as Record<string, string | number>, statusCode };
    }

    /**
     * Handle TUS PATCH (write chunk).
     * @param id File ID from URL
     * @param uploadOffset Upload offset header value
     * @param uploadLength Optional upload length header value (for defer-length)
     * @param metadataHeader Optional upload metadata header value
     * @param checksum Optional checksum
     * @param checksumAlgorithm Optional checksum algorithm
     * @param requestUrl Request URL for Location header
     * @param bodyStream Request body stream
     * @param contentLength Content length
     * @returns Promise resolving to ResponseFile with upload progress
     */
    protected async handlePatch(
        id: string,
        uploadOffset: number,
        uploadLength: string | undefined,
        metadataHeader: string | undefined,
        checksum: string | undefined,
        checksumAlgorithm: string | undefined,
        requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
    ): Promise<ResponseFile<TFile>> {
        const metadata = metadataHeader ? parseMetadata(metadataHeader) : undefined;

        if (metadata) {
            try {
                await this.storage.update({ id }, { id, metadata });
            } catch (error: unknown) {
                const errorWithCode = error as { UploadErrorCode?: string };

                if (errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                    throw createHttpError(410, "Upload expired");
                }

                throw error;
            }
        }

        // Check if file is expired before processing
        let currentFile: TFile;

        try {
            currentFile = await this.storage.getMeta(id);
            await this.storage.checkIfExpired(currentFile);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE" || errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(410, "Upload expired");
            }

            throw error;
        }

        // Block PATCH on final concatenation uploads
        const uploadConcatValue = currentFile.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string" && uploadConcatValue.startsWith("final;")) {
            throw createHttpError(403, "Cannot PATCH a final concatenation upload");
        }

        let file = await this.storage.write({
            body: bodyStream,
            checksum,
            checksumAlgorithm,
            contentLength,
            id,
            start: uploadOffset,
        });

        // Handle Upload-Length header for Creation-Defer-Length extension
        if (uploadLength !== undefined) {
            if (!this.storage.tusExtension.includes("creation-defer-length")) {
                throw createHttpError(501, "creation-defer-length extension is not (yet) supported.");
            }

            // If size is already set, it cannot be changed
            if (file.size !== undefined && !Number.isNaN(file.size)) {
                throw createHttpError(412, "Upload-Length has already been set for this upload");
            }

            const size = Number.parseInt(uploadLength, 10);

            if (Number.isNaN(size)) {
                throw createHttpError(400, "Invalid Upload-Length value");
            }

            if (size < file.bytesWritten) {
                throw createHttpError(400, "Upload-Length is smaller than the current offset");
            }

            // Update file size
            file = await this.storage.update({ id }, { size });

            // Check if upload is now completed
            if (file.bytesWritten === file.size) {
                file.status = "completed";
            }
        }

        return {
            ...file,
            headers: this.buildHeaders(file, {
                "Upload-Offset": file.bytesWritten,
            }) as Record<string, string | number>,
            statusCode: file.status === "completed" ? 200 : 204,
        };
    }

    /**
     * Handle TUS HEAD (get upload status).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with upload status headers
     */
    protected async handleHead(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.getMeta(id);

        await this.storage.checkIfExpired(file);

        const headers: Headers = {
            ...typeof file.size === "number" && !Number.isNaN(file.size)
                ? {
                    "Upload-Length": file.size,
                }
                : {
                    "Upload-Defer-Length": "1",
                },
            ...this.buildHeaders(file, {
                "Cache-Control": HeaderUtilities.createCacheControlPreset("no-store"),
                "Upload-Metadata": serializeMetadata(file.metadata),
                "Upload-Offset": file.bytesWritten,
            }),
        };

        // Add Upload-Concat header for concatenation extension
        const uploadConcatValue = file.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string") {
            headers["Upload-Concat"] = uploadConcatValue;
        }

        return { headers: headers as Record<string, string>, statusCode: 200 } as ResponseFile<TFile>;
    }

    /**
     * Handle TUS GET (get upload metadata).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    protected async handleGet(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.getMeta(id);

        return {
            ...file,
            body: file, // Return file metadata as JSON
            headers: this.buildHeaders(file, {
                "Content-Type": HeaderUtilities.createContentType({
                    mediaType: "application/json",
                }),
            }) as Record<string, string | number>,
            statusCode: 200,
        };
    }

    /**
     * Handle TUS DELETE (terminate upload).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    protected async handleDelete(id: string): Promise<ResponseFile<TFile>> {
        // Check if termination is disabled for finished uploads
        if (this.disableTerminationForFinishedUploads) {
            const file = await this.storage.getMeta(id);

            if (file.status === "completed") {
                throw createHttpError(400, "Termination of finished uploads is disabled");
            }
        }

        const file = await this.storage.delete({ id });

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return {
            ...file,
            headers: this.buildHeaders(file) as Record<string, string>,
            statusCode: 204,
        } as ResponseFile<TFile>;
    }

    /**
     * Build TUS protocol headers including required Tus-Resumable and optional Upload-Expires.
     * @param file Upload file object with metadata
     * @param headers Additional headers to include
     * @returns Headers object with TUS protocol headers
     */
    protected buildHeaders(file: UploadFile, headers: Headers = {}): Headers {
        // All TUS responses must include Tus-Resumable header
        headers["Tus-Resumable"] = TUS_RESUMABLE_VERSION;

        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== undefined) {
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }

        return headers;
    }

    /**
     * Extract checksum algorithm and value from Upload-Checksum header.
     * @param checksumHeader Upload-Checksum header value
     * @returns Object containing checksum algorithm and value
     */
    protected extractChecksum(checksumHeader: string | undefined): Checksum {
        if (!checksumHeader) {
            return { checksum: undefined, checksumAlgorithm: undefined };
        }

        const [checksumAlgorithm, checksum] = checksumHeader.split(/\s+/).filter(Boolean);

        return { checksum, checksumAlgorithm };
    }

    /**
     * Validate Tus-Resumable header value.
     * @param tusResumable Tus-Resumable header value
     * @throws {Error} 412 if version doesn't match or header is missing
     */
    protected validateTusResumableHeader(tusResumable: string | undefined): void {
        if (!tusResumable) {
            throw createHttpError(412, "Missing Tus-Resumable header");
        }

        if (tusResumable !== TUS_RESUMABLE_VERSION) {
            throw createHttpError(412, `Unsupported TUS version: ${tusResumable}. Server supports: ${TUS_RESUMABLE_VERSION}`);
        }
    }

    /**
     * Concatenate partial uploads into a final upload.
     * @param finalFile Final file that will contain concatenated content
     * @param partialFiles Array of partial upload files to concatenate
     * @returns Promise resolving when concatenation is complete
     */
    protected async concatenateFiles(finalFile: TFile, partialFiles: TFile[]): Promise<void> {
        // Concatenate all streams sequentially
        let offset = 0;

        // eslint-disable-next-line no-loops/no-loops
        for (const partialFile of partialFiles) {
            // Get stream for this partial file
            const { size, stream } = await this.storage.getStream({ id: partialFile.id });

            if (size === undefined) {
                throw createHttpError(500, "Partial upload size is undefined");
            }

            // Write the stream to the final file at the current offset
            const updatedFile = await this.storage.write({
                ...finalFile,
                body: stream,
                contentLength: size,
                start: offset,
            });

            // Update finalFile reference with latest state
            Object.assign(finalFile, updatedFile);
            offset += size;
        }

        // Final file should already be completed after all writes
        // But ensure bytesWritten matches total size
        if (finalFile.size !== undefined && finalFile.bytesWritten !== finalFile.size) {
            await this.storage.update({ id: finalFile.id }, { bytesWritten: finalFile.size });
        }
    }
}

export const TUS_RESUMABLE: string = TUS_RESUMABLE_VERSION;
export const TUS_VERSION: string = TUS_VERSION_VERSION;
