import { Readable } from "node:stream";

import createHttpError from "http-errors";

import type { Checksum, FileInit, UploadFile } from "../../storage/utils/file";
import { HeaderUtilities } from "../../utils/headers";
import type { Headers } from "../../utils/types";
import type { ResponseFile } from "../types";
import { computeChecksum, getHandlerChecksumAlgorithms, readBoundedBody } from "./tus-checksum";
import {
    isNonNegativeInteger,
    parseFinalConcatIds,
    parseMetadata,
    publicMetadata,
    serializeMetadata,
    TUS_RESUMABLE_VERSION,
    TUS_VERSION_VERSION,
    validateTusResumable,
} from "./tus-protocol";

export { parseMetadata, resolveMethodOverride, serializeMetadata } from "./tus-protocol";

/** Default for {@link TusBaseConfig.maxChecksumBufferSize}: 64 MiB. */
export const DEFAULT_MAX_CHECKSUM_BUFFER_SIZE: number = 64 * 1024 * 1024;

/**
 * A TUS request, independent of the runtime (Node.js `IncomingMessage` or Web `Request`).
 */
export interface TusRequest {
    /** Request body stream. */
    body: unknown;

    /** Reads a request header by its lower-case name. */
    header: (name: string) => string | undefined;

    /** Resolves the upload ID from the URL; throws a 404 HttpError when there is none. */
    resolveId: () => string;

    /** Request URL, used to build `Location`. */
    url: string;
}

/**
 * The part of a storage adapter the TUS handler uses.
 */
export interface TusStorage<TFile extends UploadFile> {
    checkIfExpired: (file: TFile) => Promise<unknown>;
    checksumTypes: string[];
    config: { useRelativeLocation?: boolean };
    create: (config: FileInit) => Promise<TFile>;
    delete: (options: { id: string }) => Promise<TFile>;
    getMeta: (id: string) => Promise<TFile>;
    getStream?: (options: { id: string }) => Promise<{ size?: number; stream: unknown }>;
    maxUploadSize: number;

    /** False for adapters that can only store an object in one request. */
    supportsResumableWrites?: boolean;
    tusExtension: string[];
    update: (options: { id: string }, updates: { id?: string; metadata?: Record<string, unknown>; size?: number }) => Promise<TFile>;
    write: (options: { body: unknown; checksum?: string; checksumAlgorithm?: string; contentLength: number; id: string; start: number }) => Promise<TFile>;
}

export interface TusBaseConfig<TFile extends UploadFile> {
    /** Builds the `Location` of an upload from the creation request's URL. */
    buildFileUrl: (requestUrl: string, file: TFile) => string;

    /** Whether DELETE is refused for finished uploads. */
    disableTerminationForFinishedUploads: () => boolean;

    /**
     * Largest chunk the handler buffers to verify an `Upload-Checksum` the storage can't verify
     * itself. Bigger checksummed chunks are refused with 413.
     */
    maxChecksumBufferSize?: number;

    /** The storage adapter. */
    storage: () => TusStorage<TFile>;
}

/**
 * Shared TUS protocol logic for the Node.js and Web (fetch) handlers. The runtime handlers only
 * adapt their request to a {@link TusRequest}; all header parsing and validation happens here.
 * @template TFile The file type used by this handler.
 */
export class TusBase<TFile extends UploadFile> {
    /** Uploads with a PATCH in progress in this process; a concurrent PATCH gets 423 Locked. */
    private readonly patchesInFlight = new Set<string>();

    public constructor(private readonly config: TusBaseConfig<TFile>) {}

    private get storage(): TusStorage<TFile> {
        return this.config.storage();
    }

    /**
     * Checksum algorithms advertised in `Tus-Checksum-Algorithm`: the ones the storage verifies
     * natively first, then the ones this handler verifies itself.
     * @returns Lowercase algorithm names
     */
    public get checksumAlgorithms(): string[] {
        return [...new Set([...this.storage.checksumTypes, ...getHandlerChecksumAlgorithms()])];
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
     * Handle TUS POST (create an upload, optionally with its first data).
     * @param request TUS request
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async handlePost(request: TusRequest): Promise<ResponseFile<TFile>> {
        validateTusResumable(request.header("tus-resumable"));

        const uploadLength = request.header("upload-length");
        const uploadDeferLength = request.header("upload-defer-length");
        const uploadConcat = request.header("upload-concat");
        const metadata = parseMetadata(request.header("upload-metadata"));

        if (uploadLength !== undefined && !isNonNegativeInteger(uploadLength)) {
            throw createHttpError(400, "Invalid upload-length");
        }

        if (uploadDeferLength !== undefined) {
            this.requireExtension("creation-defer-length");

            // TUS creation-defer-length: "If the Upload-Defer-Length header contains any other value than 1
            // the server should return a 400 Bad Request status."
            if (uploadDeferLength !== "1") {
                throw createHttpError(400, "Upload-Defer-Length must be 1");
            }
        }

        if (uploadConcat !== undefined) {
            this.requireExtension("concatenation");

            if (uploadConcat === "partial") {
                return this.createUpload(request, { metadata: { ...metadata, uploadConcat: "partial" }, size: uploadLength }, { "Upload-Concat": "partial" });
            }

            if (uploadConcat.startsWith("final;")) {
                return this.createFinalUpload(request, metadata, uploadConcat);
            }

            throw createHttpError(400, "Invalid Upload-Concat header format");
        }

        if (uploadLength === undefined && uploadDeferLength === undefined) {
            throw createHttpError(400, "Either upload-length or upload-defer-length must be specified.");
        }

        return this.createUpload(request, { metadata, size: uploadLength }, uploadLength === undefined ? { "Upload-Defer-Length": "1" } : {});
    }

    /**
     * Handle TUS PATCH (write a chunk).
     * @param request TUS request
     * @returns Promise resolving to ResponseFile with upload progress
     */
    public async handlePatch(request: TusRequest): Promise<ResponseFile<TFile>> {
        validateTusResumable(request.header("tus-resumable"));

        const id = request.resolveId();
        const offsetHeader = request.header("upload-offset");
        const contentType = request.header("content-type");

        if (offsetHeader === undefined) {
            throw createHttpError(412, "Missing Upload-Offset header");
        }

        if (contentType === undefined) {
            throw createHttpError(412, "Content-Type header required");
        }

        if (contentType !== "application/offset+octet-stream") {
            throw createHttpError(415, "Unsupported Media Type");
        }

        // TUS core: Upload-Offset MUST be a non-negative integer.
        if (!isNonNegativeInteger(offsetHeader)) {
            throw createHttpError(400, "Invalid Upload-Offset header");
        }

        // A second PATCH racing the first would pass the offset check below before either writes.
        if (this.patchesInFlight.has(id)) {
            throw createHttpError(423, "The upload is locked by another request");
        }

        this.patchesInFlight.add(id);

        try {
            return await this.writeChunk(request, id, Number(offsetHeader));
        } finally {
            this.patchesInFlight.delete(id);
        }
    }

    /**
     * Handle TUS HEAD (get upload status).
     * @param request TUS request
     * @returns Promise resolving to ResponseFile with upload status headers
     */
    public async handleHead(request: TusRequest): Promise<ResponseFile<TFile>> {
        validateTusResumable(request.header("tus-resumable"));

        const file = await this.storage.getMeta(request.resolveId());

        await this.storage.checkIfExpired(file);

        const headers: Headers = {
            ...(typeof file.size === "number" && !Number.isNaN(file.size) ? { "Upload-Length": file.size } : { "Upload-Defer-Length": "1" }),
            ...this.buildHeaders(file, {
                "Cache-Control": HeaderUtilities.createCacheControlPreset("no-store"),
                "Upload-Metadata": serializeMetadata(publicMetadata(file.metadata)),
                "Upload-Offset": file.bytesWritten,
            }),
        };

        const uploadConcatValue = file.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string") {
            headers["Upload-Concat"] = uploadConcatValue;
        }

        return { headers: headers as Record<string, string>, statusCode: 200 } as unknown as ResponseFile<TFile>;
    }

    /**
     * Handle TUS GET (get upload metadata).
     * @param request TUS request
     * @returns Promise resolving to ResponseFile with file metadata as JSON
     */
    public async handleGet(request: TusRequest): Promise<ResponseFile<TFile>> {
        validateTusResumable(request.header("tus-resumable"));

        const file = await this.storage.getMeta(request.resolveId());

        return {
            ...file,
            body: file,
            headers: this.buildHeaders(file, {
                "Content-Type": HeaderUtilities.createContentType({ mediaType: "application/json" }),
            }) as Record<string, string | number>,
            statusCode: 200,
        };
    }

    /**
     * Handle TUS DELETE (terminate upload).
     * @param request TUS request
     * @returns Promise resolving to ResponseFile with deletion confirmation
     */
    public async handleDelete(request: TusRequest): Promise<ResponseFile<TFile>> {
        validateTusResumable(request.header("tus-resumable"));

        const id = request.resolveId();

        try {
            if (this.config.disableTerminationForFinishedUploads()) {
                const existing = await this.storage.getMeta(id);

                if (existing.status === "completed") {
                    throw createHttpError(400, "Termination of finished uploads is disabled");
                }
            }

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                throw createHttpError(404, "File not found");
            }

            return { ...file, headers: this.buildHeaders(file) as Record<string, string>, statusCode: 204 };
        } catch (error: unknown) {
            if ((error as { code?: string }).code === "ENOENT") {
                throw createHttpError(404, "File not found");
            }

            throw error;
        }
    }

    /**
     * Build TUS protocol headers including required Tus-Resumable and optional Upload-Expires.
     * @param file Upload file object with metadata
     * @param headers Additional headers to include
     * @returns Headers object with TUS protocol headers
     */
    protected buildHeaders(file: UploadFile, headers: Headers = {}): Headers {
        headers["Tus-Resumable"] = TUS_RESUMABLE_VERSION;

        if (this.storage.tusExtension.includes("expiration") && file.expiredAt !== undefined) {
            headers["Upload-Expires"] = new Date(file.expiredAt).toUTCString();
        }

        return headers;
    }

    /**
     * Concatenate partial uploads into a final upload.
     * @param finalFile Final file that will contain concatenated content
     * @param partialFiles Array of partial upload files to concatenate
     */
    protected async concatenateFiles(finalFile: TFile, partialFiles: TFile[]): Promise<void> {
        const { getStream } = this.storage;

        if (!getStream) {
            throw createHttpError(501, "getStream is not supported by this storage backend");
        }

        let offset = 0;

        for (const partialFile of partialFiles) {
            const { size, stream } = await getStream.call(this.storage, { id: partialFile.id });

            if (size === undefined) {
                throw createHttpError(500, "Partial upload size is undefined");
            }

            Object.assign(finalFile, await this.storage.write({ ...finalFile, body: stream, contentLength: size, start: offset }));
            offset += size;
        }
    }

    /**
     * Creates an upload and, for creation-with-upload, writes the request body as its first data.
     * @param request TUS request
     * @param init Upload to create
     * @param extraHeaders Headers specific to the kind of upload
     * @returns 201 response
     */
    private async createUpload(request: TusRequest, init: FileInit, extraHeaders: Headers): Promise<ResponseFile<TFile>> {
        const contentLength = TusBase.contentLength(request);
        let file = await this.storage.create(init);

        if (request.header("content-type") === "application/offset+octet-stream" && contentLength !== undefined && contentLength > 0) {
            this.assertResumableWrite(file, 0, contentLength, undefined);

            file = await this.storage.write({ ...file, body: request.body, contentLength, start: 0 });
        }

        file = TusBase.holdPartialUpload(file);

        const headers: Headers = { ...this.buildHeaders(file, { Location: this.config.buildFileUrl(request.url, file) }), ...extraHeaders };

        if (file.bytesWritten > 0) {
            headers["Upload-Offset"] = file.bytesWritten.toString();
        }

        // TUS creation: the server MUST respond with 201 Created, also with creation-with-upload.
        return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
    }

    /**
     * Creates a final upload from completed partial uploads (concatenation extension).
     * @param request TUS request
     * @param metadata Client metadata for the final upload
     * @param uploadConcat Upload-Concat header (`final;...`)
     * @returns 201 response
     */
    private async createFinalUpload(request: TusRequest, metadata: Record<string, unknown>, uploadConcat: string): Promise<ResponseFile<TFile>> {
        const partialIds = parseFinalConcatIds(uploadConcat);
        const partialFiles: TFile[] = [];

        for (const partialId of partialIds) {
            partialFiles.push(await this.getCompletedPartial(partialId));
        }

        const file = await this.storage.create({
            metadata: { ...metadata, partialIds, uploadConcat: `final;${partialIds.join(" ")}` },
            size: partialFiles.reduce((total, partial) => total + (partial.size as number), 0),
        });

        await this.concatenateFiles(file, partialFiles);

        const headers: Headers = {
            ...this.buildHeaders(file, { Location: this.config.buildFileUrl(request.url, file) }),
            "Upload-Concat": uploadConcat,
        };

        return { ...file, headers: headers as Record<string, string | number>, statusCode: 201 };
    }

    /**
     * Loads a partial upload referenced by a final upload and checks it is finished.
     * @param partialId Partial upload ID
     * @returns The partial upload
     */
    private async getCompletedPartial(partialId: string): Promise<TFile> {
        let partialFile: TFile;

        try {
            partialFile = await this.storage.getMeta(partialId);
            await this.storage.checkIfExpired(partialFile);
        } catch {
            throw createHttpError(409, `Partial upload ${partialId} not found or expired`);
        }

        if (partialFile.metadata?.uploadConcat !== "partial") {
            throw createHttpError(400, `Upload ${partialId} is not a partial upload`);
        }

        if (partialFile.status !== "completed" || partialFile.size === undefined) {
            throw createHttpError(409, `Partial upload ${partialId} is not completed`);
        }

        return partialFile;
    }

    /**
     * Validates and writes one PATCH chunk. Runs while the upload is locked by {@link handlePatch}.
     * @param request TUS request
     * @param id Upload ID
     * @param uploadOffset Validated Upload-Offset
     * @returns 204 response
     */
    private async writeChunk(request: TusRequest, id: string, uploadOffset: number): Promise<ResponseFile<TFile>> {
        const contentLength = TusBase.contentLength(request);
        const metadataHeader = request.header("upload-metadata");
        const metadata = metadataHeader === undefined ? undefined : parseMetadata(metadataHeader);
        const current = await this.storage.getMeta(id);

        await this.storage.checkIfExpired(current);

        const uploadConcatValue = current.metadata?.uploadConcat;

        if (typeof uploadConcatValue === "string" && uploadConcatValue.startsWith("final;")) {
            throw createHttpError(403, "Cannot PATCH a final concatenation upload");
        }

        // TUS core: "If the offsets do not match, the Server MUST respond with the 409 Conflict
        // status without modifying the upload resource."
        const currentOffset = Number.isNaN(current.bytesWritten) ? 0 : current.bytesWritten;

        if (uploadOffset !== currentOffset) {
            throw createHttpError(409, `Upload-Offset ${String(uploadOffset)} does not match the current offset ${String(currentOffset)}`);
        }

        const deferredSize = this.validateDeferredUploadLength(current, request.header("upload-length"), contentLength);

        this.assertResumableWrite(current, uploadOffset, contentLength, deferredSize);

        const size = deferredSize ?? current.size;
        const { body, native } = await this.prepareChecksum(request, contentLength, size === undefined ? undefined : size - uploadOffset);

        // The adapter must know the final length when it writes, to finish the upload on its last byte.
        if (deferredSize !== undefined) {
            await this.storage.update({ id }, { size: deferredSize });
        }

        let file: TFile;

        try {
            file = await this.storage.write({ body, ...native, contentLength: contentLength ?? 0, id, start: uploadOffset });
        } catch (error: unknown) {
            // A rejected chunk must leave the upload as it was.
            if (deferredSize !== undefined) {
                await this.storage.update({ id }, { size: undefined }).catch(() => undefined);
            }

            throw error;
        }

        // A deferred length can make an upload complete without this chunk carrying the last byte.
        if (deferredSize !== undefined && file.bytesWritten === deferredSize && file.status !== "completed") {
            file = { ...file, size: deferredSize, status: "completed" };
        }

        if (metadata !== undefined) {
            file = await this.applyMetadata(file, metadata);
        }

        return {
            ...TusBase.holdPartialUpload(file),
            headers: this.buildHeaders(file, { "Upload-Offset": file.bytesWritten }) as Record<string, string | number>,
            // TUS core: a successful PATCH MUST answer 204 No Content, including the completing one.
            statusCode: 204,
        };
    }

    /**
     * Stores `Upload-Metadata` sent with a PATCH (a non-standard convenience), after the chunk
     * was written so a rejected chunk doesn't change it.
     * @param file Upload after the write
     * @param metadata Parsed metadata
     * @returns The upload with the metadata merged in
     */
    private async applyMetadata(file: TFile, metadata: Record<string, unknown>): Promise<TFile> {
        try {
            await this.storage.update({ id: file.id }, { id: file.id, metadata });
        } catch (error: unknown) {
            // Some adapters drop a finished upload's metadata on completion; nothing left to update.
            if (file.status !== "completed") {
                throw error;
            }
        }

        return { ...file, metadata: { ...file.metadata, ...metadata } };
    }

    /**
     * Picks who verifies an `Upload-Checksum`: the storage when it supports the algorithm, else
     * this handler, which buffers the chunk (bounded by `maxChecksumBufferSize`) and compares
     * digests before anything is written.
     * @param request TUS request
     * @param contentLength Declared chunk length
     * @param remaining Bytes left in the upload, when its length is known
     * @returns The body to write and the checksum to pass to the storage
     */
    private async prepareChecksum(
        request: TusRequest,
        contentLength: number | undefined,
        remaining: number | undefined,
    ): Promise<{ body: unknown; native: Checksum }> {
        const header = request.header("upload-checksum");

        if (header === undefined) {
            return { body: request.body, native: {} };
        }

        const [algorithm, checksum] = header.split(/\s+/).filter(Boolean);

        if (algorithm === undefined || checksum === undefined) {
            throw createHttpError(400, "Invalid Upload-Checksum header");
        }

        if (this.storage.checksumTypes.includes(algorithm)) {
            return { body: request.body, native: { checksum, checksumAlgorithm: algorithm } };
        }

        if (!getHandlerChecksumAlgorithms().includes(algorithm)) {
            throw createHttpError(400, `Unsupported checksum algorithm: ${algorithm}`);
        }

        if (contentLength === undefined) {
            throw createHttpError(411, "Content-Length is required to verify Upload-Checksum");
        }

        if (remaining !== undefined && contentLength > remaining) {
            throw createHttpError(413, "Chunk is larger than the rest of the upload");
        }

        const limit = this.config.maxChecksumBufferSize ?? DEFAULT_MAX_CHECKSUM_BUFFER_SIZE;

        if (contentLength > limit) {
            throw createHttpError(413, `Checksummed chunks may be at most ${String(limit)} bytes; send smaller chunks`);
        }

        const bytes = await readBoundedBody(request.body, contentLength);

        if (bytes.byteLength !== contentLength) {
            throw createHttpError(400, "Request body is shorter than its Content-Length");
        }

        if (computeChecksum(algorithm, bytes) !== checksum) {
            throw createHttpError(460, "Checksum Mismatch");
        }

        return { body: Readable.from([bytes]), native: {} };
    }

    /**
     * Validates an `Upload-Length` sent on PATCH for a deferred-length upload.
     * @param file Current upload state
     * @param uploadLength Upload-Length header value
     * @param contentLength Length of this PATCH's body
     * @returns The new upload size, or undefined when there is nothing to set
     */
    private validateDeferredUploadLength(file: TFile, uploadLength: string | undefined, contentLength: number | undefined): number | undefined {
        if (uploadLength === undefined) {
            return undefined;
        }

        this.requireExtension("creation-defer-length");

        if (!isNonNegativeInteger(uploadLength)) {
            throw createHttpError(400, "Invalid Upload-Length value");
        }

        const size = Number(uploadLength);

        if (file.size !== undefined && !Number.isNaN(file.size)) {
            // A client retrying with the same length is fine; changing it is not.
            if (file.size === size) {
                return undefined;
            }

            throw createHttpError(412, "Upload-Length has already been set for this upload");
        }

        const offset = Number.isNaN(file.bytesWritten) ? 0 : file.bytesWritten;

        if (size < offset + (contentLength ?? 0)) {
            throw createHttpError(400, "Upload-Length is smaller than the upload's data");
        }

        if (size > this.storage.maxUploadSize) {
            throw createHttpError(413, "Upload-Length exceeds the maximum upload size");
        }

        return size;
    }

    /**
     * Refuses a chunk a single-request storage can't take, before its body is read.
     * @param file Current upload state
     * @param offset Chunk offset
     * @param contentLength Declared chunk length
     * @param deferredSize Length set by this request, if any
     */
    private assertResumableWrite(file: TFile, offset: number, contentLength: number | undefined, deferredSize: number | undefined): void {
        if (this.storage.supportsResumableWrites !== false) {
            return;
        }

        const size = deferredSize ?? file.size;

        if (offset > 0 || (contentLength !== undefined && typeof size === "number" && !Number.isNaN(size) && contentLength < size)) {
            throw createHttpError(405, "This storage backend does not support chunked or resumable uploads; send the whole file in a single request.");
        }
    }

    private requireExtension(extension: string): void {
        if (!this.storage.tusExtension.includes(extension)) {
            throw createHttpError(501, `${extension} extension is not supported by this storage backend.`);
        }
    }

    /**
     * Content-Length of a request, or undefined when it is absent or not a valid length.
     * @param request TUS request
     * @returns The length in bytes
     */
    private static contentLength(request: TusRequest): number | undefined {
        const header = request.header("content-length");

        return header !== undefined && isNonNegativeInteger(header) ? Number(header) : undefined;
    }

    /**
     * TUS concatenation: "The Server SHOULD NOT process these partial uploads until they are
     * concatenated to form a final upload", so a finished partial is not reported as completed
     * (no onComplete hook, no "completed" event).
     * @param file Upload state
     * @returns The upload, with a finished partial reported as "part"
     */
    private static holdPartialUpload<T extends UploadFile>(file: T): T {
        return file.status === "completed" && file.metadata?.uploadConcat === "partial" ? { ...file, status: "part" } : file;
    }
}

export const TUS_RESUMABLE: string = TUS_RESUMABLE_VERSION;
export const TUS_VERSION: string = TUS_VERSION_VERSION;
