import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { dirname } from "@visulima/path";

import type { CasDigest } from "../backends/types";
import { uniqueId } from "../utils";
import { digestFile } from "./digest";
import { casBlobPath, tmpDirectory } from "./paths";

/**
 * Returns `true` if the CAS blob already exists on disk for the given
 * digest. Caller uses this for `FindMissingBlobs`-style elision and to
 * avoid re-uploading bytes the local cache already holds.
 */
export const containsBlob = async (root: string, digest: CasDigest): Promise<boolean> => {
    try {
        const stats = await stat(casBlobPath(root, digest.hash));

        return stats.isFile() && stats.size === digest.sizeBytes;
    } catch {
        return false;
    }
};

/**
 * Stream a CAS blob from a source path into the store. The blob is
 * staged under `v2/tmp/` and renamed into `v2/cas/&lt;aa>/&lt;digest>` after
 * the bytes land. Idempotent: a concurrent writer racing on the same
 * digest results in two POSIX renames over byte-identical content,
 * which is atomic per POSIX. On Windows we treat `EEXIST` as success.
 *
 * `digest.hash` is trusted — the caller is responsible for computing
 * the sha256 of the source file first. Re-hashing here would double
 * the IO on every put.
 */
export const putBlobFromFile = async (root: string, digest: CasDigest, sourcePath: string): Promise<void> => {
    const finalPath = casBlobPath(root, digest.hash);

    if (await containsBlob(root, digest)) {
        await touchBlob(root, digest).catch(() => {});

        return;
    }

    const stagingPath = await stageBlob(root, sourcePath);

    try {
        await mkdir(dirname(finalPath), { recursive: true });
        await rename(stagingPath, finalPath);
    } catch (error) {
        await rm(stagingPath, { force: true }).catch(() => {});

        if (!isAlreadyExistsError(error)) {
            throw error;
        }
    }
};

/**
 * Same as {@link putBlobFromFile} but for in-memory bytes. Used for
 * tiny payloads (the AC entry's stdout digest, tree protos) where
 * streaming would be more code than it's worth.
 */
export const putBlobFromBytes = async (root: string, digest: CasDigest, bytes: Buffer): Promise<void> => {
    const finalPath = casBlobPath(root, digest.hash);

    if (await containsBlob(root, digest)) {
        await touchBlob(root, digest).catch(() => {});

        return;
    }

    const tmpDirectoryPath = tmpDirectory(root);
    const stagingPath = `${tmpDirectoryPath}/${uniqueId()}`;

    await mkdir(tmpDirectoryPath, { recursive: true });
    await writeFile(stagingPath, bytes);

    try {
        await mkdir(dirname(finalPath), { recursive: true });
        await rename(stagingPath, finalPath);
    } catch (error) {
        await rm(stagingPath, { force: true }).catch(() => {});

        if (!isAlreadyExistsError(error)) {
            throw error;
        }
    }
};

/**
 * Materialize a CAS blob to a destination path. Streams; safe for
 * large outputs. Returns `false` if the blob isn't in the local store.
 */
export const fetchBlobToFile = async (root: string, digest: CasDigest, destinationPath: string): Promise<boolean> => {
    const sourcePath = casBlobPath(root, digest.hash);

    try {
        await stat(sourcePath);
    } catch {
        return false;
    }

    await mkdir(dirname(destinationPath), { recursive: true });
    await pipeline(createReadStream(sourcePath), createWriteStream(destinationPath));
    await touchBlob(root, digest).catch(() => {});

    return true;
};

/**
 * Verify a blob's bytes match its expected digest. Used during legacy
 * → v2 migration where we trust nothing — sha256 every staged file
 * before the rename so a bit-flipped legacy artifact doesn't poison
 * the new CAS.
 */
export const verifyBlob = async (filePath: string, expected: CasDigest): Promise<boolean> => {
    const computed = await digestFile(filePath);

    return computed?.hash === expected.hash && computed.sizeBytes === expected.sizeBytes;
};

/**
 * Bump mtime/atime on a blob. Drives mark-and-sweep GC: the sweeper
 * evicts blobs whose mtime is older than `maxCacheAge` AND not
 * referenced by any AC entry. Touching on hit means LRU tracks real
 * usage rather than write-time.
 */
export const touchBlob = async (root: string, digest: CasDigest): Promise<void> => {
    const now = new Date();

    await utimes(casBlobPath(root, digest.hash), now, now);
};

const stageBlob = async (root: string, sourcePath: string): Promise<string> => {
    const tmpDirectoryPath = tmpDirectory(root);
    const stagingPath = `${tmpDirectoryPath}/${uniqueId()}`;

    await mkdir(tmpDirectoryPath, { recursive: true });
    await pipeline(createReadStream(sourcePath), createWriteStream(stagingPath));

    return stagingPath;
};

const isAlreadyExistsError = (error: unknown): boolean => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const { code } = (error as { code?: string });

    return code === "EEXIST" || code === "ENOTEMPTY";
};
