import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import type { drive_v3 } from "@googleapis/drive";
import { describe, expect, it } from "vitest";

import RestFetch from "../../../src/handler/rest/rest-fetch";
import type GoogleDriveFile from "../../../src/storage/google-drive/google-drive-file";
import GoogleDriveStorage from "../../../src/storage/google-drive/google-drive-storage";
import MemoryMetaStorage from "../../../src/storage/memory/memory-meta-storage";

type DriveFile = {
    appProperties: Record<string, string>;
    body: Buffer;
    id: string;
    mimeType: string;
    modifiedTime: string;
    name: string;
    parents: string[];
};

type Params = Record<string, unknown> & { fileId?: string; media?: { body: Readable; mimeType: string }; requestBody?: Partial<DriveFile> };

const driveError = (status: number): Error => Object.assign(new Error(`Drive error ${String(status)}`), { code: status, response: { status }, status });

const unescape = (value: string): string => value.replaceAll(/\\(.)/gu, "$1");

/**
 * In-memory Drive v3 `files` surface. Pages are capped at `pageLimit` like Drive, which may return
 * fewer results than `pageSize`. `fail` answers a call before the fake does, to inject failures.
 */
const createDrive = (pageLimit = 100) => {
    const files = new Map<string, DriveFile>();
    const state: { fail?: (method: string, params: Params) => Error | undefined } = {};
    let counter = 0;

    const guard = (method: string, params: Params): void => {
        const error = state.fail?.(method, params);

        if (error) {
            throw error;
        }
    };

    const find = (fileId: string | undefined): DriveFile => {
        const file = files.get(fileId ?? "");

        if (!file) {
            throw driveError(404);
        }

        return file;
    };

    const describeFile = (file: DriveFile) => {
        return {
            appProperties: { ...file.appProperties },
            id: file.id,
            md5Checksum: createHash("sha256").update(file.body).digest("hex"),
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime,
            name: file.name,
            size: String(file.body.byteLength),
        };
    };

    const read = async (media: Params["media"]): Promise<Buffer> => Buffer.concat((await media?.body.toArray()) as Buffer[]);

    const add = (init: Omit<DriveFile, "id" | "modifiedTime">): DriveFile => {
        counter += 1;

        const file = { ...init, id: `f${String(counter)}`, modifiedTime: new Date().toISOString() };

        files.set(file.id, file);

        return file;
    };

    const client = {
        files: {
            copy: async (params: Params) => {
                guard("copy", params);

                const source = find(params.fileId);
                const copied = add({
                    ...source,
                    appProperties: { ...source.appProperties, ...params.requestBody?.appProperties },
                    name: params.requestBody?.name ?? source.name,
                    parents: params.requestBody?.parents ?? source.parents,
                });

                return { data: describeFile(copied) };
            },
            create: async (params: Params) => {
                guard("create", params);

                const body = await read(params.media);
                const file = add({
                    appProperties: { ...params.requestBody?.appProperties },
                    body,
                    mimeType: params.media?.mimeType ?? "application/octet-stream",
                    name: params.requestBody?.name ?? "untitled",
                    parents: params.requestBody?.parents ?? ["root"],
                });

                return { data: describeFile(file) };
            },
            delete: async (params: Params) => {
                guard("delete", params);
                find(params.fileId);
                files.delete(params.fileId as string);

                return { data: "" };
            },
            get: async (params: Params) => {
                guard("get", params);

                const file = find(params.fileId);

                if (params.alt === "media") {
                    return { data: file.body.buffer.slice(file.body.byteOffset, file.body.byteOffset + file.body.byteLength) };
                }

                return { data: describeFile(file) };
            },
            list: async (params: Params & { pageSize: number; pageToken?: string; q: string }) => {
                guard("list", params);

                const parent = unescape(/'((?:\\.|[^'\\])*)' in parents/u.exec(params.q)?.[1] ?? "");
                const key = /value='((?:\\.|[^'\\])*)'/u.exec(params.q)?.[1];
                const matching = [...files.values()].filter(
                    (file) => file.parents.includes(parent) && (key === undefined || file.appProperties.fsdkKey === unescape(key)),
                );
                const offset = Number(params.pageToken ?? 0);
                const end = offset + Math.min(params.pageSize, pageLimit);

                return {
                    data: {
                        files: matching.slice(offset, end).map((file) => describeFile(file)),
                        ...(end < matching.length && { nextPageToken: String(end) }),
                    },
                };
            },
            update: async (params: Params) => {
                guard("update", params);

                const file = find(params.fileId);

                file.body = await read(params.media);
                file.mimeType = params.requestBody?.mimeType ?? file.mimeType;
                file.appProperties = { ...file.appProperties, ...params.requestBody?.appProperties };
                file.modifiedTime = new Date().toISOString();

                return { data: describeFile(file) };
            },
        },
        permissions: { create: async () => { return { data: {} }; } },
    };

    return { add, client: client as unknown as drive_v3.Drive, files, state };
};

const createStorage = (drive: ReturnType<typeof createDrive>, store = new Map<string, GoogleDriveFile>()): GoogleDriveStorage =>
    new GoogleDriveStorage({ client: drive.client, metaStorage: new MemoryMetaStorage<GoogleDriveFile>({ store }), retryConfig: { maxRetries: 0 } });

const upload = async (storage: GoogleDriveStorage, text: string): Promise<GoogleDriveFile> => {
    const file = await storage.create({ contentType: "text/plain", metadata: { owner: "me" }, originalName: "a.txt", size: text.length });

    return storage.write({ body: Readable.from([Buffer.from(text)]), contentLength: text.length, id: file.id, start: 0 });
};

const keyed = (drive: ReturnType<typeof createDrive>, key: string): DriveFile[] => [...drive.files.values()].filter((file) => file.appProperties.fsdkKey === key);

describe("google-drive against an in-memory Drive", () => {
    it("should store a whole-file write, keep its metadata and read it back", async () => {
        expect.assertions(6);

        const drive = createDrive();
        const store = new Map<string, GoogleDriveFile>();
        const storage = createStorage(drive, store);
        const written = await upload(storage, "hello drive");

        expect(written).toMatchObject({ bytesWritten: 11, status: "completed" });
        await expect(storage.getMeta(written.id)).resolves.toMatchObject({ driveFileId: written.driveFileId, metadata: { owner: "me" }, status: "completed" });
        await expect(storage.exists({ id: written.id })).resolves.toBe(true);

        const file = await storage.get({ id: written.id });

        expect([file.content.toString(), file.contentType, file.metadata]).toStrictEqual(["hello drive", "text/plain", { owner: "me" }]);

        const { stream } = await storage.getStream({ id: written.id });

        expect(Buffer.concat((await stream.toArray()) as Buffer[]).toString()).toBe("hello drive");

        // A cold instance (empty fileId cache) resolves the key through files.list.
        const cold = createStorage(drive, store);

        await expect(cold.get({ id: written.name })).resolves.toMatchObject({ size: 11 });
    });

    it("should refuse chunks and accept the whole file after an interrupted write", async () => {
        expect.assertions(5);

        const drive = createDrive();
        const storage = createStorage(drive);
        const file = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "a.txt", size: 10 });

        await expect(
            storage.write({ body: Readable.from([Buffer.from("01234")]), contentLength: 5, id: file.id, start: 0 }),
        ).rejects.toMatchObject({ UploadErrorCode: "MethodNotAllowed" });
        await expect(
            storage.write({ body: Readable.from([Buffer.from("56789")]), contentLength: 5, id: file.id, start: 5 }),
        ).rejects.toMatchObject({ UploadErrorCode: "MethodNotAllowed" });

        const broken = new Readable({
            read() {
                this.push(Buffer.from("01234"));
                this.destroy(new Error("connection reset"));
            },
        });

        await expect(storage.write({ body: broken, contentLength: 10, id: file.id, start: 0 })).rejects.toThrow("connection reset");
        expect(drive.files.size).toBe(0);

        await storage.write({ body: Readable.from([Buffer.from("0123456789")]), contentLength: 10, id: file.id, start: 0 });

        await expect(storage.get({ id: file.id })).resolves.toMatchObject({ content: Buffer.from("0123456789") });
    });

    it("should describe objects without upload metadata, absent ones as undefined, and throw other failures", async () => {
        expect.assertions(4);

        const drive = createDrive();
        const storage = createStorage(drive);

        drive.add({ appProperties: { fsdkContentType: "image/png", fsdkKey: "logo" }, body: Buffer.alloc(7), mimeType: "image/png", name: "logo", parents: ["root"] });

        await expect(storage.getCompletedFile("logo")).resolves.toMatchObject({ contentType: "image/png", size: 7, status: "completed" });
        await expect(storage.getCompletedFile("nope")).resolves.toBeUndefined();
        await expect(storage.exists({ id: "nope" })).resolves.toBe(false);

        drive.state.fail = (method) => (method === "get" ? driveError(500) : undefined);

        await expect(storage.getCompletedFile("logo")).rejects.toThrow("Drive error 500");
    });

    it("should copy and move, leaving one file per key", async () => {
        expect.assertions(5);

        const drive = createDrive();
        const store = new Map<string, GoogleDriveFile>();
        const storage = createStorage(drive, store);
        const written = await upload(storage, "payload");

        await storage.copy(written.name, "copy");
        await storage.copy(written.name, "copy");

        expect(keyed(drive, "copy")).toHaveLength(1);
        await expect(createStorage(drive, store).get({ id: "copy" })).resolves.toMatchObject({ content: Buffer.from("payload") });

        await storage.move(written.id, "moved");

        expect(keyed(drive, written.name)).toHaveLength(0);
        expect(store.has(written.id)).toBe(false);
        await expect(storage.get({ id: "moved" })).resolves.toMatchObject({ content: Buffer.from("payload"), contentType: "text/plain" });
    });

    it("should list every page of the root folder and skip foreign files", async () => {
        expect.assertions(2);

        const drive = createDrive(2);
        const storage = createStorage(drive);

        for (const name of ["a", "b", "c", "d", "e"]) {
            drive.add({ appProperties: { fsdkKey: `dir/${name}` }, body: Buffer.from(name), mimeType: "text/plain", name, parents: ["root"] });
        }

        drive.add({ appProperties: {}, body: Buffer.alloc(1), mimeType: "text/plain", name: "unmanaged", parents: ["root"] });
        drive.add({ appProperties: { fsdkKey: "elsewhere" }, body: Buffer.alloc(1), mimeType: "text/plain", name: "elsewhere", parents: ["other"] });

        const listed = await storage.list();

        expect(listed.map((file) => file.id)).toStrictEqual(["dir/a", "dir/b", "dir/c", "dir/d", "dir/e"]);
        await expect(storage.list(3)).resolves.toHaveLength(3);
    });

    it("should delete the object with its metadata, and keep both when Drive fails", async () => {
        expect.assertions(5);

        const drive = createDrive();
        const store = new Map<string, GoogleDriveFile>();
        const storage = createStorage(drive, store);
        const kept = await upload(storage, "keep");

        drive.state.fail = (method) => (method === "delete" ? driveError(500) : undefined);

        await expect(storage.delete({ id: kept.id })).rejects.toThrow("Drive error 500");
        expect([store.has(kept.id), drive.files.size]).toStrictEqual([true, 1]);

        drive.state.fail = undefined;

        await expect(storage.delete({ id: kept.id })).resolves.toMatchObject({ status: "deleted" });
        expect([store.has(kept.id), drive.files.size]).toStrictEqual([false, 0]);

        // An upload that never received bytes has no Drive file, only metadata.
        const empty = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "e.txt", size: 3 });

        await storage.delete({ id: empty.id });

        expect(store.has(empty.id)).toBe(false);
    });

    it("should purge expired uploads", async () => {
        expect.assertions(3);

        const drive = createDrive();
        const store = new Map<string, GoogleDriveFile>();
        const storage = createStorage(drive, store);
        const old = await upload(storage, "old");
        const pending = await storage.create({ contentType: "text/plain", metadata: {}, originalName: "p.txt", size: 3 });
        const fresh = await upload(storage, "fresh");

        for (const id of [old.id, pending.id]) {
            (store.get(id) as GoogleDriveFile).createdAt = "2000-01-01T00:00:00.000Z";
        }

        const purged = await storage.purge("1h");

        expect(purged.items.map((item) => item.id).toSorted()).toStrictEqual([old.id, pending.id].toSorted());
        expect([...store.keys()]).toStrictEqual([fresh.id]);
        expect(keyed(drive, old.name)).toHaveLength(0);
    });

    it("should serve a REST upload: POST, PATCH, HEAD, PUT replace and DELETE", async () => {
        expect.assertions(6);

        const drive = createDrive();
        const rest = new RestFetch({ storage: createStorage(drive) });
        const endpoint = "https://app.local/upload";

        const created = await rest.fetch(
            new Request(endpoint, {
                headers: { "content-type": "application/octet-stream", "x-chunked-upload": "true", "x-total-size": "10" },
                method: "POST",
            }),
        );
        const location = new URL(created.headers.get("location") as string, endpoint).href;
        const patch = async (start: number, body: string): Promise<Response> =>
            rest.fetch(
                new Request(location, {
                    body,
                    headers: { "content-length": String(body.length), "content-type": "application/octet-stream", "x-chunk-offset": String(start) },
                    method: "PATCH",
                }),
            );

        // Drive takes a single request per object, so a partial chunk is refused.
        const partial = await patch(0, "01234");

        expect(partial.status).toBe(405);

        const completed = await patch(0, "0123456789");

        expect([completed.status, completed.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const head = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect([head.status, head.headers.get("x-upload-complete")]).toStrictEqual([200, "true"]);

        const put = await rest.fetch(
            new Request(location, { body: "next", headers: { "content-length": "4", "content-type": "text/plain" }, method: "PUT" }),
        );

        expect([put.status, [...drive.files.values()].map((file) => file.body.toString())]).toStrictEqual([200, ["next"]]);

        const deleted = await rest.fetch(new Request(location, { method: "DELETE" }));

        expect([deleted.status, drive.files.size]).toStrictEqual([204, 0]);

        const gone = await rest.fetch(new Request(location, { method: "HEAD" }));

        expect(gone.status).toBe(404);
    });
});
