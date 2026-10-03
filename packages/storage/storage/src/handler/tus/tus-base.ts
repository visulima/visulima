import { createHash, getHashes } from "node:crypto";
import { Readable } from "node:stream";

import createHttpError from "http-errors";

import type { Checksum, FileInit, UploadFile } from "../../storage/utils/file";
import { Metadata } from "../../storage/utils/file";
import { HeaderUtilities } from "../../utils/headers";
import { getIdFromRequestUrl } from "../../utils/http";
import type { Headers } from "../../utils/types";
import type { ResponseFile } from "../types";

const TUS_RESUMABLE_VERSION = "1.0.0";
const TUS_VERSION_VERSION = "1.0.0";

/**
 * Whether a header value is a non-negative integer, as the spec requires for `Upload-Length`
 * and `Upload-Offset`.
 * @param value Header value
 * @returns True for e.g. "0" or "42", false for "", "-1", "1.5" or "abc"
 */
const isNonNegativeInteger = (value: string): boolean => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));

const BASE64_PATTERN = /^(?:[a-z\d+/]{4})*(?:[a-z\d+/]{2}==|[a-z\d+/]{3}=)?$/i;

/**
 * Metadata keys the server stores on an upload for its own bookkeeping. They are never echoed
 * back in `Upload-Metadata`, and a client can't set them.
 */
const INTERNAL_METADATA_KEYS = new Set(["partialIds", "uploadConcat"]);

/**
 * Parse TUS protocol metadata string into object.
 *
 * Follows the spec: pairs are comma separated, each pair is a key and an optional base64 value
 * separated by a single space. Keys MUST NOT be empty or contain spaces/commas and MUST be
 * unique; a malformed header is rejected with `400 Bad Request`.
 * @param encoded Base64-encoded metadata string (optional, defaults to empty string)
 * @returns Parsed metadata object with decoded values
 * @throws {HttpError} 400 when the header is malformed
 */
export const parseMetadata = (encoded = ""): Metadata => {
    const metadata = Object.create(Metadata.prototype) as Record<string, string>;

    if (encoded.trim() === "") {
        return metadata;
    }

    for (const pair of encoded.split(",")) {
        const parts = pair.trim().split(" ");
        const [key, value] = parts;

        if (!key || parts.length > 2) {
            throw createHttpError(400, "Invalid Upload-Metadata header: malformed key-value pair");
        }

        if (Object.hasOwn(metadata, key)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: duplicate key "${key}"`);
        }

        if (INTERNAL_METADATA_KEYS.has(key)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: reserved key "${key}"`);
        }

        if (value !== undefined && value !== "" && !BASE64_PATTERN.test(value)) {
            throw createHttpError(400, `Invalid Upload-Metadata header: value of "${key}" is not base64`);
        }

        metadata[key] = value ? Buffer.from(value, "base64").toString() : "";
    }

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

/** Methods a client may tunnel through `X-HTTP-Method-Override`. */
const OVERRIDABLE_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST"]);

/**
 * Resolves an `X-HTTP-Method-Override` header to the method the server must use.
 * @param header Header value
 * @returns The upper-cased method, or undefined when the header is absent
 * @throws {HttpError} 400 for a method the TUS handler doesn't serve
 */
export const resolveMethodOverride = (header: string | undefined): string | undefined => {
    if (header === undefined || header.trim() === "") {
        return undefined;
    }

    const method = header.trim().toUpperCase();

    if (!OVERRIDABLE_METHODS.has(method)) {
        throw createHttpError(400, `Unsupported X-HTTP-Method-Override: ${header}`);
    }

    return method;
};

/**
 * Parses an `Upload-Offset` header strictly: anything but a non-negative integer becomes NaN,
 * which `handlePatch` rejects with 400 (`Number.parseInt("12abc")` would silently give 12).
 * @param header Header value
 * @returns The offset, or NaN when the header is invalid
 */
export const parseUploadOffset = (header: string | undefined): number => (header !== undefined && isNonNegativeInteger(header) ? Number(header) : Number.NaN);

/** Checksum algorithms the TUS handler can verify itself when the storage can't. */
const HANDLER_CHECKSUM_ALGORITHMS = ["md5", "sha1", "sha256", "sha384", "sha512"].filter((algorithm) => getHashes().includes(algorithm));

/**
 * Reads a request body (Node.js Readable, Web ReadableStream or a buffer) into memory.
 * @param body Request body
 * @returns The body bytes
 */
const readBody = async (body: unknown): Promise<Buffer> => {
    if (body === undefined || body === null) {
        return Buffer.alloc(0);
    }

    if (body instanceof Uint8Array) {
        return Buffer.from(body);
    }

    const chunks: Buffer[] = [];

    if (typeof (body as ReadableStream<Uint8Array>).getReader === "function") {
        const reader = (body as ReadableStream<Uint8Array>).getReader();

        for (;;) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            chunks.push(Buffer.from(value));
        }

        return Buffer.concat(chunks);
    }

    for await (const chunk of body as AsyncIterable<Uint8Array | string>) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
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
    // eslint-disable-next-line class-methods-use-this
    protected get storage(): {
        checkIfExpired: (file: TFile) => Promise<void>;
        checksumTypes: string[];
        config: { useRelativeLocation?: boolean };
        create: (config: FileInit) => Promise<TFile>;
        delete: (options: { id: string }) => Promise<TFile>;
        getMeta: (id: string) => Promise<TFile>;
        getStream?: (options: { id: string }) => Promise<{ size?: number; stream: unknown }>;
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
     * @param _requestUrl Request URL string
     * @param _file File object containing ID
     * @returns Constructed file URL for TUS protocol
     */
    // eslint-disable-next-line class-methods-use-this
    protected buildFileUrl(_requestUrl: string, _file: TFile): string {
        // This will be overridden by subclasses
        throw new Error("buildFileUrl must be implemented");
    }

    /**
     * Handle OPTIONS request with TUS protocol capabilities.
     * @param methods Array of supported HTTP methods
     * @returns ResponseFile with TUS headers
     */
    public handleOptions(methods: string[]): ResponseFile<TFile> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Location, Tus-Extension, Tus-Max-Size, Tus-Resumable, Tus-Version, Upload-Checksum, Upload-Concat, Upload-Defer-Length, Upload-Length, Upload-Metadata, Upload-Offset, X-HTTP-Method-Override, X-Requested-With",
            "Access-Control-Allow-Methods": methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "Tus-Checksum-Algorithm": this.checksumAlgorithms.join(","),
            "Tus-Extension": this.storage.tusExtension.toString(),
            "Tus-Max-Size": this.storage.maxUploadSize,
            "Tus-Version": TUS_VERSION_VERSION,
        };

        return { headers, statusCode: 204 } as unknown as ResponseFile<TFile>;
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
    public async handlePost(
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

            // TUS creation-defer-length: "If the Upload-Defer-Length header contains any other value than 1
            // the server should return a 400 Bad Request status."
            if (uploadDeferLength !== "1") {
                throw createHttpError(400, "Upload-Defer-Length must be 1");
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

                // TUS creation: the server MUST respond with 201 Created, also with creation-with-upload.
                return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
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
                if (uploadLength !== undefined && !isNonNegativeInteger(uploadLength)) {
                    throw createHttpError(400, "Invalid upload-length");
                }

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

                // Partial uploads are not processed until concatenated (see handlePatch).
                if (file.status === "completed") {
                    file = { ...file, status: "part" };
                }

                // TUS creation: the server MUST respond with 201 Created, also with creation-with-upload.
                return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
            }

            if (uploadConcat.startsWith("final;")) {
                // Create a final upload that concatenates partial uploads
                // The spec lists partial upload URLs (absolute or relative); bare IDs are accepted too.
                const partialIds = uploadConcat
                    .slice(6)
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((reference) => {
                        let partialId: string | undefined;

                        try {
                            partialId = reference.includes("/") ? getIdFromRequestUrl(reference) : reference;
                        } catch {
                            partialId = undefined;
                        }

                        if (partialId === undefined) {
                            throw createHttpError(400, `Upload-Concat final contains an invalid partial upload URL: ${reference}`);
                        }

                        return partialId;
                    });

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

        if (uploadLength !== undefined && !isNonNegativeInteger(uploadLength)) {
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
            this.storage.tusExtension.includes("expiration") &&
            typeof file.expiredAt === "number" &&
            file.bytesWritten !== Number.parseInt(uploadLength as string, 10)
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

        // TUS creation: the server MUST respond with 201 Created, also with creation-with-upload.
        return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
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
    public async handlePatch(
        id: string,
        uploadOffset: number,
        uploadLength: string | undefined,
        metadataHeader: string | undefined,
        checksum: string | undefined,
        checksumAlgorithm: string | undefined,
        _requestUrl: string,
        bodyStream: unknown,
        contentLength: number,
    ): Promise<ResponseFile<TFile>> {
        // TUS core: Upload-Offset is required on PATCH and MUST be a non-negative integer.
        if (!Number.isInteger(uploadOffset) || uploadOffset < 0) {
            throw createHttpError(400, "Invalid or missing Upload-Offset header");
        }

        const metadata = metadataHeader ? parseMetadata(metadataHeader) : undefined;

        // Check if file is expired before processing
        let currentFile: TFile;

        try {
            currentFile = await this.storage.getMeta(id);
            await this.storage.checkIfExpired(currentFile);
        } catch (error: unknown) {
            const errorWithCode = error as { UploadErrorCode?: string };

            if (errorWithCode.UploadErrorCode === "GONE") {
                throw createHttpError(410, "Upload expired");
            }

            if (errorWithCode.UploadErrorCode === "FILE_NOT_FOUND") {
                throw createHttpError(404, "Upload not found");
            }

            throw error;
        }

        // Block PATCH on final concatenation uploads
        const uploadConcatValue = currentFile.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string" && uploadConcatValue.startsWith("final;")) {
            throw createHttpError(403, "Cannot PATCH a final concatenation upload");
        }

        // TUS core: "If the offsets do not match, the Server MUST respond with the 409 Conflict
        // status without modifying the upload resource."
        const currentOffset = Number.isNaN(currentFile.bytesWritten) ? 0 : currentFile.bytesWritten;

        if (uploadOffset !== currentOffset) {
            throw createHttpError(409, `Upload-Offset ${String(uploadOffset)} does not match the current offset ${String(currentOffset)}`);
        }

        const deferredSize = this.validateDeferredUploadLength(currentFile, uploadLength, contentLength);

        // Verify the checksum before anything is written: on a mismatch the chunk MUST be discarded.
        let body = bodyStream;
        let nativeChecksum: Checksum = { checksum: undefined, checksumAlgorithm: undefined };

        if (checksumAlgorithm !== undefined) {
            if (checksum === undefined) {
                throw createHttpError(400, "Invalid Upload-Checksum header");
            }

            if (this.storage.checksumTypes.includes(checksumAlgorithm)) {
                nativeChecksum = { checksum, checksumAlgorithm };
            } else if (HANDLER_CHECKSUM_ALGORITHMS.includes(checksumAlgorithm)) {
                const bytes = await readBody(bodyStream);

                if (createHash(checksumAlgorithm).update(bytes).digest("base64") !== checksum) {
                    throw createHttpError(460, "Checksum Mismatch");
                }

                body = Readable.from([bytes]);
            } else {
                throw createHttpError(400, `Unsupported checksum algorithm: ${checksumAlgorithm}`);
            }
        }

        if (metadata) {
            await this.storage.update({ id }, { id, metadata });
        }

        if (deferredSize !== undefined) {
            await this.storage.update({ id }, { size: deferredSize });
        }

        let file = await this.storage.write({
            body,
            ...nativeChecksum,
            contentLength,
            id,
            start: uploadOffset,
        });

        // A deferred length can make an upload complete without this chunk carrying the last byte.
        if (deferredSize !== undefined && file.bytesWritten === deferredSize && file.status !== "completed") {
            file = { ...file, size: deferredSize, status: "completed" };
        }

        // TUS concatenation: "The Server SHOULD NOT process these partial uploads until they are
        // concatenated to form a final upload", so a finished partial is not reported as completed
        // (no onComplete hook, no "completed" event).
        if (file.status === "completed" && file.metadata?.uploadConcat === "partial") {
            file = { ...file, status: "part" };
        }

        return {
            ...file,
            headers: this.buildHeaders(file, {
                "Upload-Offset": file.bytesWritten,
            }) as Record<string, string | number>,
            // TUS core: a successful PATCH MUST answer 204 No Content, including the completing one.
            statusCode: 204,
        };
    }

    /**
     * Checksum algorithms advertised in `Tus-Checksum-Algorithm`: the ones the storage verifies
     * natively first, then the ones this handler verifies itself.
     * @returns Lowercase algorithm names
     */
    protected get checksumAlgorithms(): string[] {
        return [...new Set([...this.storage.checksumTypes, ...HANDLER_CHECKSUM_ALGORITHMS])];
    }

    /**
     * Validates an `Upload-Length` sent on PATCH for a deferred-length upload.
     * @param file Current upload state
     * @param uploadLength Upload-Length header value
     * @param contentLength Length of this PATCH's body
     * @returns The new upload size, or undefined when no Upload-Length was sent
     */
    private validateDeferredUploadLength(file: TFile, uploadLength: string | undefined, contentLength: number): number | undefined {
        if (uploadLength === undefined) {
            return undefined;
        }

        if (!this.storage.tusExtension.includes("creation-defer-length")) {
            throw createHttpError(501, "creation-defer-length extension is not (yet) supported.");
        }

        // If size is already set, it cannot be changed
        if (file.size !== undefined && !Number.isNaN(file.size)) {
            throw createHttpError(412, "Upload-Length has already been set for this upload");
        }

        if (!isNonNegativeInteger(uploadLength)) {
            throw createHttpError(400, "Invalid Upload-Length value");
        }

        const size = Number(uploadLength);
        const offset = Number.isNaN(file.bytesWritten) ? 0 : file.bytesWritten;

        if (size < offset + (contentLength || 0)) {
            throw createHttpError(400, "Upload-Length is smaller than the upload's data");
        }

        if (size > this.storage.maxUploadSize) {
            throw createHttpError(413, "Upload-Length exceeds the maximum upload size");
        }

        return size;
    }

    /**
     * Handle TUS HEAD (get upload status).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with upload status headers
     */
    public async handleHead(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.getMeta(id);

        await this.storage.checkIfExpired(file);

        const headers: Headers = {
            ...(typeof file.size === "number" && !Number.isNaN(file.size)
                ? {
                      "Upload-Length": file.size,
                  }
                : {
                      "Upload-Defer-Length": "1",
                  }),
            ...this.buildHeaders(file, {
                "Cache-Control": HeaderUtilities.createCacheControlPreset("no-store"),
                "Upload-Metadata": serializeMetadata(
                    Object.fromEntries(Object.entries(file.metadata ?? {}).filter(([key]) => !INTERNAL_METADATA_KEYS.has(key))),
                ),
                "Upload-Offset": file.bytesWritten,
            }),
        };

        // Add Upload-Concat header for concatenation extension
        const uploadConcatValue = file.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string") {
            headers["Upload-Concat"] = uploadConcatValue;
        }

        return { headers: headers as Record<string, string>, statusCode: 200 } as unknown as ResponseFile<TFile>;
    }

    /**
     * Handle TUS GET (get upload metadata).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public async handleGet(id: string): Promise<ResponseFile<TFile>> {
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
    public async handleDelete(id: string): Promise<ResponseFile<TFile>> {
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
        };
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
    // eslint-disable-next-line class-methods-use-this
    public extractChecksum(checksumHeader: string | undefined): Checksum {
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
    // eslint-disable-next-line class-methods-use-this
    public validateTusResumableHeader(tusResumable: string | undefined): void {
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

        for (const partialFile of partialFiles) {
            // Get stream for this partial file
            if (!this.storage.getStream) {
                throw createHttpError(501, "getStream is not supported by this storage backend");
            }

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
        // bytesWritten is updated automatically by the write operations
    }
}

export const TUS_RESUMABLE: string = TUS_RESUMABLE_VERSION;
export const TUS_VERSION: string = TUS_VERSION_VERSION;
