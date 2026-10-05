import type { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";

// Copied from __tests__/storage/azure/azure-fake.test.ts so other suites can share it.

type Blob = {
    body: Buffer;
    contentType?: string;
    createdOn: Date;
    etag: string;
    lastModified: Date;
    metadata: Record<string, string>;
};

const ORIGIN = "https://acct.blob.core.windows.net/files/";

export const statusError = (statusCode: number, code: string): Error => Object.assign(new Error(code), { code, statusCode });

/**
 * In-memory Azure Blob container ("files") answering the BlobServiceClient calls AzureStorage and
 * AzureMetaStorage make. `fail` answers a call with an error before the fake does, to inject failures.
 */
export const createAzureFake = () => {
    const blobs = new Map<string, Blob>();
    // Uncommitted blocks per blob name; like Azure, a block can be staged before the blob exists.
    const staged = new Map<string, Map<string, Buffer>>();
    const state: { batchUnavailable?: boolean; fail?: (operation: string, name: string) => Error | undefined; pageSize: number } = { pageSize: 1000 };
    let etags = 0;

    const nextEtag = (): string => {
        etags += 1;

        return `"e${String(etags)}"`;
    };

    const response = (requestId = "r") => {
        return { _response: { headers: { get: () => undefined } }, etag: nextEtag(), requestId };
    };

    const put = (name: string, body: Buffer, metadata: Record<string, string>, contentType?: string): void => {
        const now = new Date();

        blobs.set(name, {
            body,
            contentType,
            createdOn: blobs.get(name)?.createdOn ?? now,
            etag: nextEtag(),
            lastModified: now,
            metadata,
        });
    };

    const blobClient = (name: string) => {
        const guard = (operation: string): void => {
            const error = state.fail?.(operation, name);

            if (error) {
                throw error;
            }
        };
        const existing = (): Blob => {
            const blob = blobs.get(name);

            if (!blob) {
                throw statusError(404, "BlobNotFound");
            }

            return blob;
        };

        return {
            beginCopyFromURL: async (url: string) => {
                guard("copy");

                const source = blobs.get(decodeURIComponent(url.slice(ORIGIN.length)));

                if (!source) {
                    throw statusError(404, "CannotVerifyCopySource");
                }

                put(name, Buffer.from(source.body), { ...source.metadata }, source.contentType);

                return { pollUntilDone: async () => undefined };
            },
            commitBlockList: async (ids: string[], options: { blobHTTPHeaders: { blobContentType: string }; metadata: Record<string, string> }) => {
                guard("commitBlockList");

                const blocks = staged.get(name) ?? new Map<string, Buffer>();

                put(name, Buffer.concat(ids.map((id) => blocks.get(id) as Buffer)), options.metadata, options.blobHTTPHeaders.blobContentType);
                staged.delete(name);

                return response("commit");
            },
            createIfNotExists: async (options: { metadata: Record<string, string> }) => {
                if (blobs.has(name)) {
                    return { succeeded: false };
                }

                put(name, Buffer.alloc(0), options.metadata);

                return { etag: blobs.get(name)?.etag, succeeded: true };
            },
            deleteIfExists: async () => {
                guard("delete");
                staged.delete(name);

                return { succeeded: blobs.delete(name) };
            },
            downloadToBuffer: async () => Buffer.from(existing().body),
            exists: async () => {
                guard("exists");

                return blobs.has(name);
            },
            getBlockList: async () => {
                return {
                    uncommittedBlocks: [...(staged.get(name) ?? [])].map(([id, body]) => {
                        return { name: id, size: body.byteLength };
                    }),
                };
            },
            getProperties: async () => {
                guard("getProperties");

                const blob = existing();

                return {
                    contentLength: blob.body.byteLength,
                    contentType: blob.contentType,
                    etag: blob.etag,
                    lastModified: blob.lastModified,
                    metadata: blob.metadata,
                };
            },
            name,
            setMetadata: async (metadata: Record<string, string>, options?: { conditions?: { ifMatch?: string } }) => {
                const blob = existing();

                if (options?.conditions?.ifMatch !== undefined && options.conditions.ifMatch !== blob.etag) {
                    throw statusError(412, "ConditionNotMet");
                }

                blob.metadata = metadata;
                blob.etag = nextEtag();

                return { etag: blob.etag };
            },
            stageBlock: async (id: string, body: Buffer | Readable, length: number) => {
                guard("stageBlock");

                const bytes = Buffer.isBuffer(body) ? body : await buffer(body);

                if (bytes.byteLength !== length) {
                    throw statusError(400, "InvalidHeaderValue");
                }

                staged.set(name, (staged.get(name) ?? new Map<string, Buffer>()).set(id, bytes));

                return { requestId: "stage" };
            },
            uploadData: async (body: Buffer, options: { blobHTTPHeaders: { blobContentType?: string }; metadata: Record<string, string> }) => {
                guard("uploadData");
                put(name, body, options.metadata, options.blobHTTPHeaders.blobContentType);

                return response("upload");
            },
            url: `${ORIGIN}${name
                .split("/")
                .map((segment) => encodeURIComponent(segment))
                .join("/")}`,
        };
    };

    const listBlobsFlat = ({ prefix = "" }: { prefix?: string } = {}) => {
        const items = () =>
            [...blobs]
                .filter(([name]) => name.startsWith(prefix))
                .toSorted(([a], [b]) => a.localeCompare(b))
                .map(([name, blob]) => {
                    return { deleted: false, metadata: blob.metadata, name, properties: { createdOn: blob.createdOn, lastModified: blob.lastModified } };
                });

        return {
            byPage: ({ continuationToken, maxPageSize }: { continuationToken?: string; maxPageSize: number }) => {
                return {
                    next: async () => {
                        const error = state.fail?.("list", prefix);

                        if (error) {
                            throw error;
                        }

                        const start = Number(continuationToken ?? 0);
                        const end = start + Math.min(maxPageSize, state.pageSize);
                        const all = items();

                        return {
                            value: {
                                continuationToken: end < all.length ? String(end) : undefined,
                                segment: { blobItems: all.slice(start, end) },
                            },
                        };
                    },
                };
            },
            async *[Symbol.asyncIterator]() {
                yield* items();
            },
        };
    };

    const service = {
        getBlobBatchClient: () => {
            return {
                deleteBlobs: async (clients: { name: string }[]) => {
                    if (state.batchUnavailable) {
                        throw statusError(400, "FeatureNotSupported");
                    }

                    return {
                        subResponses: clients.map(({ name }) => {
                            const error = state.fail?.("delete", name);

                            if (error) {
                                return { errorCode: error.message, status: (error as { statusCode?: number }).statusCode ?? 500 };
                            }

                            return { status: blobs.delete(name) ? 202 : 404 };
                        }),
                    };
                },
            };
        },
        getContainerClient: () => {
            return {
                getAppendBlobClient: blobClient,
                getBlobClient: blobClient,
                getBlockBlobClient: blobClient,
                getProperties: async () => {
                    return {};
                },
                listBlobsFlat,
            };
        },
    };

    return { blobs, put, service, state };
};
