import { finished, Readable } from "node:stream";

import createHttpError from "http-errors";

import { WRITE_CLAIM_KEY } from "../../storage/meta-storage";
import type { Checksum, FileInit, UploadFile } from "../../storage/utils/file";
import { HeaderUtilities } from "../../utils/headers";
import StreamLength, { isStreamLengthError } from "../../utils/pipes/stream-length";
import type { Headers } from "../../utils/types";
import type { LocationSource } from "../base/base-handler-core";
import type { ResponseFile } from "../types";
import { computeChecksum, getHandlerChecksumAlgorithms, readBoundedBody } from "../utils/checksum";
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
export interface TusRequest extends LocationSource {
    /** Request body stream. */
    body: unknown;

    /** Reads a request header by its lower-case name. */
    header: (name: string) => string | undefined;

    /** Resolves the upload ID from the URL; throws a 404 HttpError when there is none. */
    resolveId: () => string;
}

/**
 * The part of a storage adapter the TUS handler uses.
 */
export interface TusStorage<TFile extends UploadFile> {
    checkIfExpired: (file: TFile) => Promise<unknown>;
    checksumTypes: string[];

    /** Claims an upload for one PATCH across processes; resolves to the release (see `BaseStorage.claimWrite`). */
    claimWrite?: (id: string) => Promise<() => Promise<void>>;
    config: { useRelativeLocation?: boolean };
    create: (config: FileInit) => Promise<TFile>;
    delete: (options: { id: string }) => Promise<TFile>;
    getMeta: (id: string) => Promise<TFile>;
    getStream?: (options: { id: string }) => Promise<{ size?: number; stream: unknown }>;
    maxUploadSize: number;

    /** True for adapters that need a chunk's length before storing it (S3 parts, GCS, Azure blocks). */
    requiresContentLength?: boolean;

    /** False for adapters that can only store an object in one request. */
    supportsResumableWrites?: boolean;
    tusExtension: string[];
    update: (options: { id: string }, updates: { id?: string; metadata?: Record<string, unknown>; size?: number }) => Promise<TFile>;
    write: (options: { body: unknown; checksum?: string; checksumAlgorithm?: string; contentLength?: number; id: string; start: number }) => Promise<TFile>;
}

export interface TusBaseConfig<TFile extends UploadFile> {
    /** Builds the `Location` of an upload from the creation request. */
    buildFileUrl: (request: LocationSource, file: TFile) => string;

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
    /** Uploads with a PATCH or DELETE in progress in this process; a concurrent one gets 423 Locked. */
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

        // A final upload takes its length from the partial uploads; every other upload needs one.
        if (uploadConcat?.startsWith("final;")) {
            this.requireExtension("concatenation");

            return this.createFinalUpload(request, metadata, uploadConcat);
        }

        if (uploadLength === undefined && uploadDeferLength === undefined) {
            throw createHttpError(400, "Either upload-length or upload-defer-length must be specified.");
        }

        const deferHeaders: Headers = uploadLength === undefined ? { "Upload-Defer-Length": "1" } : {};

        if (uploadConcat !== undefined) {
            this.requireExtension("concatenation");

            if (uploadConcat !== "partial") {
                throw createHttpError(400, "Invalid Upload-Concat header format");
            }

            return this.createUpload(request, { metadata: { ...metadata, uploadConcat: "partial" }, size: uploadLength }, { ...deferHeaders, "Upload-Concat": "partial" });
        }

        return this.createUpload(request, { metadata, size: uploadLength }, deferHeaders);
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

        if (offsetHeader === undefined) {
            throw createHttpError(412, "Missing Upload-Offset header");
        }

        // TUS core: a PATCH without this Content-Type "SHOULD" get 415, a missing one included.
        if (!TusBase.isOffsetOctetStream(request)) {
            throw createHttpError(415, "Unsupported Media Type");
        }

        // TUS core: Upload-Offset MUST be a non-negative integer.
        if (!isNonNegativeInteger(offsetHeader)) {
            throw createHttpError(400, "Invalid Upload-Offset header");
        }

        return this.withWriteLock(id, async () => this.writeChunk(request, id, Number(offsetHeader)));
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

        await this.storage.checkIfExpired(file);

        const { [WRITE_CLAIM_KEY]: _claim, ...metadata } = file.metadata ?? {};
        const data = file.metadata === undefined ? file : { ...file, metadata };

        // `data` is what both the Node and the fetch responders serialize as the JSON body.
        return {
            ...data,
            data,
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

        // Locked like a PATCH: deleting under an in-flight PATCH would let its write recreate the upload.
        return this.withWriteLock(id, async () => {
            // Only uploads: an id without upload metadata may name an object the route never created.
            // The metadata is read anyway, for the status of the upload.
            const existing = await this.storage.getMeta(id);

            if (existing.status === "completed" && this.config.disableTerminationForFinishedUploads()) {
                throw createHttpError(400, "Termination of finished uploads is disabled");
            }

            const file = await this.storage.delete({ id });

            if (file.status === undefined) {
                throw createHttpError(404, "File not found");
            }

            return { ...file, headers: this.buildHeaders(file) as Record<string, string>, statusCode: 204 };
        });
    }

    /**
     * Runs a write (PATCH or DELETE) while holding the upload, so a second one racing it gets 423
     * instead of passing checks made before either writes.
     * @param id Upload ID
     * @param write The write
     * @returns The write's response
     */
    private async withWriteLock(id: string, write: () => Promise<ResponseFile<TFile>>): Promise<ResponseFile<TFile>> {
        if (this.patchesInFlight.has(id)) {
            throw createHttpError(423, "The upload is locked by another request");
        }

        this.patchesInFlight.add(id);

        try {
            // Other processes sharing the meta store: claimed before the upload is read, so a write
            // racing this one from another process gets 423 too.
            const release = await this.storage.claimWrite?.(id);

            try {
                return await write();
            } finally {
                await release?.();
            }
        } finally {
            this.patchesInFlight.delete(id);
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

        const hasUpload = TusBase.isOffsetOctetStream(request);
        const size = init.size === undefined ? undefined : Number(init.size);

        if (hasUpload) {
            this.assertWithinLength(0, contentLength, size);
        }

        const writesData = hasUpload && contentLength !== undefined && contentLength > 0;
        // Verified like a PATCH, and before the upload exists, so a mismatch leaves nothing behind.
        const { body, native } = writesData ? await this.prepareChecksum(request, contentLength, size) : { body: undefined, native: {} };

        let file = await this.storage.create(init);

        if (writesData) {
            this.assertResumableWrite(file, 0, contentLength, undefined);

            file = await this.storage.write({ ...file, body, ...native, contentLength, start: 0 });
        }

        file = TusBase.holdPartialUpload(file);

        const headers: Headers = { ...this.buildHeaders(file, { Location: this.config.buildFileUrl(request, file) }), ...extraHeaders };

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
            // HEAD MUST echo Upload-Concat "as received in the upload creation request".
            metadata: { ...metadata, partialIds, uploadConcat },
            size: partialFiles.reduce((total, partial) => total + (partial.size as number), 0),
        });

        await this.concatenateFiles(file, partialFiles);

        const headers: Headers = {
            ...this.buildHeaders(file, { Location: this.config.buildFileUrl(request, file) }),
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

        // TUS allows a chunked PATCH body; an adapter that can't stream one of unknown length
        // refuses it before a byte is read rather than buffering it.
        if (contentLength === undefined && this.storage.requiresContentLength) {
            throw createHttpError(411, "Content-Length is required by this storage backend");
        }

        const size = deferredSize ?? current.size;
        const limit = this.assertWithinLength(uploadOffset, contentLength, size);
        const { body, native } = await this.prepareChecksum(request, contentLength, size === undefined ? undefined : size - uploadOffset);
        // Without a Content-Length the body is only known to fit while it streams, and the adapter
        // gets no length: an unknown one must not read as an empty chunk.
        let limiter: StreamLength | undefined;

        if (contentLength === undefined && body instanceof Readable) {
            const bounded = new StreamLength(limit - uploadOffset);

            // It can fail before the adapter attaches its listener, and an unheard 'error' crashes the
            // process; the adapter still sees it through pipeline()/for-await (`errored`).
            bounded.on("error", () => {
                // Reported through the stream's errored state
            });

            // pipe() doesn't pass the body's failure on: a client that disconnects mid-body would leave
            // the adapter waiting forever with the upload claimed. pipeline() would destroy the request
            // on the limiter's own error instead, leaving no socket for the 413.
            finished(body, (error) => {
                if (error) {
                    bounded.destroy(error);
                }
            });
            limiter = body.pipe(bounded);
        }

        const boundedBody = limiter ?? body;

        // The adapter must know the final length when it writes, to finish the upload on its last byte.
        if (deferredSize !== undefined) {
            await this.storage.update({ id }, { size: deferredSize });
        }

        let file: TFile;

        try {
            file = await this.storage.write({ body: boundedBody, ...native, contentLength, id, start: uploadOffset });
        } catch (error: unknown) {
            // A rejected chunk must leave the upload as it was.
            if (deferredSize !== undefined) {
                await this.storage.update({ id }, { size: undefined }).catch(() => undefined);
            }

            // Adapters wrap the limiter's error, so ask the limiter.
            if (isStreamLengthError(limiter?.errored)) {
                throw createHttpError(413, "Chunk exceeds the upload length");
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

    /**
     * Rejects a chunk that would end past the upload's length, or past the server limit while the
     * length is deferred (TUS core: the Server "MUST respond with the 413" over its maximum size).
     * @param offset Offset the chunk starts at
     * @param contentLength Chunk length, when known
     * @param size Upload length, when known
     * @returns The byte the upload may not exceed
     */
    private assertWithinLength(offset: number, contentLength: number | undefined, size: number | undefined): number {
        const limit = typeof size === "number" && !Number.isNaN(size) ? Math.min(size, this.storage.maxUploadSize) : this.storage.maxUploadSize;

        if (contentLength !== undefined && offset + contentLength > limit) {
            throw createHttpError(413, "Chunk exceeds the upload length");
        }

        return limit;
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
     * Whether the request body is TUS upload data. Compares the media type only, so parameters
     * (`; charset=…`) don't turn it into a 415.
     * @param request TUS request
     * @returns `true` for `application/offset+octet-stream`
     */
    private static isOffsetOctetStream(request: TusRequest): boolean {
        return request.header("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/offset+octet-stream";
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
