import type { File, UploadFile } from "../storage/utils/file";

/**
 * Chunk information structure for tracking uploaded chunks.
 */
export interface ChunkInfo {
    /** Optional checksum for validation */
    checksum?: string;
    /** Length of chunk in bytes */
    length: number;
    /** Byte offset where chunk starts */
    offset: number;
}

/**
 * Checks if upload is complete based on chunks coverage.
 * Verifies that all chunks form a continuous sequence covering the total file size.
 * @param chunks Array of chunk information objects
 * @param totalSize Total expected file size in bytes
 * @returns True if upload is complete, false otherwise
 */
export const isUploadComplete = (chunks: ChunkInfo[], totalSize: number): boolean => {
    if (chunks.length === 0) {
        return false;
    }

    // Sort by offset
    const sorted = [...chunks].toSorted((a, b) => a.offset - b.offset);

    // First chunk must start at offset 0
    const firstChunk = sorted[0];

    if (firstChunk?.offset !== 0) {
        return false;
    }

    let currentEnd = firstChunk.length;

    for (let i = 1; i < sorted.length; i += 1) {
        const chunk = sorted[i];

        if (!chunk) {
            continue;
        }

        // If gap exists, upload is not complete
        if (chunk.offset > currentEnd) {
            return false;
        }

        // Extend currentEnd to cover overlapping or adjacent chunks
        currentEnd = Math.max(currentEnd, chunk.offset + chunk.length);
    }

    return currentEnd >= totalSize;
};

/**
 * Validates a chunk against file constraints.
 * @param chunkOffset Byte offset where chunk starts
 * @param chunkLength Length of chunk in bytes
 * @param totalSize Total file size in bytes
 * @param maxChunkSize Maximum allowed chunk size (optional)
 * @throws {Error} If validation fails
 */
export const validateChunk = (chunkOffset: number, chunkLength: number, totalSize: number, maxChunkSize?: number): void => {
    if (Number.isNaN(chunkOffset) || chunkOffset < 0) {
        throw new Error("Chunk offset must be a valid non-negative number");
    }

    if (chunkLength <= 0) {
        throw new Error("Chunk length must be greater than 0");
    }

    if (maxChunkSize !== undefined && chunkLength > maxChunkSize) {
        throw new Error(`Chunk size exceeds maximum allowed size of ${maxChunkSize} bytes`);
    }

    if (chunkOffset + chunkLength > totalSize) {
        throw new Error(`Chunk exceeds file size. Offset: ${chunkOffset}, Size: ${chunkLength}, Total: ${totalSize}`);
    }
};

/**
 * Tracks a chunk in the metadata chunks array (idempotent).
 * @param chunks Existing chunks array
 * @param chunkInfo New chunk information to track
 * @returns Updated chunks array
 */
export const trackChunk = (chunks: ChunkInfo[], chunkInfo: ChunkInfo): ChunkInfo[] => {
    // Check if this chunk was already uploaded (idempotency)
    const existingChunk = chunks.find((chunk) => chunk.offset === chunkInfo.offset && chunk.length === chunkInfo.length);

    if (!existingChunk) {
        return [...chunks, chunkInfo];
    }

    // Update checksum if provided
    if (chunkInfo.checksum && existingChunk.checksum !== chunkInfo.checksum) {
        return chunks.map((chunk) => (chunk.offset === chunkInfo.offset ? { ...chunk, checksum: chunkInfo.checksum } : chunk));
    }

    return chunks;
};

/**
 * Adds the chunks of `other` to `chunks` with {@link trackChunk}'s idempotency rules.
 * @param chunks Chunks array to extend
 * @param other Chunks to merge in
 * @returns Merged chunks array
 */
export const mergeChunks = (chunks: ChunkInfo[], other: ChunkInfo[]): ChunkInfo[] => {
    let merged = chunks;

    for (const chunk of other) {
        merged = trackChunk(merged, chunk);
    }

    return merged;
};

/**
 * Reads the chunks recorded for a chunked upload.
 * @param file The file object
 * @returns The recorded chunks
 */
export const getChunks = (file: UploadFile): ChunkInfo[] => (Array.isArray(file.metadata?._chunks) ? (file.metadata._chunks as ChunkInfo[]) : []);

/**
 * Metadata to update a chunked upload with: a `_chunks` list from an earlier read gets the chunks
 * recorded since merged in, so an update never drops one another request recorded (lost update).
 * @param metadata Incoming metadata
 * @param stored The record as stored now
 * @returns The metadata to save
 */
export const withRecordedChunks = (metadata: Record<string, unknown>, stored: UploadFile): Record<string, unknown> =>
    Array.isArray(metadata._chunks) && Array.isArray(stored.metadata?._chunks)
        ? { ...metadata, _chunks: mergeChunks(getChunks(stored), metadata._chunks as ChunkInfo[]) }
        : metadata;

/**
 * Whether a chunked upload record has no progress yet (as created by a POST).
 * @param file The file object
 * @returns True if no chunk is recorded and nothing written
 */
export const isFreshChunkedRecord = (file: UploadFile): boolean => getChunks(file).length === 0 && !file.bytesWritten;

/**
 * End of the stored prefix of a chunked upload as its recorded chunks show it: the first byte not
 * covered by chunks starting at offset 0.
 * @param chunks Recorded chunks
 * @returns Byte offset to resume from
 */
export const getContiguousEnd = (chunks: ChunkInfo[]): number => {
    let end = 0;

    for (const chunk of [...chunks].toSorted((a, b) => a.offset - b.offset)) {
        if (chunk.offset > end) {
            break;
        }

        end = Math.max(end, chunk.offset + chunk.length);
    }

    return end;
};

/**
 * Whether a chunked upload holds every byte. For an adapter that only appends
 * ({@link BaseStorage.sequentialWrites}) its stored prefix decides: it confirms what was
 * persisted, which can be less than a request sent (a GCS resumable upload may keep a shorter
 * range), and it also covers a chunk whose request broke off after some bytes were stored (#909).
 * Otherwise the recorded chunks have to cover the file.
 * @param chunks Recorded chunks
 * @param totalSize Total size of the upload
 * @param bytesWritten The adapter's `bytesWritten`
 * @param sequentialWrites Whether the adapter only appends
 * @returns True if every byte is stored
 */
export const isChunkedUploadComplete = (chunks: ChunkInfo[], totalSize: number, bytesWritten: number | undefined, sequentialWrites: boolean): boolean => {
    if (sequentialWrites && typeof bytesWritten === "number" && Number.isFinite(bytesWritten)) {
        return totalSize > 0 && bytesWritten >= totalSize;
    }

    return isUploadComplete(chunks, totalSize);
};

/**
 * Byte offset a client should resume a chunked upload from. An adapter that only appends knows
 * its stored prefix; for one that writes at any offset `bytesWritten` is only the furthest byte
 * written, so the recorded chunks decide (#909): a broken-off chunk is sent again from its start.
 * @param chunks Recorded chunks
 * @param bytesWritten The adapter's `bytesWritten`
 * @param sequentialWrites Whether the adapter only appends
 * @returns Byte offset to resume from
 */
export const getChunkedUploadOffset = (chunks: ChunkInfo[], bytesWritten: number | undefined, sequentialWrites: boolean): number =>
    sequentialWrites ? Math.max(bytesWritten ?? 0, 0) : getContiguousEnd(chunks);

/**
 * Merges the progress of the stored record of a chunked upload into `file`, a copy that may be
 * stale: the recorded chunks are combined, the larger `bytesWritten` kept (chunks land at their
 * offsets, so an earlier write can carry a smaller extent), and the status set from the chunks.
 * @param file The record about to be saved; updated in place
 * @param stored The record currently stored
 * @param sequentialWrites Whether the adapter only appends ({@link isChunkedUploadComplete})
 */
export const mergeChunkedProgress = (file: File, stored: File, sequentialWrites = false): void => {
    // Stored first, so a checksum the incoming record carries for the same chunk wins, and one
    // it lacks is kept from the stored record.
    const chunks = mergeChunks(getChunks(stored), getChunks(file));

    file.metadata = { ...file.metadata, _chunks: chunks };

    if (typeof stored.bytesWritten === "number" && stored.bytesWritten > (file.bytesWritten || 0)) {
        file.bytesWritten = stored.bytesWritten;
    }

    const totalSize = typeof file.metadata._totalSize === "number" ? file.metadata._totalSize : file.size;

    if (typeof totalSize === "number" && isChunkedUploadComplete(chunks, totalSize, file.bytesWritten, sequentialWrites)) {
        file.status = "completed";
    } else if (file.status === "completed") {
        file.status = "part";
    }
};

/**
 * Checks if a file is a chunked upload based on metadata.
 * @param file The file object
 * @returns True if file is a chunked upload
 */
export const isChunkedUpload = <TFile extends UploadFile>(file: TFile): boolean => {
    const metadata = file.metadata || {};

    return metadata._chunkedUpload === true;
};

/**
 * Gets the total size for a chunked upload.
 * @param file The file object
 * @returns Total size or undefined if not a chunked upload
 */
export const getTotalSize = <TFile extends UploadFile>(file: TFile): number | undefined => {
    const metadata = file.metadata || {};

    const isChunkedUploadFile = metadata._chunkedUpload === true;

    if (isChunkedUploadFile && typeof metadata._totalSize === "number") {
        return metadata._totalSize;
    }

    return undefined;
};
