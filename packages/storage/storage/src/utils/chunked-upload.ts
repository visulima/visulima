import type { File, UploadFile } from "../storage/utils/file";

/**
 * A byte range of a chunked upload that the storage holds.
 */
export interface ChunkInfo {
    /** Length of the range in bytes */
    length: number;
    /** Byte offset where the range starts */
    offset: number;
}

/**
 * Merges ranges into the fewest that cover the same bytes: sorted by offset, overlapping or
 * adjacent ones joined.
 *
 * The list is stored in the upload's metadata and sent back in `X-Received-Chunks`, and object
 * metadata is small (S3 allows 2 KiB, Azure and R2 8 KiB). One entry per chunk would outgrow it
 * after a few dozen chunks and fail the save. Readers normalise too: a record saved before ranges
 * were merged still lists one entry per chunk.
 * @param chunks Ranges in any order
 * @returns The merged ranges
 */
export const normalizeRanges = (chunks: ChunkInfo[]): ChunkInfo[] => {
    const merged: ChunkInfo[] = [];

    for (const { length, offset } of chunks.toSorted((a, b) => a.offset - b.offset)) {
        const last = merged.at(-1);

        if (last === undefined || offset > last.offset + last.length) {
            merged.push({ length, offset });
        } else if (offset + length > last.offset + last.length) {
            merged[merged.length - 1] = { length: offset + length - last.offset, offset: last.offset };
        }
    }

    return merged;
};

/**
 * End of the stored prefix of a chunked upload as its recorded chunks show it: the first byte not
 * covered by ranges starting at offset 0.
 * @param chunks Recorded chunks
 * @returns Byte offset to resume from
 */
export const getContiguousEnd = (chunks: ChunkInfo[]): number => {
    const [first] = normalizeRanges(chunks);

    return first?.offset === 0 ? first.length : 0;
};

/**
 * Whether the recorded chunks cover the whole upload, from offset 0 without a gap.
 * @param chunks Recorded chunks
 * @param totalSize Total expected file size in bytes
 * @returns True if upload is complete, false otherwise
 */
export const isUploadComplete = (chunks: ChunkInfo[], totalSize: number): boolean => {
    const [first] = normalizeRanges(chunks);

    return first?.offset === 0 && first.length >= totalSize;
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
 * Records a chunk (idempotent): the ranges with it merged in, see {@link normalizeRanges}.
 * @param chunks Existing chunks array
 * @param chunkInfo New chunk information to track
 * @returns The merged ranges
 */
export const trackChunk = (chunks: ChunkInfo[], chunkInfo: ChunkInfo): ChunkInfo[] => normalizeRanges([...chunks, chunkInfo]);

/**
 * Combines two recorded chunk lists (idempotent and commutative), see {@link normalizeRanges}.
 * @param chunks Chunks array to extend
 * @param other Chunks to merge in
 * @returns The merged ranges
 */
export const mergeChunks = (chunks: ChunkInfo[], other: ChunkInfo[]): ChunkInfo[] => normalizeRanges([...chunks, ...other]);

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
