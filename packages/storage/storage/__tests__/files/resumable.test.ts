import { rm } from "node:fs/promises";
import { Readable } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Files, UploadControl } from "../../src/files";
import DiskStorage from "../../src/storage/local/disk-storage";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { BaseStorage } from "../../src/storage/storage";
import { ERRORS } from "../../src/utils/errors";

const source = Buffer.from("0123456789abcdefghij");
const multipart = { partSize: 4 };

/** Process A: stores the first two parts, then dies. Returns the persisted token. */
const startAndDie = async (adapter: BaseStorage): Promise<string> => {
    const control = new UploadControl();
    const { promise: stored, resolve } = Promise.withResolvers<void>();
    const body = Readable.from(
        (async function* dying() {
            yield source.subarray(0, 8);

            await stored;

            throw new Error("process died");
        })(),
    );

    await expect(
        new Files({ adapter }).upload("dir/big.bin", body, {
            control,
            multipart,
            onProgress: ({ loaded }) => {
                if (loaded >= 8) {
                    resolve();
                }
            },
            size: source.length,
        }),
    ).rejects.toThrow("process died");

    return JSON.stringify(control);
};

const sentBytes = (write: { mock: { calls: unknown[][] } }): number =>
    write.mock.calls.reduce<number>((total, [part]) => total + ((part as { contentLength?: number }).contentLength ?? 0), 0);

describe("resumable uploads", () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        await rm(directory, { force: true, recursive: true });
    });

    it("should resume a disk upload in a new process from the shared directory", async () => {
        expect.assertions(4);

        const token = await startAndDie(new DiskStorage({ directory }));

        expect(JSON.parse(token)).toMatchObject({ key: "dir/big.bin", loaded: 8, size: source.length, uploadId: "dir/big.bin", version: 2 });

        const adapter = new DiskStorage({ directory });
        const write = vi.spyOn(adapter, "write");
        const files = new Files({ adapter });

        await files.upload("dir/big.bin", source, { control: UploadControl.from(token), multipart });

        expect(sentBytes(write)).toBe(source.length - 8);
        await expect(files.download("dir/big.bin")).resolves.toHaveProperty("body", source);
    });

    it("should resume a memory upload through a new facade over the same adapter", async () => {
        expect.assertions(4);

        const adapter = new MemoryStorage();
        const token = await startAndDie(adapter);
        const write = vi.spyOn(adapter, "write");
        const files = new Files({ adapter });
        const progress: number[] = [];

        await files.upload("dir/big.bin", Readable.from([source.subarray(8)]), {
            control: UploadControl.from(token),
            multipart,
            onProgress: ({ loaded }) => progress.push(loaded),
            resumeOffset: 8,
            size: source.length,
        });

        expect(sentBytes(write)).toBe(source.length - 8);
        expect(progress).toStrictEqual([8, 12, 16, 20]);
        await expect(files.download("dir/big.bin")).resolves.toHaveProperty("body", source);
    });

    it("should answer a resumed upload that already completed with the stored object", async () => {
        expect.assertions(1);

        const adapter = new MemoryStorage();
        const files = new Files({ adapter });
        const control = new UploadControl();

        await files.upload("done.bin", source, { control, multipart });

        await expect(files.upload("done.bin", source, { control: UploadControl.from(JSON.stringify(control)), multipart })).resolves.toHaveProperty(
            "size",
            source.length,
        );
    });

    it("should name the adapter kind in the token, also for a subclass, and accept a token naming the class", async () => {
        expect.assertions(3);

        class TenantStorage extends MemoryStorage {}

        const adapter = new TenantStorage();
        const token = await startAndDie(adapter);

        expect(JSON.parse(token)).toHaveProperty("adapter", "memory");

        // Tokens written before `storageKind` carry `constructor.name`.
        const legacy = JSON.stringify({ ...JSON.parse(token), adapter: "TenantStorage" });

        await new Files({ adapter }).upload("dir/big.bin", source, { control: UploadControl.from(legacy), multipart });

        await expect(new Files({ adapter }).download("dir/big.bin")).resolves.toHaveProperty("body", source);
    });

    it("should reject a token for another key, size or adapter", async () => {
        expect.assertions(4);

        const adapter = new MemoryStorage();
        const token = await startAndDie(adapter);
        const files = new Files({ adapter });
        const badRequest = expect.objectContaining({ UploadErrorCode: ERRORS.BAD_REQUEST });

        await expect(files.upload("other.bin", source, { control: UploadControl.from(token) })).rejects.toThrow(badRequest);
        await expect(files.upload("dir/big.bin", source.subarray(1), { control: UploadControl.from(token) })).rejects.toThrow(badRequest);
        await expect(new Files({ adapter: new DiskStorage({ directory }) }).upload("dir/big.bin", source, { control: UploadControl.from(token) })).rejects.toThrow(
            badRequest,
        );
    });

    it("should reject a body that starts past the stored offset or ends early", async () => {
        expect.assertions(3);

        const adapter = new MemoryStorage();
        const token = await startAndDie(adapter);
        const files = new Files({ adapter });

        await expect(
            files.upload("dir/big.bin", Readable.from([source.subarray(12)]), { control: UploadControl.from(token), resumeOffset: 12, size: source.length }),
        ).rejects.toHaveProperty("UploadErrorCode", ERRORS.BAD_REQUEST);
        await expect(
            files.upload("dir/big.bin", Readable.from([source.subarray(0, 10)]), { control: UploadControl.from(token), size: source.length }),
        ).rejects.toHaveProperty("UploadErrorCode", ERRORS.BAD_REQUEST);
    });

    it("should start over from a version 1 token", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new MemoryStorage() });

        await files.upload("v1.bin", source, { control: UploadControl.from({ key: "v1.bin", loaded: 8, version: 1 }) });

        await expect(files.download("v1.bin")).resolves.toHaveProperty("body", source);
    });
});
