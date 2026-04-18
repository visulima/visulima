import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { constants as zlibConstants, createBrotliCompress, createBrotliDecompress } from "node:zlib";

/**
 * Shared tar + brotli archive helpers.
 *
 * Both the local cache (`cache.ts`) and remote cache (`remote-cache.ts`)
 * archive file trees into compressed tarballs. This module consolidates
 * the compression parameters and stream plumbing so both paths stay in
 * sync — same brotli quality, same error-handling shape, one place to
 * audit.
 */

/**
 * Brotli quality 4 hits a sweet spot for cache tarballs: ~15–20% smaller
 * than gzip on typical source/dist payloads at comparable throughput.
 * Higher qualities (8+) reach diminishing returns and noticeably slow
 * down cache writes; lower qualities (1–3) give up ratio for speed we
 * don't need on IO-bound workloads.
 */
export const BROTLI_COMPRESS_OPTIONS: { params: Record<number, number> } = {
    params: {
        [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
        [zlibConstants.BROTLI_PARAM_QUALITY]: 4,
    },
};

/** Plain tar: `sourceDir` → `outputPath`, no compression. */
export const createTar = (sourceDirectory: string, outputPath: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-cf", outputPath, "-C", sourceDirectory, "."], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

/** Plain tar extract into `destinationDirectory`. */
export const extractTar = (archivePath: string, destinationDirectory: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-xf", archivePath, "-C", destinationDirectory], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

/** tar + gzip (`-czf`). Used when Turborepo-protocol compatibility matters. */
export const createTarGz = (sourceDirectory: string, outputPath: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-czf", outputPath, "-C", sourceDirectory, "."], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

export const extractTarGz = (archivePath: string, destinationDirectory: string): Promise<void> =>
    new Promise((resolve, reject) => {
        execFile("tar", ["-xzf", archivePath, "-C", destinationDirectory], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });

/**
 * Creates an uncompressed tar, then streams it through brotli into
 * `outputPath`. Two-step (tar-to-temp, brotli-stream) to avoid
 * shelling out to an external `brotli` binary that may not exist.
 * Cleans up the intermediate tar even when compression fails.
 */
export const createTarBrotli = async (sourceDirectory: string, outputPath: string): Promise<void> => {
    const tarPath = `${outputPath}.tar`;

    try {
        await createTar(sourceDirectory, tarPath);
        await pipeline(createReadStream(tarPath), createBrotliCompress(BROTLI_COMPRESS_OPTIONS), createWriteStream(outputPath));
    } finally {
        await rm(tarPath, { force: true }).catch(() => {});
    }
};

/**
 * Inverse of {@link createTarBrotli}: decompresses into a temp tar,
 * then extracts. Temp is cleaned in `finally`.
 */
export const extractTarBrotli = async (archivePath: string, destinationDirectory: string): Promise<void> => {
    const tarPath = `${archivePath}.tar`;

    try {
        await pipeline(createReadStream(archivePath), createBrotliDecompress(), createWriteStream(tarPath));
        await extractTar(tarPath, destinationDirectory);
    } finally {
        await rm(tarPath, { force: true }).catch(() => {});
    }
};
