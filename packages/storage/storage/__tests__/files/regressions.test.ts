/* eslint-disable max-classes-per-file -- small adapter stubs, one per regression. */
import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import { Files, sync, UploadControl } from "../../src/files";
import { objectsMatch } from "../../src/files/internal";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import type { OperationOptions } from "../../src/storage/types";
import type { RetryConfig } from "../../src/utils/retry";

type MemoryFiles = Awaited<ReturnType<MemoryStorage["list"]>>;

/** Cursor-less paging adapter (like S3): `list(limit)` always restarts and returns the first `limit` keys. */
class PagingStorage extends MemoryStorage {
    public override async list(limit = 1000, options?: OperationOptions): Promise<MemoryFiles> {
        const all = await super.list(limit, options);

        return all.toSorted((a, b) => a.id.localeCompare(b.id)).slice(0, limit);
    }
}

/** Adapter whose full pages never advance: it repeats the same keys to fill any `limit`. */
class RepeatingStorage extends MemoryStorage {
    public override async list(limit = 1000, options?: OperationOptions): Promise<MemoryFiles> {
        const all = await super.list(limit, options);

        return Array.from({ length: limit }, (_, index) => all[index % all.length]) as MemoryFiles;
    }
}

/** Same objects as MemoryStorage but with a provider-specific ETag format. */
class OtherEtagStorage extends MemoryStorage {
    public override async list(limit?: number, options?: OperationOptions): Promise<MemoryFiles> {
        const files = await super.list(limit, options);

        return files.map((file) => {
            return { ...file, ETag: `other-${String(file.ETag)}` };
        });
    }
}

class NoRangeStorage extends MemoryStorage {
    public override readonly supportsRange: boolean = false;
}

class UrlCapturingStorage extends MemoryStorage {
    public captured: (OperationOptions & Record<string, unknown>)[] = [];

    public override async getReadUrl(_key: string, options?: OperationOptions & Record<string, unknown>): Promise<string> {
        this.captured.push(options ?? {});

        return "https://example.test/read";
    }

    public override async getUploadUrl(_key: string, options?: OperationOptions & Record<string, unknown>): Promise<string> {
        this.captured.push(options ?? {});

        return "https://example.test/upload";
    }
}

const collect = async (iterable: AsyncIterable<{ key: string }>): Promise<string[]> => {
    const keys: string[] = [];

    for await (const { key } of iterable) {
        keys.push(key);
    }

    return keys;
};

describe("files regressions", () => {
    it("listAll() walks past the first page of a cursor-less paging adapter", async () => {
        expect.assertions(1);

        const initial = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [`k${String(index)}.txt`, "x"]));
        const files = new Files({ adapter: new PagingStorage({ initial }) });

        await expect(collect(files.listAll({ limit: 2 }))).resolves.toStrictEqual(["k0.txt", "k1.txt", "k2.txt", "k3.txt", "k4.txt"]);
    });

    it("listAll() throws instead of truncating when full pages stop advancing", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new RepeatingStorage({ initial: { "a.txt": "a", "b.txt": "b" } }) });

        await expect(collect(files.listAll({ limit: 2 }))).rejects.toThrow(/cannot page past 2 objects/u);
    });

    it("sync() refuses prune combined with transformKey", async () => {
        expect.assertions(2);

        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "a" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "unrelated.txt": "u" } });
        const destination = new Files({ adapter: destinationAdapter });

        await expect(sync(source, destination, { prune: true, transformKey: (key) => `mirror/${key}` })).rejects.toThrow(TypeError);
        expect([...destinationAdapter.raw.keys()]).toStrictEqual(["unrelated.txt"]);
    });

    it("sync() ignores ETag differences across adapter classes", async () => {
        expect.assertions(2);

        const source = new Files({ adapter: new OtherEtagStorage({ initial: { "same.txt": "identical" } }) });
        const destination = new Files({ adapter: new MemoryStorage({ initial: { "same.txt": "identical" } }) });

        const result = await sync(source, destination);

        expect(result.unchanged).toStrictEqual(["same.txt"]);
        expect(result.updated).toStrictEqual([]);
    });

    it("objectsMatch() compares ETags only when asked to", () => {
        expect.assertions(3);

        const source = { contentType: "text/plain", etag: "a", key: "k", size: 3 };
        const destination = { contentType: "text/plain", etag: "b", key: "k", size: 3 };

        expect(objectsMatch(source, destination)).toBe(false);
        expect(objectsMatch(source, destination, false)).toBe(true);
        expect(objectsMatch({ ...source, lastModified: 2000 }, { ...destination, lastModified: 1000 }, false)).toBe(false);
    });

    it("move() onto the same resolved key keeps the object", async () => {
        expect.assertions(2);

        const adapter = new MemoryStorage({ initial: { "a.txt": "payload" } });
        const files = new Files({ adapter });

        const result = await files.move("a.txt", "/a.txt");

        expect(result.key).toBe("a.txt");
        expect(adapter.raw.has("a.txt")).toBe(true);
    });

    it("download({ range }) rejects with METHOD_NOT_ALLOWED when the adapter has no range support", async () => {
        expect.assertions(1);

        const files = new Files({ adapter: new NoRangeStorage({ initial: { "a.txt": "payload" } }) });

        await expect(files.download("a.txt", { range: { start: 1 } })).rejects.toMatchObject({ UploadErrorCode: "MethodNotAllowed" });
    });

    it("a pause issued before the upload starts holds the body until resume()", async () => {
        expect.assertions(4);

        const adapter = new MemoryStorage();
        const files = new Files({ adapter });
        const control = new UploadControl();

        control.pause();

        let settled = false;
        const upload = files.upload("big.bin", Readable.from([Buffer.from("hello "), Buffer.from("world")]), { control, size: 11 }).then((result) => {
            settled = true;

            return result;
        });

        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });

        expect(settled).toBe(false);
        expect(control.state).toBe("paused");

        control.resume();

        await upload;

        const downloaded = await files.download("big.bin");

        expect(control.state).toBe("completed");
        expect(downloaded.body.toString("utf8")).toBe("hello world");
    });

    it("url() and signedUploadUrl() keep the default signal and the onRetry hook", async () => {
        expect.assertions(6);

        const adapter = new UrlCapturingStorage();
        const defaultController = new AbortController();
        const callController = new AbortController();
        const files = new Files({ adapter, defaults: { signal: defaultController.signal }, hooks: { onRetry: () => {} } });

        await files.url("a.txt", { expiresIn: 60, retries: 2, signal: callController.signal });
        await files.signedUploadUrl("a.txt", { contentType: "text/plain", retries: 2, signal: callController.signal });

        for (const options of adapter.captured) {
            defaultController.abort();

            // The merged signal still follows the constructor default, not just the per-call one.
            expect(options.signal?.aborted).toBe(true);
            expect((options.retries as RetryConfig).onRetry).toBeTypeOf("function");
        }

        expect(adapter.captured[0]?.expiresIn).toBe(60);
        expect(adapter.captured[1]?.contentType).toBe("text/plain");
    });
});
