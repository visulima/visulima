import { Readable } from "node:stream";

import { BlobServiceClient } from "@azure/storage-blob";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import AzureStorage from "../../../src/storage/azure/azure-storage";

vi.mock(import("@azure/storage-blob"), async (importOriginal) => {
    const actual = await importOriginal();

    return { ...actual, BlobServiceClient: vi.fn() };
});

type Blob = {
    body: Buffer;
    contentType?: string;
    createdOn: Date;
    etag: string;
    lastModified: Date;
    metadata: Record<string, string>;
};

const ORIGIN = "https://acct.blob.core.windows.net/files/";

const statusError = (statusCode: number, code: string): Error => Object.assign(new Error(code), { code, statusCode });

const readBody = async (body: Buffer | Readable): Promise<Buffer> => {
    if (Buffer.isBuffer(body)) {
        return body;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return Buffer.concat(chunks);
};

/**
 * In-memory Azure Blob container ("files") answering the BlobServiceClient calls AzureStorage and
 * AzureMetaStorage make. `fail` answers a call with an error before the fake does, to inject failures.
 */
const createAzure = () => {
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

                const bytes = await readBody(body);

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
            url: `${ORIGIN}${name.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`,
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

    return { blobs, service, state };
};

type Azure = ReturnType<typeof createAzure>;

let azure: Azure;

const createStorage = (options: Partial<ConstructorParameters<typeof AzureStorage>[0]> = {}): AzureStorage =>
    new AzureStorage({ accountKey: "a2V5", accountName: "acct", containerName: "files", retryConfig: { maxRetries: 0 }, ...options });

const upload = async (storage: AzureStorage, text: string, id?: string): Promise<string> => {
    const file = await storage.create({ contentType: "text/plain", id, metadata: { owner: "me" }, originalName: "a.txt", size: text.length });

    await storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });

    return file.id;
};

const readAll = async (stream: Readable): Promise<string> => readBody(stream).then((body) => body.toString());

describe("azure storage against an in-memory container", () => {
    beforeEach(() => {
        azure = createAzure();

        // eslint-disable-next-line func-names, prefer-arrow-callback -- constructor mock
        vi.mocked(BlobServiceClient).mockImplementation(function () {
            return azure.service as unknown as BlobServiceClient;
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should write a chunked upload, resume after an interrupted chunk and keep its metadata", async () => {
        expect.assertions(7);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: 12 });

        await storage.write({ body: Readable.from([Buffer.from("0123")]), contentLength: 4, id: file.id, start: 0 });

        // The connection drops halfway through the second chunk.
        const broken = new Readable({
            read() {
                this.push(Buffer.from("45"));
                this.destroy(new Error("socket hang up"));
            },
        });

        await expect(storage.write({ body: broken, contentLength: 4, id: file.id, start: 4 })).rejects.toThrow("socket hang up");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ bytesWritten: 4, status: "part" });

        // The client resumes from the persisted offset.
        await storage.write({ body: Readable.from([Buffer.from("4567")]), contentLength: 4, id: file.id, start: 4 });

        const done = await storage.write({ body: Readable.from([Buffer.from("89ab")]), contentLength: 4, id: file.id, start: 8 });

        expect(done.status).toBe("completed");
        expect(azure.blobs.get(file.id)?.body.toString()).toBe("0123456789ab");
        expect(azure.blobs.get(file.id)?.contentType).toBe("text/plain");

        const meta = await storage.getMeta(file.id);

        expect(meta).toMatchObject({ bytesWritten: 12, metadata: { owner: "me" }, originalName: "a.txt", status: "completed" });

        // Writing again to a completed upload is a no-op.
        await storage.write({ body: Readable.from([Buffer.from("zz")]), contentLength: 2, id: file.id, start: 12 });

        expect(azure.blobs.get(file.id)?.body.toString()).toBe("0123456789ab");
    });

    it("should buffer a chunk without a declared length", async () => {
        expect.assertions(1);

        const storage = createStorage();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 5 });

        await storage.write({ body: Readable.from([Buffer.from("he"), Buffer.from("llo")]), id: file.id, start: 0 });

        expect(azure.blobs.get(file.id)?.body.toString()).toBe("hello");
    });

    it("should return the existing upload when created twice with the same id", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const first = await storage.create({ contentType: "text/plain", id: "same", metadata: {}, originalName: "a.txt", size: 4 });

        await storage.write({ body: Readable.from([Buffer.from("ab")]), contentLength: 2, id: first.id, start: 0 });

        const second = await storage.create({ contentType: "text/plain", id: "same", metadata: {}, originalName: "a.txt", size: 4 });

        expect(second.id).toBe(first.id);
        expect(second.bytesWritten).toBe(2);
    });

    it("should read a finished upload with get and getStream", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        const file = await storage.get({ id });
        const { headers, size, stream } = await storage.getStream({ id });

        expect(file).toMatchObject({ contentType: "text/plain", id, originalName: "a.txt", size: 5 });
        expect(file.content.toString()).toBe("hello");
        expect([size, headers?.["Content-Type"]]).toStrictEqual([5, "text/plain"]);
        await expect(readAll(stream)).resolves.toBe("hello");
    });

    it("should tell a missing blob from a deleted one", async () => {
        expect.assertions(2);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        azure.blobs.delete(id);

        await expect(storage.get({ id })).rejects.toMatchObject({ UploadErrorCode: "Gone" });
        await expect(storage.get({ id: "never" })).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
    });

    it("should check existence against both metadata and blob", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        azure.blobs.set("foreign", { ...(azure.blobs.get(id) as Blob) });

        await expect(storage.exists({ id })).resolves.toBe(true);
        await expect(storage.exists({ id: "foreign" })).resolves.toBe(false);
        await expect(storage.getCompletedFile("foreign")).resolves.toMatchObject({ id: "foreign", size: 5, status: "completed" });
        await expect(storage.getCompletedFile("missing")).resolves.toBeUndefined();

        azure.state.fail = (operation) => (operation === "getProperties" ? statusError(403, "AuthorizationFailure") : undefined);

        await expect(storage.getCompletedFile("foreign")).rejects.toThrow("AuthorizationFailure");

        azure.state.fail = (operation) => (operation === "exists" ? statusError(500, "InternalError") : undefined);

        await expect(storage.exists({ id })).resolves.toBe(false);
    });

    it("should copy and move a blob, dropping the moved source's metadata", async () => {
        expect.assertions(6);

        const storage = createStorage();
        const id = await upload(storage, "hello");

        await expect(storage.copy(id, "copied")).resolves.toMatchObject({ id: "copied", name: "copied" });
        expect(azure.blobs.get("copied")?.body.toString()).toBe("hello");

        await storage.move(id, "moved");

        expect(azure.blobs.get("moved")?.body.toString()).toBe("hello");
        expect(azure.blobs.has(id)).toBe(false);
        // No orphaned sidecar is left behind for the moved upload.
        expect(azure.blobs.has(`${id}.META`)).toBe(false);

        await expect(storage.copy("missing", "x")).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
    });

    it("should copy a blob written by other means", async () => {
        expect.assertions(2);

        const storage = createStorage();

        azure.blobs.set("foreign", {
            body: Buffer.from("other"),
            contentType: "text/plain",
            createdOn: new Date(),
            etag: '"x"',
            lastModified: new Date(),
            metadata: {},
        });

        await expect(storage.copy("foreign", "copy")).resolves.toMatchObject({ id: "copy", name: "copy" });
        expect(azure.blobs.get("copy")?.body.toString()).toBe("other");
    });

    it("should list blobs across pages without the metadata sidecars", async () => {
        expect.assertions(3);

        const storage = createStorage();

        for (const id of ["f-a", "f-b", "f-c"]) {
            await upload(storage, id, id);
        }

        // Pages of two blobs, mostly filled with sidecars.
        azure.state.pageSize = 2;

        await expect(storage.list().then((files) => files.map((file) => file.id))).resolves.toStrictEqual(["f-a", "f-b", "f-c"]);
        await expect(storage.list(2).then((files) => files.map((file) => file.id))).resolves.toStrictEqual(["f-a", "f-b"]);

        azure.state.fail = () => statusError(403, "AuthorizationFailure");

        await expect(storage.list()).rejects.toThrow("AuthorizationFailure");
    });

    it("should list only the blobs under root and assetFolder", async () => {
        expect.assertions(2);

        const storage = createStorage({ assetFolder: "assets", root: "tenant" });
        const id = await upload(storage, "hi");

        await upload(createStorage(), "other", "outside");

        expect(azure.blobs.has(`tenant/assets/${id}`)).toBe(true);
        await expect(storage.list().then((files) => files.map((file) => file.id))).resolves.toStrictEqual([id]);
    });

    it("should delete the blob and its metadata, and keep the metadata when the blob delete fails", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const kept = await upload(storage, "keep");
        const gone = await upload(storage, "gone");

        await storage.delete({ id: gone });

        expect([azure.blobs.has(gone), azure.blobs.has(`${gone}.META`)]).toStrictEqual([false, false]);

        azure.state.fail = (operation) => (operation === "delete" ? statusError(503, "ServerBusy") : undefined);

        await expect(storage.delete({ id: kept })).rejects.toThrow("ServerBusy");
        await expect(storage.getMeta(kept)).resolves.toMatchObject({ id: kept });
        expect(azure.blobs.has(kept)).toBe(true);
    });

    it("should delete in a batch, keeping the metadata of failed sub-requests", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const ids = [await upload(storage, "a", "f-a"), await upload(storage, "b", "f-b")];

        azure.state.fail = (operation, name) => (operation === "delete" && name === "f-b" ? statusError(403, "AuthorizationFailure") : undefined);

        const result = await storage.deleteBatch([...ids, "missing"]);

        expect(result.successful.map((file) => file.id)).toStrictEqual(["f-a", "missing"]);
        expect(result.failed).toStrictEqual([{ error: "AuthorizationFailure", id: "f-b" }]);
        expect([azure.blobs.has("f-a"), azure.blobs.has("f-a.META")]).toStrictEqual([false, false]);
        expect([azure.blobs.has("f-b"), azure.blobs.has("f-b.META")]).toStrictEqual([true, true]);
    });

    it("should fall back to per-key deletes when the batch API is unavailable", async () => {
        expect.assertions(4);

        const storage = createStorage();
        const id = await upload(storage, "a");

        azure.state.batchUnavailable = true;

        const result = await storage.deleteBatch([id, "missing"]);

        expect(result.successful.map((file) => file.id)).toStrictEqual([id]);
        expect(result.failed.map((failure) => failure.id)).toStrictEqual(["missing"]);
        expect(azure.blobs.has(id)).toBe(false);
        await expect(storage.deleteBatch([])).resolves.toMatchObject({ successfulCount: 0 });
    });

    it("should refuse writes to an expired upload and purge old ones", async () => {
        expect.assertions(4);

        const storage = createStorage({ expiration: { maxAge: "1h" } });
        const expired = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 4, ttl: -1000 });

        await expect(storage.write({ body: Readable.from([Buffer.from("ab")]), contentLength: 2, id: expired.id, start: 0 })).rejects.toMatchObject({
            UploadErrorCode: "Gone",
        });

        const old = await upload(storage, "old", "old");
        const fresh = await upload(storage, "new", "new");

        // Purge goes by the upload record.
        (azure.blobs.get(`${old}.META`) as Blob).createdOn = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([old]);
        expect([azure.blobs.has(old), azure.blobs.has(`${old}.META`)]).toStrictEqual([false, false]);
        expect(azure.blobs.has(fresh)).toBe(true);
    });

    it("should purge an expired upload stored under a custom filename", async () => {
        expect.assertions(2);

        const storage = createStorage({ expiration: { maxAge: "1h" }, filename: (file) => `named/${file.originalName}` });
        const id = await upload(storage, "old", "aged");

        (azure.blobs.get(`${id}.META`) as Blob).createdOn = new Date(Date.now() - 2 * 60 * 60 * 1000);

        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([id]);
        expect([azure.blobs.has("named/a.txt"), azure.blobs.has(`${id}.META`)]).toStrictEqual([false, false]);
    });

    it("should run a chunked REST upload, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(6);

        const rest = new RestFetch({ storage: createStorage() });
        const endpoint = "https://app.local/upload";
        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const statuses: number[] = [];

        for (const [start, text] of [
            [0, "01234"],
            [5, "56789"],
        ] as const) {
            const response = await rest.fetch(
                new Request(location, {
                    body: text,
                    headers: { "content-length": "5", "content-type": "application/octet-stream", "x-chunk-offset": String(start) },
                    method: "PATCH",
                }),
            );

            statuses.push(response.status);
        }

        expect(statuses).toStrictEqual([202, 200]);
        expect(azure.blobs.get(id)?.body.toString()).toBe("0123456789");

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([put.status, azure.blobs.get(id)?.body.toString()]).toStrictEqual([200, "next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBeLessThan(300);
        expect([azure.blobs.has(id), azure.blobs.has(`${id}.META`)]).toStrictEqual([false, false]);
    });
});
