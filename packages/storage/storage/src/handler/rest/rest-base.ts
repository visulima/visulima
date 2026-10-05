import { Readable } from "node:stream";

import createHttpError from "http-errors";

import { isMetaNotFound } from "../../storage/meta-storage";
import type { BaseStorage } from "../../storage/storage";
import type { FileInit, UploadFile } from "../../storage/utils/file";
import type { ChunkInfo } from "../../utils/chunked-upload";
import {
    getChunkedUploadOffset,
    getChunks,
    getTotalSize,
    isChunkedUpload,
    isChunkedUploadComplete,
    trackChunk,
    validateChunk,
} from "../../utils/chunked-upload";
import { ERRORS, isUploadError } from "../../utils/errors";
import { toLatin1Safe } from "../../utils/headers";
import { retry } from "../../utils/retry";
import type { LocationSource } from "../base/base-handler-core";
import type { ResponseFile, ResponseList } from "../types";
import { verifyChunk } from "../utils/checksum";
import { buildChunkedUploadHeaders, buildFileHeaders, buildFileMetadataHeaders, buildResponseFile } from "../utils/response-builder";

/**
 * Maximum size of a JSON batch-delete body. 1 MiB comfortably holds thousands of ids.
 */
export const MAX_BATCH_DELETE_BYTES = 1_048_576;

/**
 * Ids a client may choose when creating a file via PUT. Dots are excluded so a client-chosen id can
 * never collide with a storage sidecar such as `id.META` (which would overwrite another file's metadata).
 */
const CLIENT_FILE_ID_PATTERN = /^[\w-]{1,255}$/;

/**
 * Validates a list of ids for batch deletion.
 * @param ids Candidate ids
 * @returns The ids
 * @throws {HttpError} 400 when the list is empty or contains a non-string entry
 */
const assertBatchIds = (ids: unknown[]): string[] => {
    if (ids.length === 0) {
        throw createHttpError(400, "No file IDs provided");
    }

    if (!ids.every((id) => typeof id === "string" && id.length > 0)) {
        throw createHttpError(400, "File IDs must be non-empty strings");
    }

    return ids as string[];
};

/**
 * Parses the `?ids=id1,id2` batch-delete query parameter.
 * @param value Raw query parameter value
 * @returns The ids
 * @throws {HttpError} 400 when no id is given
 */
export const parseBatchIdsParameter = (value: string): string[] =>
    assertBatchIds(
        value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
    );

/**
 * Parses a JSON batch-delete body: either `["id1", "id2"]` or `{ "ids": ["id1", "id2"] }`.
 * @param body Raw request body
 * @returns The ids, or `undefined` when the body is not a batch-delete payload (the request is then a single delete)
 * @throws {HttpError} 400 when the payload is a batch-delete shape with no or invalid ids
 */
export const parseBatchDeleteBody = (body: string): string[] | undefined => {
    let parsed: unknown;

    try {
        parsed = JSON.parse(body);
    } catch {
        return undefined;
    }

    if (Array.isArray(parsed)) {
        return assertBatchIds(parsed);
    }

    if (typeof parsed === "object" && parsed !== null && "ids" in parsed && Array.isArray(parsed.ids)) {
        return assertBatchIds(parsed.ids);
    }

    return undefined;
};

/**
 * Drops the file id segment from a request that addresses a single file (PUT/PATCH), so the
 * Location header can be built from the collection URL like it is for POST (`collection/id.ext`).
 * @param request Request (URL absolute on fetch runtimes, path-only on Node)
 * @returns The request, addressing the collection; origin and query string are kept
 */
const toCollection = (request: LocationSource): LocationSource => {
    const url = new URL(request.url, "http://localhost");

    url.pathname = url.pathname.replace(/\/[^/]+\/?$/, "") || "/";

    return { ...request, url: /^https?:\/\//i.test(request.url) ? url.toString() : `${url.pathname}${url.search}` };
};

/**
 * The status a chunked upload has once `chunks` are recorded: "completed" when every byte is
 * stored, and a "completed" the stored bytes don't back up reopened as "part".
 */
const reconcileChunkedStatus = (
    chunks: ChunkInfo[],
    totalSize: number,
    file: Pick<UploadFile, "bytesWritten" | "status">,
    sequentialWrites: boolean,
): UploadFile["status"] => {
    if (isChunkedUploadComplete(chunks, totalSize, file.bytesWritten, sequentialWrites)) {
        return "completed";
    }

    return file.status === "completed" ? "part" : file.status;
};

/**
 * The part of a storage adapter the REST handler uses.
 */
export type RestStorage<TFile extends UploadFile> = Pick<
    BaseStorage<TFile>,
    | "create"
    | "deleteUpload"
    | "deleteUploads"
    | "findStoredObject"
    | "getMeta"
    | "maxUploadSize"
    | "replaceUpload"
    | "sequentialWrites"
    | "update"
    | "withLock"
    | "write"
>;

export interface RestBaseConfig<TFile extends UploadFile> {
    /** Builds the `Location` of a file from the request it was created or written by. */
    buildFileUrl: (request: LocationSource, file: TFile) => string;

    /** The storage adapter. */
    storage: () => RestStorage<TFile>;
}

/**
 * Shared REST API logic for the Node.js and Web (fetch) handlers.
 * Platform-agnostic - contains no Node.js or Web API specific code.
 * @template TFile The file type used by this handler.
 */
class RestBase<TFile extends UploadFile> {
    public constructor(private readonly config: RestBaseConfig<TFile>) {}

    private get storage(): RestStorage<TFile> {
        return this.config.storage();
    }

    /**
     * Handle single file deletion.
     * @param id File ID to delete
     * @returns Promise resolving to ResponseFile with deletion result
     */
    public async deleteSingle(id: string): Promise<ResponseFile<TFile>> {
        const file = await this.storage.deleteUpload(id);

        if (file.status === undefined) {
            throw createHttpError(404, "File not found");
        }

        return { ...file, headers: {}, statusCode: 204 };
    }

    /**
     * Handle file creation (POST).
     * @param config File initialization config
     * @param isChunkedUpload Whether this is a chunked upload initialization
     * @param request Request the Location header is built from
     * @param bodyStream Request body stream (for non-chunked uploads)
     * @param contentLength Content length (for non-chunked uploads)
     * @returns Promise resolving to ResponseFile with upload result
     */
    public async handlePost(
        config: FileInit,
        isChunkedUpload: boolean,
        request: LocationSource,
        bodyStream: Readable | undefined,
        contentLength: number,
    ): Promise<ResponseFile<TFile>> {
        // A chunked upload without X-Total-Size can't be tracked: every PATCH would answer 400.
        if (isChunkedUpload && config.metadata._totalSize === undefined) {
            throw createHttpError(400, "X-Total-Size is required for chunked uploads and must be a non-negative integer");
        }

        // Validate total size for chunked uploads
        if (isChunkedUpload && config.size !== undefined) {
            const size = typeof config.size === "number" ? config.size : Number.parseInt(String(config.size), 10);

            if (size > 0 && size > this.storage.maxUploadSize) {
                throw createHttpError(413, `File size exceeds maximum allowed size of ${this.storage.maxUploadSize} bytes`);
            }
        }

        // Create file in storage
        const file = await this.storage.create(config);

        // For chunked uploads, don't write data yet - just initialize. An empty file gets no PATCH, so
        // its (empty) object is stored now and the upload is complete at once.
        if (isChunkedUpload) {
            if (config.metadata._totalSize === 0) {
                const completedFile = await this.storage.write({ body: Readable.from([]), contentLength: 0, id: file.id, start: 0 });

                return buildResponseFile(
                    completedFile,
                    {
                        ...buildFileHeaders(completedFile, this.config.buildFileUrl(request, completedFile)),
                        ...buildChunkedUploadHeaders(completedFile, true),
                        "X-Upload-ID": completedFile.id,
                    },
                    201,
                );
            }

            const locationUrl = this.config.buildFileUrl(request, file);

            return buildResponseFile(
                file,
                {
                    ...buildFileHeaders(file, locationUrl),
                    "X-Chunked-Upload": "true",
                    "X-Upload-ID": file.id,
                },
                201,
            );
        }

        // Write file data for non-chunked uploads
        const completedFile = await this.storage.write({
            // The runtime handlers hand over an empty stream for an empty body.
            body: bodyStream as Readable,
            contentLength,
            id: file.id,
            start: 0,
        });

        const locationUrl = this.config.buildFileUrl(request, completedFile);

        return buildResponseFile(completedFile, buildFileHeaders(completedFile, locationUrl), 201);
    }

    /**
     * Handle file replacement or creation (PUT).
     * @param id File ID from URL
     * @param config File initialization config (metadata, name, type and size from the request)
     * @param request Request the Location header is built from
     * @param bodyStream Request body stream
     * @param contentLength Content length
     * @returns Promise resolving to ResponseFile with upload result (200 replaced, 201 created)
     * @remarks A replacement is validated first and written aside (see `BaseStorage.replaceUpload`);
     * the old file is only replaced once the new one is complete, so a write failing midway (the
     * body breaking off, the provider failing) leaves it unchanged.
     */
    public async handlePut(id: string, config: FileInit, request: LocationSource, bodyStream: Readable, contentLength: number): Promise<ResponseFile<TFile>> {
        let exists = true;

        try {
            await this.storage.getMeta(id);
        } catch (error: unknown) {
            if (!isMetaNotFound(error)) {
                throw error;
            }

            exists = false;
        }

        const writeTo = async (target: string): Promise<TFile> => this.storage.write({ body: bodyStream, contentLength, id: target, start: 0 });
        let file: TFile;

        if (exists) {
            file = await this.storage.replaceUpload(id, config, writeTo);
        } else {
            if (!CLIENT_FILE_ID_PATTERN.test(id)) {
                throw createHttpError(400, 'File ID may only contain letters, digits, "_" and "-" (max 255 characters)');
            }

            // No metadata means no upload under this id, so an object already stored there was
            // written by other means. Creating would replace it (#919).
            if (await this.storage.findStoredObject(id)) {
                throw createHttpError(409, "A file with this ID already exists");
            }

            // Create the file under the ID from the URL (providers that assign their own IDs may still override it)
            const created = await this.storage.create({ ...config, id });

            file = await writeTo(created.id);
        }

        const locationUrl = this.config.buildFileUrl(toCollection(request), file);

        return buildResponseFile(file, buildFileHeaders(file, locationUrl), exists ? 200 : 201);
    }

    /**
     * Handle chunked upload chunk (PATCH).
     * @param id File ID from URL
     * @param chunkOffset Chunk offset in bytes
     * @param contentLength Chunk content length
     * @param chunkChecksum Optional chunk checksum
     * @param request Request the Location header is built from
     * @param bodyStream Request body stream
     * @returns Promise resolving to ResponseFile with upload progress
     */
    public async handlePatch(
        id: string,
        chunkOffset: number,
        contentLength: number,
        chunkChecksum: string | undefined,
        request: LocationSource,
        bodyStream: Readable,
    ): Promise<ResponseFile<TFile>> {
        // Get file metadata
        let file = await this.storage.getMeta(id);
        const metadata = file.metadata || {};
        const isChunkedUploadFile = isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file);

            if (totalSize !== undefined && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : (file.size ?? 0);

        if (!isChunkedUploadFile) {
            throw createHttpError(400, "File is not a chunked upload. Use POST or PUT for full file uploads.");
        }

        // Validate chunk offset and size (max 100MB per chunk)
        const MAX_CHUNK_SIZE = 100 * 1024 * 1024;

        try {
            validateChunk(chunkOffset, contentLength, totalSize, MAX_CHUNK_SIZE);
        } catch (error) {
            if (error instanceof Error && error.message.includes("exceeds maximum")) {
                throw createHttpError(413, error.message);
            }

            throw createHttpError(400, error instanceof Error ? error.message : String(error));
        }

        // Check if file is already completed. A "completed" status the chunk list doesn't back up
        // is stale: providers mark a file completed once the furthest byte is written, so the last
        // chunk arriving first sets it before earlier chunks exist. Reopen the upload instead of
        // answering "complete" for chunks that were never stored.
        const { sequentialWrites } = this.storage;

        if (file.status === "completed") {
            if (isChunkedUploadComplete(getChunks(file), totalSize, file.bytesWritten, sequentialWrites)) {
                const locationUrl = this.config.buildFileUrl(toCollection(request), file);

                return buildResponseFile(
                    file,
                    {
                        ...buildFileHeaders(file, locationUrl),
                        "X-Upload-Complete": "true",
                    },
                    200,
                );
            }

            await this.storage.update({ id }, { status: "part" });
        }

        // Write the chunk first and record it in `_chunks` only once the provider has stored it.
        // Completion is derived from that list, so recording a chunk the provider then refuses
        // (conflict, transient error, sequential-only provider) would let a later PATCH report the
        // upload complete with bytes missing from storage.
        const written = await this.storage.write({
            // Checked for truthiness: the Node handler reads a missing X-Chunk-Checksum as "".
            body: chunkChecksum ? await verifyChunk(bodyStream, contentLength, chunkChecksum) : bodyStream,
            contentLength,
            id,
            start: chunkOffset,
        });

        // An adapter that only appends finished the upload with this chunk; its "completed" is
        // final, and it may have dropped the upload's metadata already (S3 deletes it on
        // completion), so there may be nothing left to record the chunk in (#908). Where the
        // metadata outlives completion, record the chunk anyway, so `X-Received-Chunks` agrees
        // with `X-Upload-Complete` and a resuming client doesn't re-send it (#913).
        if (sequentialWrites && written.status === "completed") {
            let completedChunks = getChunks(written);

            try {
                completedChunks = await this.storage.withLock(`chunks:${id}`, async () => {
                    const current = await this.storage.getMeta(id);
                    const merged = trackChunk(getChunks(current), { length: contentLength, offset: chunkOffset });

                    await this.storage.update({ id }, { metadata: { ...current.metadata, _chunks: merged } });

                    return merged;
                });
            } catch {
                // Best effort: the bytes are stored and the upload is final; metadata the adapter
                // already deleted, or a lock held by a concurrent request, must not fail it.
            }

            const completedFile: TFile = { ...written, bytesWritten: totalSize, metadata: { ...written.metadata, _chunks: completedChunks } };

            return buildResponseFile(
                completedFile,
                {
                    ...buildFileHeaders(completedFile, this.config.buildFileUrl(toCollection(request), completedFile)),
                    ...buildChunkedUploadHeaders(completedFile, true),
                    "x-upload-offset": String(totalSize),
                },
                200,
            );
        }

        // The read-modify-write of `_chunks` must be serialized: two concurrent PATCHes for the same
        // file would otherwise each read the same `existingChunks`, append their own entry, and the
        // second write would overwrite the first — silently losing a chunk record. A distinct
        // `chunks:` namespace avoids conflict with the adapter's internal write lock keyed on the file id.
        // The lock fails fast when held, so retry briefly: the chunk is already stored and must be recorded.
        // The stored status is reconciled with the chunk list under the same lock: each provider
        // write sets it from its own view of the bytes, so concurrent PATCHes would otherwise leave
        // "part" behind on a finished upload (#902), or "completed" on an unfinished one.
        // The adapter confirms how much it persisted, which can be less than the request carried: a
        // GCS resumable upload may keep a shorter range, and a chunk whose body broke off stores only
        // what arrived (disk). Record only that.
        const confirmedLength =
            typeof written.bytesWritten === "number" && Number.isFinite(written.bytesWritten)
                ? Math.min(contentLength, Math.max(0, written.bytesWritten - chunkOffset))
                : contentLength;

        let bytesWritten: number | undefined;
        let chunks: ChunkInfo[];
        let status: UploadFile["status"];

        try {
            ({ bytesWritten, chunks, status } = await retry(
                async () =>
                    this.storage.withLock(`chunks:${id}`, async () => {
                        const current = await this.storage.getMeta(id);
                        const merged =
                            confirmedLength > 0 ? trackChunk(getChunks(current), { length: confirmedLength, offset: chunkOffset }) : getChunks(current);
                        const saved = await this.storage.update(
                            { id },
                            {
                                metadata: { ...current.metadata, _chunks: merged },
                                status: reconcileChunkedStatus(merged, totalSize, current, sequentialWrites),
                            },
                        );
                        // The save may have merged in chunks another process recorded meanwhile.
                        const savedChunks = getChunks(saved);

                        return {
                            bytesWritten: saved.bytesWritten,
                            chunks: savedChunks,
                            status: reconcileChunkedStatus(savedChunks, totalSize, { ...saved, status: current.status }, sequentialWrites),
                        };
                    }),
                {
                    initialDelay: 10,
                    maxDelay: 200,
                    maxRetries: 8,
                    shouldRetry: (error) => isUploadError(error) && error.UploadErrorCode === ERRORS.FILE_LOCKED,
                },
            ));
        } catch (error) {
            // Don't leave a "completed" status set by the write behind for an unrecorded chunk.
            if (written.status === "completed") {
                await this.storage.update({ id }, { status: "part" });
            }

            throw error;
        }

        const isComplete = status === "completed";
        const updatedFile: TFile = { ...written, metadata: { ...written.metadata, _chunks: chunks }, status };

        // For completed uploads, ensure bytesWritten equals totalSize
        const finalFile = isComplete && updatedFile.bytesWritten !== totalSize ? { ...updatedFile, bytesWritten: totalSize } : updatedFile;

        const locationUrl = this.config.buildFileUrl(toCollection(request), finalFile);
        const headers = {
            ...buildFileHeaders(finalFile, locationUrl),
            ...buildChunkedUploadHeaders(finalFile, isComplete),
            "x-upload-offset": String(isComplete ? totalSize : getChunkedUploadOffset(chunks, bytesWritten ?? written.bytesWritten, sequentialWrites)),
        };

        return buildResponseFile(finalFile, headers, isComplete ? 200 : 202);
    }

    /**
     * Handle file metadata retrieval (HEAD).
     * @param id File ID from URL
     * @returns Promise resolving to ResponseFile with metadata headers
     */
    public async handleHead(id: string): Promise<ResponseFile<TFile>> {
        // Answer from the upload's metadata only. Providers that drop it on completion (S3) answer
        // 404 for a finished upload: the stored object under the same key can't be told apart from
        // one the route never created, and describing it would disclose any object in the bucket (#918).
        let file = await this.storage.getMeta(id);

        const isChunkedUploadFile = isChunkedUpload(file);

        // For chunked uploads, ensure file.size is set to total size
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file);

            if (totalSize !== undefined && file.size !== totalSize) {
                file = { ...file, size: totalSize };
            }
        }

        const headers: Record<string, string | number> = {
            ...buildFileMetadataHeaders(file),
        };

        // Add chunked upload progress headers. The offset to resume from and completion come
        // from the same source, so a client resuming at the offset can finish the upload (#909).
        if (isChunkedUploadFile) {
            const totalSize = getTotalSize(file) ?? file.size ?? 0;
            const { sequentialWrites } = this.storage;
            const chunks = getChunks(file);
            const isComplete = isChunkedUploadComplete(chunks, totalSize, file.bytesWritten, sequentialWrites);

            Object.assign(headers, buildChunkedUploadHeaders(file, isComplete), {
                "x-upload-offset": String(isComplete ? totalSize : getChunkedUploadOffset(chunks, file.bytesWritten, sequentialWrites)),
            });
        }

        return buildResponseFile(file, headers, 200);
    }

    /**
     * Handle OPTIONS request with REST API capabilities.
     * @param methods Array of supported HTTP methods
     * @param maxUploadSize Maximum upload size
     * @returns ResponseFile with CORS headers
     */
    // eslint-disable-next-line class-methods-use-this
    public handleOptions(methods: string[], maxUploadSize: number): ResponseFile<TFile> {
        const headers = {
            "Access-Control-Allow-Headers":
                "Authorization, Content-Type, Content-Length, Content-Disposition, X-File-Metadata, X-Chunked-Upload, X-Total-Size, X-Chunk-Offset, X-Chunk-Checksum",
            "Access-Control-Allow-Methods": methods.map((method) => method.toUpperCase()).join(", "),
            "Access-Control-Max-Age": 86_400,
            "X-Max-Upload-Size": String(maxUploadSize),
        };

        return {
            headers,
            statusCode: 204,
        } as unknown as ResponseFile<TFile>;
    }

    /**
     * Handle batch file deletion.
     * @param ids Array of file IDs to delete
     * @returns Promise resolving to ResponseList with deletion results
     */
    public async deleteBatch(ids: string[]): Promise<ResponseList<TFile>> {
        // Only uploads, as for a single delete: ids without upload metadata fail as not found.
        const result = await this.storage.deleteUploads(ids);

        // If all deletions failed, return error
        if (result.successfulCount === 0 && result.failedCount > 0) {
            const failedIds = result.failed.map((errorItem) => errorItem.id).join(", ");

            throw createHttpError(404, `Failed to delete files: ${failedIds}`);
        }

        // Partial success answers 207 Multi-Status with the deleted files.
        if (result.failedCount > 0) {
            return {
                body: JSON.stringify(result.successful),
                data: result.successful,
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    // Header values must be Latin-1: escape the rest, the value stays valid JSON.
                    "X-Delete-Errors": toLatin1Safe(
                        JSON.stringify(result.failed),
                        (unit) => String.raw`\u${(unit.codePointAt(0) ?? 0).toString(16).padStart(4, "0")}`,
                    ),
                    "X-Delete-Failed": String(result.failedCount),
                    "X-Delete-Successful": String(result.successfulCount),
                },
                statusCode: 207,
            };
        }

        return { data: result.successful, headers: { "X-Delete-Successful": String(result.successfulCount) }, statusCode: 204 };
    }
}

export default RestBase;
