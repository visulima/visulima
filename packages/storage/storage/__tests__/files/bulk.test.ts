import { describe, expect, it, vi } from "vitest";

import { Files } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import { ERRORS } from "../../src/utils/errors";

const SKIPPED = "Operation skipped (stopOnError)";

const DEFAULT_FILES: Record<string, string> = { "a.txt": "a", "c.txt": "c" };

const setup = (initial = DEFAULT_FILES): { files: Files<MemoryStorage>; storage: MemoryStorage } => {
    const storage = new MemoryStorage({ initial });

    return { files: new Files({ adapter: storage }), storage };
};

describe("files bulk operations", () => {
    describe("delete", () => {
        it("should report each failure of a batch delete under the key the caller passed", async () => {
            expect.assertions(2);

            const { files } = setup();
            const result = await files.delete(["a.txt", "missing.txt", "../escape"]);

            expect(result.deleted).toStrictEqual(["a.txt"]);
            expect(result.errors?.map(({ key }) => key).toSorted()).toStrictEqual(["../escape", "missing.txt"]);
        });

        it("should report the keys an abort left undone as aborted, not as skipped", async () => {
            expect.assertions(2);

            const { files } = setup();
            const controller = new AbortController();

            controller.abort();

            const result = await files.delete(["a.txt", "c.txt"], { signal: controller.signal });

            expect(result.deleted).toStrictEqual([]);
            expect(result.errors?.map(({ error }) => error.name)).toStrictEqual(["AbortError", "AbortError"]);
        });

        it.each([
            ["delete", (files: Files<MemoryStorage>, signal: AbortSignal) => files.delete("a.txt", { signal })],
            ["upload", (files: Files<MemoryStorage>, signal: AbortSignal) => files.upload("b.txt", "b", { signal })],
        ])("should not %s anything when the signal was aborted before the call", async (_, run) => {
            expect.assertions(2);

            const { files, storage } = setup();
            const controller = new AbortController();

            controller.abort();

            await expect(run(files, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
            expect([...storage.raw.keys()].toSorted()).toStrictEqual(["a.txt", "c.txt"]);
        });

        it("should answer without errors when every key was deleted", async () => {
            expect.assertions(1);

            const { files } = setup();

            await expect(files.delete(["a.txt", "c.txt"])).resolves.toStrictEqual({ deleted: ["a.txt", "c.txt"] });
        });

        it("should stop at the first failure with stopOnError and report the keys it skipped", async () => {
            expect.assertions(3);

            const { files, storage } = setup();
            const result = await files.delete(["missing.txt", "a.txt"], { concurrency: 1, stopOnError: true });

            expect(result.deleted).toStrictEqual([]);
            expect(result.errors?.map(({ error, key }) => [key, error.message])).toStrictEqual([
                ["missing.txt", expect.any(String)],
                ["a.txt", SKIPPED],
            ]);
            await expect(storage.exists({ id: "a.txt" })).resolves.toBe(true);
        });

        it("should delete one by one with stopOnError while nothing fails", async () => {
            expect.assertions(1);

            const { files } = setup();

            await expect(files.delete(["a.txt", "c.txt"], { stopOnError: true })).resolves.toStrictEqual({ deleted: ["a.txt", "c.txt"] });
        });
    });

    describe("exists, head, download and move", () => {
        it("should sort keys into existing and missing, and report the ones that fail", async () => {
            expect.assertions(2);

            const { files } = setup();

            await expect(files.exists(["a.txt", "missing.txt"])).resolves.toStrictEqual({ existing: ["a.txt"], missing: ["missing.txt"] });

            const { storage } = setup();

            vi.spyOn(storage, "exists").mockRejectedValueOnce(new Error("backend down"));

            await expect(new Files({ adapter: storage }).exists(["a.txt", "c.txt"], { concurrency: 1 })).resolves.toStrictEqual({
                errors: [expect.objectContaining({ key: "a.txt" })],
                existing: ["c.txt"],
                missing: [],
            });
        });

        it("should report the keys stopOnError skipped for head, download and move", async () => {
            expect.assertions(3);

            const { files } = setup();
            const options = { concurrency: 1, stopOnError: true };
            const skipped = (result: { errors?: { error: Error; key: string }[] }): string[] =>
                (result.errors ?? []).filter(({ error }) => error.message === SKIPPED).map(({ key }) => key);

            expect(skipped(await files.head(["missing.txt", "a.txt"], options))).toStrictEqual(["a.txt"]);
            expect(skipped(await files.download(["missing.txt", "a.txt"], options))).toStrictEqual(["a.txt"]);
            expect(
                skipped(
                    await files.move(
                        [
                            { from: "missing.txt", to: "x.txt" },
                            { from: "a.txt", to: "y.txt" },
                        ],
                        options,
                    ),
                ),
            ).toStrictEqual(["a.txt"]);
        });
    });

    describe("upload", () => {
        it("should report progress per item under its key, and skip the rest after a failure with stopOnError", async () => {
            expect.assertions(3);

            const { files, storage } = setup({});
            const progress = vi.fn();

            const ok = await files.upload([{ body: "hello", key: "one.txt" }], { onProgress: progress });

            expect(ok.uploaded.map(({ key }) => key)).toStrictEqual(["one.txt"]);
            expect(progress).toHaveBeenCalledWith(expect.objectContaining({ key: "one.txt" }));

            vi.spyOn(storage, "create").mockRejectedValueOnce(new Error("quota exceeded"));

            const failed = await files.upload(
                [
                    { body: "a", key: "two.txt" },
                    { body: "b", key: "three.txt" },
                ],
                { concurrency: 1, stopOnError: true },
            );

            expect(failed.errors?.map(({ error, key }) => [key, error.message])).toStrictEqual([
                ["two.txt", "quota exceeded"],
                ["three.txt", SKIPPED],
            ]);
        });

        it("should refuse custom metadata on an adapter that cannot store it", async () => {
            expect.assertions(1);

            const { files, storage } = setup({});

            Object.defineProperty(storage, "supportsMetadata", { value: false });

            await expect(files.upload("a.txt", "x", { metadata: { owner: "u1" } })).rejects.toStrictEqual(
                expect.objectContaining({ UploadErrorCode: ERRORS.METHOD_NOT_ALLOWED }),
            );
        });
    });

    describe("download ranges", () => {
        it("should refuse a negative start or an end before the start", async () => {
            expect.assertions(3);

            const { files } = setup({ "a.txt": "0123456789" });

            await expect(files.download("a.txt", { range: { start: -1 } })).rejects.toThrow(TypeError);
            await expect(files.download("a.txt", { range: { end: 1, start: 5 } })).rejects.toThrow(TypeError);
            await expect(files.download("a.txt", { range: { end: 5, start: 2 } })).resolves.toStrictEqual(
                expect.objectContaining({ body: Buffer.from("2345") }),
            );
        });
    });
});
