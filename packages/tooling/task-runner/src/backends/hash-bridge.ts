import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";

import { join } from "@visulima/path";

import { createTarGz, extractTarGz } from "../archive";
import type { ActionResult, BlobSource, CasDigest, RemoteCacheBackend } from "./types";

/**
 * The orchestrator stores cache entries as `{cacheDir}/{taskHash}/...`
 * — a Turborepo-shaped layout with `code`, `terminalOutput`,
 * `fingerprint.json`, `outputs/`, `.commit`. The wire-level backends
 * speak action-digest-keyed CAS semantics. This module bridges the two:
 *
 * - {@link storeByTaskHash} packs the local entry directory into a
 *   single tarball and uploads it as one CAS blob via
 *   {@link RemoteCacheBackend.storeAction}.
 * - {@link retrieveByTaskHash} downloads the blob via
 *   {@link RemoteCacheBackend.retrieveAction} +
 *   {@link RemoteCacheBackend.fetchBlob}, then extracts it back into
 *   `{cacheDir}/{taskHash}/`.
 * - {@link containsByTaskHash} delegates to
 *   {@link RemoteCacheBackend.containsAction}.
 *
 * The action digest is derived deterministically from the task hash
 * via sha256, so every vis client computes the same digest for the
 * same task and gets a hit on the same wire entry.
 */

/** Path used inside the synthesized {@link ActionResult} for the single-tarball blob. */
const TARBALL_OUTPUT_PATH = "vis-entry.tar.gz";

/**
 * Derive a stable {@link CasDigest} from the orchestrator's task hash
 * (xxh3-128, 32 hex chars). REAPI servers reject non-sha256 digests on
 * the wire, so we sha256 a namespaced key. The HTTP backend uses the
 * resulting digest as the artifact URL component.
 *
 * `sizeBytes` is set to `0` because this digest identifies an *action*
 * (an `ActionResult` keyed in the AC), not a stored CAS blob. REAPI
 * `Digest` size_bytes only carries meaning for blobs in the CAS — for
 * action keys it's ignored by the server. Setting it to the byte
 * length of the prehash key would be semantically wrong: the server
 * would believe a blob of that exact length exists at this hash, and
 * a downstream `BatchReadBlobs` against this digest would mismatch.
 */
export const actionDigestForTaskHash = (taskHash: string): CasDigest => {
    const key = `vis-task:${taskHash}`;

    return {
        hash: createHash("sha256").update(Buffer.from(key, "utf8")).digest("hex"),
        sizeBytes: 0,
    };
};

/**
 * Probe whether a cached entry exists on the remote backend, keyed by
 * the orchestrator's task hash. Resolves `false` on any wire failure —
 * the orchestrator treats existence checks as best-effort.
 */
export const containsByTaskHash = async (backend: RemoteCacheBackend, taskHash: string): Promise<boolean> => {
    try {
        return await backend.containsAction(actionDigestForTaskHash(taskHash));
    } catch {
        return false;
    }
};

/**
 * Download the cached entry for `taskHash` and extract it into
 * `{localCacheDirectory}/{taskHash}/`. Returns `true` only when the
 * directory has been fully populated; partial-extract failures clean
 * up after themselves so the local cache never observes a half-populated
 * entry.
 */
export const retrieveByTaskHash = async (backend: RemoteCacheBackend, taskHash: string, localCacheDirectory: string): Promise<boolean> => {
    const action = await backend.retrieveAction(actionDigestForTaskHash(taskHash));

    if (action === null || action.outputFiles.length === 0) {
        return false;
    }

    const tarballEntry = action.outputFiles[0];

    if (!tarballEntry) {
        return false;
    }

    const entryDirectory = join(localCacheDirectory, taskHash);
    const archivePath = join(localCacheDirectory, `.download-${taskHash}-${randomUUID()}.tar.gz`);
    const stagingDirectory = join(localCacheDirectory, `.extract-${taskHash}-${randomUUID()}`);

    try {
        await mkdir(localCacheDirectory, { recursive: true });

        const fetched = await backend.fetchBlob(tarballEntry.digest, archivePath);

        if (!fetched) {
            return false;
        }

        // Extract into a private staging directory first, then swap it into
        // place atomically. Extracting straight into `{cacheDir}/{taskHash}/`
        // let a concurrent `Cache.get` observe a half-populated entry: the
        // tarball lists `.commit` before the outputs it vouches for (it sorts
        // ahead alphabetically), so an in-place extract lands the completeness
        // marker before `outputs.tar.br`, and a mid-extract crash left a
        // committed-but-partial entry the cache would serve forever. The
        // trash-then-rename swap mirrors {@link Cache.put}.
        await mkdir(stagingDirectory, { recursive: true });
        await extractTarGz(archivePath, stagingDirectory);

        const trashDirectory = `${entryDirectory}.trash-${randomUUID()}`;
        let hadExisting = false;

        try {
            await rename(entryDirectory, trashDirectory);
            hadExisting = true;
        } catch {
            // Destination didn't exist — fine, just proceed.
        }

        try {
            await rename(stagingDirectory, entryDirectory);
        } catch (error) {
            // The new entry rename failed; put the old one back so we don't
            // leave the cache key absent.
            if (hadExisting) {
                await rename(trashDirectory, entryDirectory).catch(() => {});
            }

            throw error;
        }

        if (hadExisting) {
            await rm(trashDirectory, { force: true, recursive: true }).catch(() => {});
        }

        return true;
    } catch {
        await rm(stagingDirectory, { force: true, recursive: true }).catch(() => {});

        return false;
    } finally {
        await rm(archivePath, { force: true }).catch(() => {});
    }
};

/**
 * Tar `{localCacheDirectory}/{taskHash}/` and upload as a single CAS
 * blob via {@link RemoteCacheBackend.storeAction}. Skips the upload
 * unless `.commit` is present so we never publish a half-written entry.
 *
 * The lazy {@link BlobSource.open} returns a fresh `createReadStream`
 * each call so REAPI's `FindMissingBlobs` → `BatchUpdateBlobs` →
 * fallback `Write` flow can re-read the file as many times as it needs
 * to without requiring the bridge to buffer the bytes in memory.
 *
 * Bridge-local failures (`createTarGz`, `digestFile`) are surfaced
 * through `onUploadError` when provided, then swallowed so the
 * fire-and-forget call site stays non-throwing. A missing `.commit`
 * marker is *not* an error — it's the normal "skip this upload" path.
 */
export const storeByTaskHash = async (
    backend: RemoteCacheBackend,
    taskHash: string,
    localCacheDirectory: string,
    onUploadError?: (hash: string, error: unknown) => void,
): Promise<boolean> => {
    const entryDirectory = join(localCacheDirectory, taskHash);
    const archivePath = join(localCacheDirectory, `.upload-${taskHash}-${randomUUID()}.tar.gz`);

    try {
        try {
            await stat(join(entryDirectory, ".commit"));
        } catch {
            // .commit missing: cache write hasn't finished yet (or this entry was
            // skipped). Not an error — surfacing it would just be noise.
            return false;
        }

        try {
            await createTarGz(entryDirectory, archivePath);

            const blobDigest = await digestFile(archivePath);

            const result: ActionResult = {
                exitCode: 0,
                outputDirectories: [],
                outputFiles: [{ digest: blobDigest, isExecutable: false, path: TARBALL_OUTPUT_PATH }],
            };

            const blob: BlobSource = {
                digest: blobDigest,
                open: () => Promise.resolve(createReadStream(archivePath)),
            };

            return await backend.storeAction(actionDigestForTaskHash(taskHash), result, [blob]);
        } catch (error) {
            // Bridge-local pipeline failure (tar/digest) — backend.storeAction
            // surfaces wire-level errors itself, so we only fire onUploadError
            // for the steps the backend can't see.
            onUploadError?.(taskHash, error);

            return false;
        }
    } finally {
        await rm(archivePath, { force: true }).catch(() => {});
    }
};

const digestFile = async (path: string): Promise<CasDigest> => {
    const hash = createHash("sha256");
    let sizeBytes = 0;

    for await (const chunk of createReadStream(path)) {
        const buffer = chunk as Buffer;

        hash.update(buffer);
        sizeBytes += buffer.byteLength;
    }

    return { hash: hash.digest("hex"), sizeBytes };
};
