import type { UploadFile } from "../storage/utils/file";

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

    if (!firstChunk || firstChunk.offset !== 0) {
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
 * Calculates upload progress based on chunks.
 * @param chunks Array of chunk information objects
 * @param totalSize Total expected file size in bytes
 * @returns Object with bytesWritten and completion percentage
 */
export const calculateUploadProgress = (
    chunks: ChunkInfo[],
    totalSize: number,
): {
    bytesWritten: number;
    percentage: number;
} => {
    if (chunks.length === 0 || totalSize === 0) {
        return { bytesWritten: 0, percentage: 0 };
    }

    // Sort by offset
    const sorted = [...chunks].toSorted((a, b) => a.offset - b.offset);

    let bytesWritten = 0;
    let currentEnd = 0;

    for (const chunk of sorted) {
        const chunkEnd = chunk.offset + chunk.length;

        if (chunk.offset <= currentEnd) {
            // Overlapping or adjacent chunk - extend coverage
            bytesWritten = Math.max(bytesWritten, chunkEnd);
        } else {
            // Gap found - add this chunk's contribution
            bytesWritten += chunk.length;
        }

        currentEnd = Math.max(currentEnd, chunkEnd);
    }

    // Cap at total size
    bytesWritten = Math.min(bytesWritten, totalSize);
    const percentage = totalSize > 0 ? (bytesWritten / totalSize) * 100 : 0;

    return { bytesWritten, percentage };
};

/**
 * Gets the total bytes written based on file metadata.
 * For chunked uploads, uses bytesWritten from file or calculates from chunks.
 * @param file The file object
 * @returns Total bytes written
 */
export const getBytesWritten = <TFile extends UploadFile>(file: TFile): number => {
    const metadata = file.metadata || {};
    // eslint-disable-next-line no-underscore-dangle
    const isChunkedUpload = metadata._chunkedUpload === true;

    // eslint-disable-next-line no-underscore-dangle
    if (isChunkedUpload && Array.isArray(metadata._chunks)) {
        // eslint-disable-next-line no-underscore-dangle
        const totalSize = typeof metadata._totalSize === "number" ? metadata._totalSize : file.size || 0;
        // eslint-disable-next-line no-underscore-dangle
        const progress = calculateUploadProgress(metadata._chunks as ChunkInfo[], totalSize);

        return progress.bytesWritten;
    }

    return file.bytesWritten || 0;
};

/**
 * Checks if a file is a chunked upload based on metadata.
 * @param file The file object
 * @returns True if file is a chunked upload
 */
export const isChunkedUpload = <TFile extends UploadFile>(file: TFile): boolean => {
    const metadata = file.metadata || {};

    // eslint-disable-next-line no-underscore-dangle
    return metadata._chunkedUpload === true;
};

/**
 * Gets the total size for a chunked upload.
 * @param file The file object
 * @returns Total size or undefined if not a chunked upload
 */
export const getTotalSize = <TFile extends UploadFile>(file: TFile): number | undefined => {
    const metadata = file.metadata || {};
    // eslint-disable-next-line no-underscore-dangle
    const isChunkedUploadFile = metadata._chunkedUpload === true;

    // eslint-disable-next-line no-underscore-dangle
    if (isChunkedUploadFile && typeof metadata._totalSize === "number") {
        // eslint-disable-next-line no-underscore-dangle
        return metadata._totalSize;
    }

    return undefined;
};
