import type { Files } from "./files";
import { DEFAULT_BULK_CONCURRENCY, objectsMatch, runConcurrent, toBulkError } from "./internal";
import type { BulkError, FileObject, SyncOptions, SyncProgress, SyncResult, TransferOptions, TransferProgress, TransferResult } from "./types";

/**
 * Streams every object from `source` to `destination` for cross-provider migration.
 * Built entirely on the public {@link Files} surface — no adapter implements anything new.
 *
 * Each object is downloaded and re-uploaded with bounded concurrency. By default missing
 * destination keys are uploaded and existing keys are skipped — pass `overwrite: true` to force
 * re-upload. Body, content type, and user metadata travel; `etag`/`lastModified` are
 * destination-assigned.
 *
 * Like the other bulk methods, `transfer` doesn't throw on partial failure: results come back as
 * `{ transferred, skipped, errors? }`.
 * @example
 * ```ts
 * const from = new Files({ adapter: new S3Storage({ bucket: "old", ... }) });
 * const to = new Files({ adapter: new GCSStorage({ bucket: "new", ... }) });
 *
 * const { transferred, skipped, errors } = await transfer(from, to, {
 *   prefix: "uploads/",
 *   onProgress: ({ done, key, status }) => console.log(done, key, status),
 * });
 * ```
 */
export const transfer = async (source: Files, destination: Files, options: TransferOptions = {}): Promise<TransferResult> => {
    const { concurrency = DEFAULT_BULK_CONCURRENCY, limit, onProgress, overwrite = false, prefix, signal, stopOnError = false, transformKey } = options;

    const transferred: string[] = [];
    const skipped: string[] = [];
    const errors: BulkError[] = [];

    let stopped = false;
    let done = 0;

    const emit = (event: TransferProgress): void => {
        if (!onProgress) {
            return;
        }

        try {
            onProgress(event);
        } catch {
            // fire-and-forget
        }
    };

    const walk = source.listAll({ ...(prefix !== undefined && { prefix }), ...(limit !== undefined && { limit }) });

    const transferOne = async (sourceKey: string): Promise<void> => {
        if (stopped || signal?.aborted) {
            return;
        }

        const destinationKey = transformKey ? transformKey(sourceKey) : sourceKey;

        try {
            if (!overwrite) {
                const exists = await destination.exists(destinationKey, { signal });

                if (exists) {
                    skipped.push(sourceKey);
                    done += 1;
                    emit({ done, key: sourceKey, status: "skipped" });

                    return;
                }
            }

            const downloaded = await source.download(sourceKey, { signal });

            await destination.upload(destinationKey, downloaded.body, {
                ...(downloaded.contentType && { contentType: downloaded.contentType }),
                ...(downloaded.metadata && { metadata: downloaded.metadata }),
                signal,
            });

            transferred.push(sourceKey);
            done += 1;
            emit({ done, key: sourceKey, status: "transferred" });
        } catch (error: unknown) {
            const bulk = toBulkError(sourceKey, error);

            errors.push(bulk);
            done += 1;
            emit({ done, error: bulk.error, key: sourceKey, status: "errored" });

            if (stopOnError) {
                stopped = true;

                throw bulk.error;
            }
        }
    };

    if (stopOnError) {
        // Sequential when stop-on-error so failure semantics are deterministic.
        try {
            for await (const file of walk) {
                if (stopped || signal?.aborted) {
                    break;
                }

                try {
                    await transferOne(file.key);
                } catch {
                    break;
                }
            }
        } finally {
            // Make sure the underlying listAll generator's `finally` runs (and emits its hook) even
            // if we broke out early. AsyncIterators don't auto-`return()` from a `for await` that
            // exits via `break`/`throw` when the iterator is held in a variable.
            await walk.return?.();
        }

        return errors.length > 0 ? { errors, skipped, transferred } : { skipped, transferred };
    }

    // Streaming worker pool: N workers pull the next key from the shared async iterator. Avoids
    // buffering every key from a large bucket in memory before any transfer begins.
    const width = Math.max(1, concurrency);

    const worker = async (): Promise<void> => {
        while (!stopped && !signal?.aborted) {
            // Sequential pull from a shared iterator — workers race on `next()`, the runtime
            // serializes them so each key is handed out exactly once.
            const next = await walk.next();

            if (next.done) {
                return;
            }

            await transferOne(next.value.key);
        }
    };

    try {
        await Promise.all(Array.from({ length: width }, () => worker()));
    } finally {
        await walk.return?.();
    }

    return errors.length > 0 ? { errors, skipped, transferred } : { skipped, transferred };
};

/**
 * Incremental, optionally-pruning mirror from `source` to `destination`. Built entirely on the
 * public {@link Files} surface — no adapter implements anything new.
 *
 * Each source object is compared against its destination counterpart (by size, then etag, then
 * modification time) and only copied when missing or differing; matching objects are skipped. With
 * `prune: true`, destination keys absent from the source are deleted afterwards (full mirror).
 * Pass `dryRun: true` to compute the plan without writing.
 *
 * Like the other bulk methods, `sync` doesn't throw on partial failure: results come back as
 * `{ uploaded, updated, unchanged, deleted, errors? }`.
 * @example
 * ```ts
 * const from = new Files({ adapter: new S3Storage({ bucket: "primary", ... }) });
 * const to = new Files({ adapter: new GCSStorage({ bucket: "mirror", ... }) });
 *
 * // Preview first…
 * const plan = await sync(from, to, { prefix: "assets/", prune: true, dryRun: true });
 * // …then apply.
 * const result = await sync(from, to, { prefix: "assets/", prune: true });
 * ```
 */
export const sync = async (source: Files, destination: Files, options: SyncOptions = {}): Promise<SyncResult> => {
    const {
        concurrency = DEFAULT_BULK_CONCURRENCY,
        dryRun = false,
        limit,
        onProgress,
        prefix,
        prune = false,
        signal,
        stopOnError = false,
        transformKey,
    } = options;

    const uploaded: string[] = [];
    const updated: string[] = [];
    const unchanged: string[] = [];
    const deleted: string[] = [];
    const errors: BulkError[] = [];

    // Destination keys the source still owns — collected during the copy pass so pruning knows what
    // to keep. Stores resolved destination keys (post-transformKey).
    const sourceDestinationKeys = new Set<string>();

    let stopped = false;
    let done = 0;

    const emit = (event: SyncProgress): void => {
        if (!onProgress) {
            return;
        }

        try {
            onProgress(event);
        } catch {
            // fire-and-forget
        }
    };

    const walk = source.listAll({ ...(prefix !== undefined && { prefix }), ...(limit !== undefined && { limit }) });

    const syncOne = async (sourceObject: FileObject): Promise<void> => {
        if (stopped || signal?.aborted) {
            return;
        }

        const sourceKey = sourceObject.key;
        const destinationKey = transformKey ? transformKey(sourceKey) : sourceKey;

        sourceDestinationKeys.add(destinationKey);

        try {
            let destinationObject: FileObject | undefined;

            try {
                destinationObject = await destination.head(destinationKey, { signal });
            } catch {
                // Missing at destination (or head unsupported) → treat as a fresh upload.
                destinationObject = undefined;
            }

            if (destinationObject) {
                let sourceMeta = sourceObject;

                // listAll() yields only id/createdAt for several cloud adapters (S3/GCS/Azure `list`
                // omit size + etag), which would silently collapse the comparison to mtime. Head the
                // source to recover the strong signals when the walk didn't surface them.
                if (sourceObject.size === undefined && sourceObject.etag === undefined) {
                    try {
                        sourceMeta = await source.head(sourceKey, { signal });
                    } catch {
                        // Head unsupported/failed — fall back to the walked object (mtime comparison).
                    }
                }

                if (objectsMatch(sourceMeta, destinationObject)) {
                    unchanged.push(sourceKey);
                    done += 1;
                    emit({ done, key: sourceKey, status: "unchanged" });

                    return;
                }
            }

            const isUpdate = destinationObject !== undefined;

            if (!dryRun) {
                const downloaded = await source.download(sourceKey, { signal });

                await destination.upload(destinationKey, downloaded.body, {
                    ...(downloaded.contentType && { contentType: downloaded.contentType }),
                    ...(downloaded.metadata && { metadata: downloaded.metadata }),
                    signal,
                });
            }

            if (isUpdate) {
                updated.push(sourceKey);
            } else {
                uploaded.push(sourceKey);
            }

            done += 1;
            emit({ done, key: sourceKey, status: isUpdate ? "updated" : "uploaded" });
        } catch (error: unknown) {
            const bulk = toBulkError(sourceKey, error);

            errors.push(bulk);
            done += 1;
            emit({ done, error: bulk.error, key: sourceKey, status: "errored" });

            if (stopOnError) {
                stopped = true;

                throw bulk.error;
            }
        }
    };

    // Copy pass — streaming worker pool over the source walk.
    const width = Math.max(1, concurrency);

    const worker = async (): Promise<void> => {
        while (!stopped && !signal?.aborted) {
            const next = await walk.next();

            if (next.done) {
                return;
            }

            await syncOne(next.value);
        }
    };

    try {
        await Promise.all(Array.from({ length: width }, () => worker()));
    } finally {
        await walk.return?.();
    }

    // Prune pass — delete destination keys the source no longer owns. Skipped if a copy-phase error
    // stopped the run, so a half-finished walk can't trigger spurious deletes.
    if (prune && !stopped && !signal?.aborted) {
        const orphans: string[] = [];

        const destinationWalk = destination.listAll({ ...(prefix !== undefined && { prefix }), ...(limit !== undefined && { limit }) });

        try {
            for await (const object of destinationWalk) {
                if (!sourceDestinationKeys.has(object.key)) {
                    orphans.push(object.key);
                }
            }
        } finally {
            await destinationWalk.return?.();
        }

        const pruneSettled = await runConcurrent(
            orphans,
            async (key) => {
                if (!dryRun) {
                    await destination.delete(key, { signal });
                }

                return key;
            },
            { concurrency: width, signal, stopOnError },
        );

        for (const [index, result] of pruneSettled.entries()) {
            const key = orphans[index] as string;

            if (!result) {
                continue;
            }

            if (result.status === "fulfilled") {
                deleted.push(key);
                done += 1;
                emit({ done, key, status: "deleted" });
            } else {
                const bulk = toBulkError(key, result.reason);

                errors.push(bulk);
                done += 1;
                emit({ done, error: bulk.error, key, status: "errored" });
            }
        }
    }

    return errors.length > 0 ? { deleted, errors, unchanged, updated, uploaded } : { deleted, unchanged, updated, uploaded };
};
