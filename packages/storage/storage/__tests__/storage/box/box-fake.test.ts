import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";

import type { BoxClient } from "box-typescript-sdk-gen";
import { afterEach, describe, expect, it, vi } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import type BoxFile from "../../../src/storage/box/box-file";
import BoxStorage from "../../../src/storage/box/box-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";
import { describeStorageContract } from "../../__helpers__/storage-contract";

type Item = { body?: Buffer; etag?: string; id: string; name: string; parent: string; type: "file" | "folder" };

const boxError = (statusCode: number, code: string): Error => Object.assign(new Error(code), { responseInfo: { code, statusCode } });

/**
 * In-memory Box account: folder "0" is the root. Downloads are served by `fetch` from
 * https://dl.box.test/&lt;file id>. `fail` answers a method call (`*`: every call) before the fake does, to inject errors.
 */
const createBox = () => {
    const items = new Map<string, Item>();
    const fail: Partial<Record<string, () => never>> = {};
    let counter = 0;

    const nextId = (): string => {
        counter += 1;

        return String(counter);
    };
    const children = (folderId: string): Item[] => [...items.values()].filter((item) => item.parent === folderId);
    const getItem = (id: string): Item => {
        const item = items.get(id);

        if (!item) {
            throw boxError(404, "not_found");
        }

        return item;
    };
    const assertFreeName = (parent: string, name: string): void => {
        if (children(parent).some((item) => item.name === name)) {
            throw boxError(409, "item_name_in_use");
        }
    };
    const describe = ({ body, etag, id, name, type }: Item) => {
        return { etag, id, modifiedAt: "2026-01-01T00:00:00Z", name, size: body?.byteLength, type };
    };
    const putFile = (parent: string, name: string, body: Buffer, id = nextId()) => {
        const item: Item = { body, etag: `e${nextId()}`, id, name, parent, type: "file" };

        items.set(id, item);

        return describe(item);
    };
    const guard = (method: string): void => {
        (fail[method] ?? fail["*"])?.();
    };

    const client = {
        chunkedUploads: {
            createFileUploadSessionCommitByUrl: async (url: string) => {
                const session = sessions.get(url) as { fileId: string; parts: Buffer[] };
                const item = getItem(session.fileId);

                return { entries: [putFile(item.parent, item.name, Buffer.concat(session.parts), item.id)] };
            },
            createFileUploadSessionForExistingFile: async (fileId: string) => {
                getItem(fileId);
                sessions.set(`commit-${fileId}`, { fileId, parts: [] });

                return { partSize: 8 * 1024 * 1024, sessionEndpoints: { commit: `commit-${fileId}`, uploadPart: `commit-${fileId}` } };
            },
            uploadBigFile: async (file: Readable, name: string, _size: number, folderId: string) => {
                assertFreeName(folderId, name);

                return putFile(folderId, name, await buffer(file));
            },
            uploadFilePartByUrl: async (url: string, file: Readable, { contentRange }: { contentRange: string }) => {
                (sessions.get(url) as { parts: Buffer[] }).parts.push(await buffer(file));

                return { part: { offset: Number(/bytes (\d+)/u.exec(contentRange)?.[1]) } };
            },
        },
        downloads: {
            getDownloadFileUrl: async (id: string) => {
                getItem(id);

                return `https://dl.box.test/${id}`;
            },
        },
        files: {
            copyFile: async (id: string, { name, parent }: { name: string; parent: { id: string } }) => {
                assertFreeName(parent.id, name);

                return putFile(parent.id, name, getItem(id).body as Buffer);
            },
            deleteFileById: async (id: string) => {
                guard("deleteFileById");
                getItem(id);
                items.delete(id);
            },
            getFileById: async (id: string) => describe(getItem(id)),
            updateFileById: async (id: string, { requestBody }: { requestBody: { name: string; parent: { id: string } } }) => {
                const item = getItem(id);

                assertFreeName(requestBody.parent.id, requestBody.name);
                Object.assign(item, { name: requestBody.name, parent: requestBody.parent.id });

                return describe(item);
            },
        },
        folders: {
            createFolder: async ({ name, parent }: { name: string; parent: { id: string } }) => {
                assertFreeName(parent.id, name);

                const id = nextId();

                items.set(id, { id, name, parent: parent.id, type: "folder" });

                return { id };
            },
            getFolderItems: async (folderId: string, { queryParams }: { queryParams: { limit: number; offset: number } }) => {
                guard("getFolderItems");

                return { entries: children(folderId).slice(queryParams.offset, queryParams.offset + queryParams.limit).map((item) => describe(item)) };
            },
        },
        sharedLinksFiles: {
            addShareLinkToFile: async (id: string) => {
                getItem(id);

                return { sharedLink: { downloadUrl: `https://shared.box.test/${id}` } };
            },
        },
        uploads: {
            uploadFile: async ({ attributes, file }: { attributes: { name: string; parent: { id: string } }; file: Readable }) => {
                assertFreeName(attributes.parent.id, attributes.name);

                return { entries: [putFile(attributes.parent.id, attributes.name, await buffer(file))] };
            },
            uploadFileVersion: async (id: string, { file }: { file: Readable }) => {
                const item = getItem(id);

                return { entries: [putFile(item.parent, item.name, await buffer(file), id)] };
            },
        },
    };
    const sessions = new Map<string, { fileId: string; parts: Buffer[] }>();

    const fetch = async (input: RequestInfo | URL): Promise<Response> => {
        const id = new URL(String(input instanceof Request ? input.url : input)).pathname.slice(1);
        const item = items.get(id);

        return item?.body ? new Response(item.body) : new Response(null, { status: 404 });
    };

    /** Content of the file at a slash-separated path, or undefined. */
    const read = (path: string): string | undefined => {
        let parent = "0";
        let found: Item | undefined;

        for (const segment of path.split("/")) {
            found = children(parent).find((item) => item.name === segment);

            if (!found) {
                return undefined;
            }

            parent = found.id;
        }

        return found?.body?.toString();
    };

    return { client: client as unknown as BoxClient, fail, fetch, items, putFile, read };
};

const setup = (options: { expiration?: { maxAge: string }; filename?: (file: BoxFile) => string; publicByDefault?: boolean } = {}) => {
    const box = createBox();
    const meta = new MemoryMetaStorage<BoxFile>();

    vi.stubGlobal("fetch", box.fetch);

    const storage = new BoxStorage({ client: box.client, metaStorage: meta, retryConfig: { maxRetries: 0 }, ...options });

    return { box, meta, storage };
};

const upload = async (storage: BoxStorage, text: string, originalName = "a.txt"): Promise<BoxFile> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName, size: text.length });

    return storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });
};

describe("box against an in-memory Box account", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    describeStorageContract(
        () => {
            const box = createBox();
            const meta = new MemoryMetaStorage<BoxFile>();

            vi.stubGlobal("fetch", box.fetch);

            return {
                createStorage: (options) => new BoxStorage({ client: box.client, metaStorage: meta, retryConfig: { maxRetries: 0 }, ...options }),
                failBackend: (failing) => {
                    box.fail["*"] = failing
                        ? () => {
                              throw boxError(500, "internal_server_error");
                          }
                        : undefined;
                },
                hasObject: (key) => box.read(key) !== undefined,
                putObject: (key, content) => {
                    box.putFile("0", key, Buffer.from(content));
                },
            };
        },
    );

    it("should store a whole-file write and keep the metadata after completion", async () => {
        expect.assertions(6);

        const { box, storage } = setup({ filename: (file) => `docs/${file.id}` });
        const file = await upload(storage, "hello");

        expect(file.status).toBe("completed");
        expect(box.read(`docs/${file.id}`)).toBe("hello");
        await expect(storage.getMeta(file.id)).resolves.toMatchObject({ boxFileId: file.boxFileId, metadata: { owner: "me" }, status: "completed" });
        await expect(storage.exists({ id: file.id })).resolves.toBe(true);

        const got = await storage.get({ id: file.id });

        expect([got.content.toString(), got.contentType, got.originalName]).toStrictEqual(["hello", "text/plain", "a.txt"]);

        const { stream } = await storage.getStream({ id: file.id });

        await expect(buffer(stream)).resolves.toStrictEqual(Buffer.from("hello"));
    });

    it("should reject chunks and partial bodies, and accept the whole file on a retry", async () => {
        expect.assertions(5);

        const { box, storage } = setup();
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });
        const write = async (text: string, start: number) =>
            storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start });

        await expect(write("01234", 0)).rejects.toMatchObject({ UploadErrorCode: "MethodNotAllowed" });
        await expect(write("56789", 5)).rejects.toMatchObject({ UploadErrorCode: "MethodNotAllowed" });
        // Nothing reached Box, and the upload can still be finished.
        expect(box.read(file.id)).toBeUndefined();
        await expect(write("0123456789", 0)).resolves.toMatchObject({ bytesWritten: 10, status: "completed" });
        expect(box.read(file.id)).toBe("0123456789");
    });

    it("should replace the content of an existing file with a new version", async () => {
        expect.assertions(3);

        const { box, storage } = setup();
        const file = await upload(storage, "one");
        const fileId = file.boxFileId;

        // A fresh storage has no cached id, so it has to find the existing file by name.
        const again = new BoxStorage({ client: box.client, metaStorage: new MemoryMetaStorage(), retryConfig: { maxRetries: 0 } });
        const replaced = await again.create({ contentType: "text/plain", id: file.id, metadata: {}, originalName: "a.txt", size: 3 });
        const written = await again.write({ body: Readable.from([Buffer.from("two")]), contentLength: 3, id: replaced.id, start: 0 });

        expect(written.boxFileId).toBe(fileId);
        expect(box.read(file.id)).toBe("two");
        expect([...box.items.values()].filter((item) => item.type === "file")).toHaveLength(1);
    });

    it("should upload files above 50 MB through the chunked API, also as a new version", async () => {
        expect.assertions(3);

        const { box, storage } = setup();
        const size = 50 * 1024 * 1024 + 3;
        const write = async (fill: number, id?: string) => {
            const file = await storage.create({ contentType: "application/octet-stream", id, metadata: {}, originalName: "big.bin", size });

            return storage.write({ body: Readable.from([Buffer.alloc(size, fill)]), contentLength: size, id: file.id, start: 0 });
        };

        const first = await write(1);
        const meta = await storage.getMeta(first.id);

        await storage.deleteMeta(first.id);

        const second = await write(2, first.id);
        const stored = box.items.get(second.boxFileId as string)?.body as Buffer;

        expect(second.boxFileId).toBe(meta.boxFileId);
        expect(stored.byteLength).toBe(size);
        expect([stored[0], stored.at(-1)]).toStrictEqual([2, 2]);
    });

    it("should describe completed files without metadata, answer undefined when missing and throw on other errors", async () => {
        expect.assertions(3);

        const { box, storage } = setup();

        box.putFile("0", "external.txt", Buffer.from("abc"));

        await expect(storage.getCompletedFile("external.txt")).resolves.toMatchObject({ bytesWritten: 3, id: "external.txt", size: 3, status: "completed" });
        await expect(storage.getCompletedFile("missing.txt")).resolves.toBeUndefined();

        box.fail.getFolderItems = () => {
            throw boxError(500, "internal_server_error");
        };

        await expect(storage.getCompletedFile("other.txt")).rejects.toMatchObject({ responseInfo: { statusCode: 500 } });
    });

    it("should copy and move files across folders", async () => {
        expect.assertions(5);

        const { box, storage } = setup();
        const file = await upload(storage, "data");

        await expect(storage.copy(file.id, "backup/copy.txt")).resolves.toMatchObject({ id: "backup/copy.txt" });

        const moved = await storage.move(file.id, "archive/2026/moved.txt");

        expect(moved.boxFileId).toBe(file.boxFileId);
        expect([box.read("backup/copy.txt"), box.read("archive/2026/moved.txt"), box.read(file.id)]).toStrictEqual(["data", "data", undefined]);
        // The moved upload's metadata is gone, and the destination is readable by name.
        await expect(storage.getMeta(file.id)).rejects.toMatchObject({ UploadErrorCode: "FileNotFound" });
        await expect(storage.get({ id: "archive/2026/moved.txt" })).resolves.toMatchObject({ content: Buffer.from("data") });
    });

    it("should page through the root folder, skipping folders", async () => {
        expect.assertions(2);

        const { box, storage } = setup();

        box.items.set("f", { id: "f", name: "folder", parent: "0", type: "folder" });

        for (const name of ["a", "b", "c", "d"]) {
            box.putFile("0", name, Buffer.from(name));
        }

        // Page size 3: the first page has the folder plus two files, the third file needs a second page.
        await expect(storage.list(3)).resolves.toMatchObject([{ id: "a" }, { id: "b" }, { id: "c" }]);

        const all = await storage.list();

        expect(all.map((file) => file.name)).toStrictEqual(["a", "b", "c", "d"]);
    });

    it("should report expired uploads as gone and purge them, also under a custom filename", async () => {
        expect.assertions(4);

        vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z"), toFake: ["Date"] });

        const { box, storage } = setup({ expiration: { maxAge: "1h" }, filename: (file) => `uploads/${file.id}` });
        const read = await upload(storage, "read");
        const old = await upload(storage, "old");

        vi.setSystemTime(new Date("2026-01-01T02:00:00Z"));

        await expect(storage.get({ id: read.id })).rejects.toMatchObject({ UploadErrorCode: "Gone" });

        // Reading an expired upload removes it in the background.
        await vi.waitFor(async () => {
            if (await storage.exists({ id: read.id })) {
                throw new Error("still there");
            }
        });

        const fresh = await upload(storage, "new");
        const purged = await storage.purge();

        expect(purged.items.map((item) => item.id)).toStrictEqual([old.id]);
        expect([read, old, fresh].map((file) => box.read(`uploads/${file.id}`))).toStrictEqual([undefined, undefined, "new"]);
        await expect(storage.exists({ id: fresh.id })).resolves.toBe(true);
    });

    it("should serve shared links for public files", async () => {
        expect.assertions(1);

        const { storage } = setup({ publicByDefault: true });
        const file = await upload(storage, "pub");

        await expect(storage.getReadUrl(file.id)).resolves.toBe(`https://shared.box.test/${file.boxFileId as string}`);
    });

    it("should run a REST upload: chunked POST + PATCH, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(6);

        const { box, storage } = setup();
        const rest = new RestFetch({ storage });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "text/plain", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const id = (location.split("/").pop() as string).replace(/\.[^.]*$/u, "");
        const patch = async (body: string, offset: number) =>
            rest.fetch(
                new Request(location, {
                    body,
                    headers: { "content-length": String(body.length), "content-type": "application/octet-stream", "x-chunk-offset": String(offset) },
                    method: "PATCH",
                }),
            );

        // Box takes no partial uploads: a part of the file is refused, the whole file in one chunk is not.
        const partial = await patch("01234", 0);
        const whole = await patch("0123456789", 0);

        expect([created.status, partial.status, whole.status]).toStrictEqual([201, 405, 200]);
        expect(box.read(id)).toBe("0123456789");

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const put = await rest.fetch(new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }));

        expect([put.status, box.read(id)]).toStrictEqual([200, "next"]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect(deleted.status).toBe(204);
        expect(box.read(id)).toBeUndefined();
    });
});
