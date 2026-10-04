import { rm } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, describe, expect, it } from "vitest";

import { Files } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import DiskStorageWithChecksum from "../../src/storage/local/disk-storage-with-checksum";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { BaseStorage } from "../../src/storage/storage";
import { ERRORS } from "../../src/utils/errors";

const directories: string[] = [];

const adapters: [string, () => BaseStorage][] = [
    ["MemoryStorage", () => new MemoryStorage()],
    [
        "DiskStorage",
        () => {
            const directory = temporaryDirectory();

            directories.push(directory);

            return new DiskStorage({ directory, maxUploadSize: "10MB" });
        },
    ],
    [
        "DiskStorageWithChecksum",
        () => {
            const directory = temporaryDirectory();

            directories.push(directory);

            return new DiskStorageWithChecksum({ directory, maxUploadSize: "10MB" });
        },
    ],
];

const precondition = expect.objectContaining({ UploadErrorCode: ERRORS.PRECONDITION_FAILED });

const text = async (files: Files, key: string): Promise<string> => {
    const { body } = await files.download(key);

    return body.toString();
};

const etagOf = async (files: Files, key: string): Promise<string> => {
    const { etag } = await files.download(key);

    return etag as string;
};

describe.each(adapters)("conditional operations on %s", (_name, createAdapter) => {
    afterEach(async () => {
        await Promise.all(directories.splice(0).map(async (directory) => rm(directory, { force: true, recursive: true })));
    });

    it("should advertise every conditional primitive", () => {
        expect.assertions(1);

        expect(new Files({ adapter: createAdapter() }).capabilities.conditional).toStrictEqual({
            copy: true,
            create: true,
            delete: true,
            read: true,
            replace: true,
        });
    });

    it("should create only when the key is absent", async () => {
        expect.assertions(4);

        const files = new Files({ adapter: createAdapter() });
        const created = await files.upload("a.txt", "one", { ifNoneMatch: "*" });

        expect(created.etag).toBeDefined();
        await expect(files.upload("a.txt", "two", { ifNoneMatch: "*" })).rejects.toThrow(precondition);
        await expect(text(files, "a.txt")).resolves.toBe("one");
        await expect(files.head("a.txt")).resolves.toMatchObject({ etag: created.etag, size: 3 });
    });

    it("should replace only the expected generation and leave the object on a mismatch", async () => {
        expect.assertions(5);

        const files = new Files({ adapter: createAdapter() });
        const first = await files.upload("a.txt", "first");
        const { etag } = await files.download("a.txt");
        const replaced = await files.upload("a.txt", "second!", { ifMatch: etag as string });

        expect(replaced.etag).not.toBe(etag);
        await expect(text(files, "a.txt")).resolves.toBe("second!");
        // The first generation is gone, so its ETag no longer matches.
        await expect(files.upload("a.txt", "third", { ifMatch: etag as string })).rejects.toThrow(precondition);
        await expect(text(files, "a.txt")).resolves.toBe("second!");
        await expect(files.upload("missing.txt", "x", { ifMatch: first.etag ?? "nope" })).rejects.toThrow(precondition);
    });

    it("should read, head and delete exactly the expected generation", async () => {
        expect.assertions(6);

        const files = new Files({ adapter: createAdapter() });

        await files.upload("a.txt", "hello");

        const { etag } = await files.download("a.txt");
        const quoted = `"${(etag as string).replaceAll('"', "")}"`;

        await expect(files.download("a.txt", { ifMatch: quoted })).resolves.toMatchObject({ size: 5 });
        await expect(files.head("a.txt", { ifMatch: etag as string })).resolves.toMatchObject({ key: "a.txt" });
        await expect(files.download("a.txt", { ifMatch: "other" })).rejects.toThrow(precondition);
        await expect(files.head("a.txt", { ifMatch: "other" })).rejects.toThrow(precondition);
        await expect(files.delete("a.txt", { ifMatch: "other" })).rejects.toThrow(precondition);

        await files.delete("a.txt", { ifMatch: etag as string });

        await expect(files.exists("a.txt")).resolves.toBe(false);
    });

    it("should copy only when the source and destination predicates hold", async () => {
        expect.assertions(5);

        const files = new Files({ adapter: createAdapter() });

        await files.upload("src.txt", "source");
        await files.upload("taken.txt", "taken");

        const source = await etagOf(files, "src.txt");

        await expect(files.copy("src.txt", "dst.txt", { sourceIfMatch: "stale" })).rejects.toThrow(precondition);
        await expect(files.copy("src.txt", "taken.txt", { ifNoneMatch: "*", sourceIfMatch: source })).rejects.toThrow(precondition);
        await expect(text(files, "taken.txt")).resolves.toBe("taken");

        await files.copy("src.txt", "dst.txt", { ifNoneMatch: "*", sourceIfMatch: source });

        await expect(text(files, "dst.txt")).resolves.toBe("source");

        const taken = await etagOf(files, "taken.txt");

        await files.copy("src.txt", "taken.txt", { ifMatch: taken });

        await expect(text(files, "taken.txt")).resolves.toBe("source");
    });

    it("should reject malformed predicates before any I/O", async () => {
        expect.assertions(4);

        const files = new Files({ adapter: createAdapter() });
        const badRequest = expect.objectContaining({ UploadErrorCode: ERRORS.BAD_REQUEST });

        await expect(files.upload("a.txt", "x", { ifMatch: "a", ifNoneMatch: "*" })).rejects.toThrow(badRequest);
        await expect(files.upload("a.txt", "x", { ifNoneMatch: "abc" as "*" })).rejects.toThrow(badRequest);
        await expect(files.download("a.txt", { ifMatch: 'W/"weak"' })).rejects.toThrow(badRequest);
        await expect(files.delete("a.txt", { ifMatch: "a,b" })).rejects.toThrow(badRequest);
    });
});

describe("conditional operations on an adapter without native support", () => {
    it("should reject every predicate with METHOD_NOT_ALLOWED instead of ignoring it", async () => {
        expect.assertions(6);

        class PlainStorage extends MemoryStorage {
            public override readonly conditionalSupport = { copy: false, create: false, delete: false, read: false, replace: false };
        }

        const adapter = new PlainStorage();
        const files = new Files({ adapter });
        const notAllowed = expect.objectContaining({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED });

        await files.upload("a.txt", "x");

        await expect(files.upload("a.txt", "y", { ifNoneMatch: "*" })).rejects.toThrow(notAllowed);
        await expect(files.upload("a.txt", "y", { ifMatch: "e" })).rejects.toThrow(notAllowed);
        await expect(files.download("a.txt", { ifMatch: "e" })).rejects.toThrow(notAllowed);
        await expect(files.delete("a.txt", { ifMatch: "e" })).rejects.toThrow(notAllowed);
        await expect(files.copy("a.txt", "b.txt", { sourceIfMatch: "e" })).rejects.toThrow(notAllowed);
        await expect(text(files, "a.txt")).resolves.toBe("x");
    });
});
