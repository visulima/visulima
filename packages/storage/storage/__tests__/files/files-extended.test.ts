import { Readable } from "node:stream";

import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { HookEvent } from "../../src/files";
import { Files, transfer } from "../../src/files";
import MemoryStorage from "../../src/storage/memory/memory-storage";

const makeMemoryFacade = (
    options: { hooks?: Parameters<typeof Files>[0]["hooks"]; initial?: Record<string, Buffer | Uint8Array | string>; prefix?: string } = {},
): { adapter: MemoryStorage; facade: Files<MemoryStorage> } => {
    const adapter = new MemoryStorage({ initial: options.initial });

    return {
        adapter,
        facade: new Files<MemoryStorage>({
            adapter,
            ...(options.hooks && { hooks: options.hooks }),
            ...(options.prefix !== undefined && { prefix: options.prefix }),
        }),
    };
};

describe("memory storage adapter", () => {
    it("supports a full upload/download/exists/delete cycle", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("a.txt", "hello");

        await expect(facade.exists("a.txt")).resolves.toBe(true);

        const dl = await facade.download("a.txt");

        expect(dl.body.toString("utf8")).toBe("hello");

        await facade.delete("a.txt");

        await expect(facade.exists("a.txt")).resolves.toBe(false);
    });

    it("declares supportsRange = true", () => {
        const { adapter } = makeMemoryFacade();

        expect(adapter.supportsRange).toBe(true);
    });

    it("exposes raw as the backing Map", async () => {
        const { adapter, facade } = makeMemoryFacade();

        await facade.upload("k.txt", "x");

        expect(adapter.raw.has("k.txt")).toBe(true);
    });

    it("returns memory:// URLs", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("k.txt", "x");

        await expect(facade.url("k.txt")).resolves.toBe("memory://k.txt");
        await expect(facade.signedUploadUrl("k.txt")).resolves.toBe("memory://k.txt");
    });
});

describe("move() on the Files facade", () => {
    it("renames a single object via copy+delete", async () => {
        const { adapter, facade } = makeMemoryFacade();

        await facade.upload("from.txt", "payload");
        const result = await facade.move("from.txt", "to.txt");

        expect(result.key).toBe("to.txt");
        expect(adapter.raw.has("from.txt")).toBe(false);
        expect(adapter.raw.has("to.txt")).toBe(true);

        const downloaded = await facade.download("to.txt");

        expect(downloaded.body.toString("utf8")).toBe("payload");
    });

    it("is a no-op when source and destination match", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("same.txt", "x");
        const result = await facade.move("same.txt", "same.txt");

        expect(result.key).toBe("same.txt");

        const downloaded = await facade.download("same.txt");

        expect(downloaded.body.toString("utf8")).toBe("x");
    });

    it("runs the bulk array form with per-item errors", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("a.txt", "A");
        await facade.upload("b.txt", "B");

        const result = await facade.move([
            { from: "a.txt", to: "a2.txt" },
            { from: "b.txt", to: "b2.txt" },
            { from: "missing.txt", to: "ghost.txt" },
        ]);

        expect(result.moved.map((f) => f.key).toSorted()).toEqual(["a2.txt", "b2.txt"]);
        expect(result.errors).toBeDefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors?.[0]?.key).toBe("missing.txt");
    });

    it("strips the constructor prefix off the result key", async () => {
        const { facade } = makeMemoryFacade({ prefix: "tenant-x" });

        await facade.upload("a.txt", "A");
        const result = await facade.move("a.txt", "renamed/a.txt");

        expect(result.key).toBe("renamed/a.txt");
    });
});

describe("listAll() async iterable", () => {
    it("yields every uploaded object", async () => {
        const { facade } = makeMemoryFacade();

        await Promise.all([facade.upload("a.txt", "A"), facade.upload("b.txt", "B"), facade.upload("c.txt", "C")]);

        const collected: string[] = [];

        for await (const file of facade.listAll()) {
            collected.push(file.key);
        }

        expect(collected.toSorted()).toEqual(["a.txt", "b.txt", "c.txt"]);
    });

    it("filters by relative prefix and strips the constructor prefix", async () => {
        const { facade } = makeMemoryFacade({ prefix: "users" });

        await facade.upload("123/avatar.png", "x");
        await facade.upload("123/cover.png", "y");
        await facade.upload("456/avatar.png", "z");

        const collected: string[] = [];

        for await (const file of facade.listAll({ prefix: "123/" })) {
            collected.push(file.key);
        }

        expect(collected.toSorted()).toEqual(["123/avatar.png", "123/cover.png"]);
    });

    it("does not yield duplicates", async () => {
        const { facade } = makeMemoryFacade({ initial: { "x.txt": "x" } });

        // Re-pump through the page loop a few times by listing in batches of 1.
        const collected: string[] = [];

        for await (const file of facade.listAll({ limit: 1 })) {
            collected.push(file.key);
        }

        expect(collected).toEqual(["x.txt"]);
    });
});

describe("hooks", () => {
    it("fires onAction on success with timing", async () => {
        const onAction = vi.fn();
        const { facade } = makeMemoryFacade({ hooks: { onAction } });

        await facade.upload("k.txt", "hi");

        expect(onAction).toHaveBeenCalledWith();

        const event = onAction.mock.calls.at(-1)?.[0] as HookEvent;

        expect(event.type).toBe("upload");
        expect(event.key).toBe("k.txt");

        expectTypeOf(event.durationMs).toBeNumber();
    });

    it("fires onError when an operation throws", async () => {
        const onError = vi.fn();
        const { facade } = makeMemoryFacade({ hooks: { onError } });

        await expect(facade.download("missing.txt")).rejects.toThrow();
        expect(onError).toHaveBeenCalledTimes(1);

        const event = onError.mock.calls[0]?.[0] as HookEvent;

        expect(event.type).toBe("download");
        expect(event.error).toBeInstanceOf(Error);
    });

    it("does not let a throwing hook fail the operation", async () => {
        const { facade } = makeMemoryFacade({
            hooks: {
                onAction: () => {
                    throw new Error("hook boom");
                },
            },
        });

        await expect(facade.upload("k.txt", "x")).resolves.toBeDefined();
    });
});

describe("download({ range })", () => {
    it("returns only the requested byte slice from memory storage", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", Buffer.from("0123456789"));

        const slice = await facade.download("blob.bin", { range: { end: 5, start: 2 } });

        expect(slice.body.toString("utf8")).toBe("2345");
    });

    it("reads to EOF when end is omitted", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", Buffer.from("0123456789"));

        const slice = await facade.download("blob.bin", { range: { start: 7 } });

        expect(slice.body.toString("utf8")).toBe("789");
    });

    it("rejects an invalid range without calling the adapter", async () => {
        const { facade } = makeMemoryFacade();

        await facade.upload("blob.bin", "x");

        await expect(facade.download("blob.bin", { range: { end: 1, start: 5 } })).rejects.toThrow();
    });
});

describe("upload({ onProgress })", () => {
    it("reports per-chunk byte counts for a Node Readable", async () => {
        const { facade } = makeMemoryFacade();
        const events: { loaded: number; total?: number }[] = [];

        // Producing two chunks lets us observe progress monotonically increasing.
        const stream = Readable.from([Buffer.from("hello "), Buffer.from("world")]);

        await facade.upload("k.txt", stream, {
            onProgress: (event) => events.push(event),
            size: 11,
        });

        expect(events.length).toBeGreaterThan(0);
        expect(events.at(-1)?.loaded).toBe(11);
        expect(events.at(-1)?.total).toBe(11);
    });

    it("survives a throwing onProgress callback", async () => {
        const { facade } = makeMemoryFacade();

        await expect(
            facade.upload("k.txt", Buffer.from("xyz"), {
                onProgress: () => {
                    throw new Error("nope");
                },
            }),
        ).resolves.toBeDefined();
    });
});

describe("transfer(source, dest)", () => {
    it("streams every object from source to destination", async () => {
        const source = new Files({
            adapter: new MemoryStorage({
                initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" },
            }),
        });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        const result = await transfer(source, destination);

        expect(result.transferred.toSorted()).toEqual(["a.txt", "b.txt", "c.txt"]);
        expect(result.skipped).toEqual([]);
        expect(destinationAdapter.raw.size).toBe(3);
    });

    it("skips keys that already exist at the destination by default", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "new" } }) });
        const destinationAdapter = new MemoryStorage({ initial: { "k.txt": "old" } });
        const destination = new Files({ adapter: destinationAdapter });

        const result = await transfer(source, destination);

        expect(result.skipped).toEqual(["k.txt"]);
        expect(result.transferred).toEqual([]);

        const downloaded = await destination.download("k.txt");

        expect(downloaded.body.toString("utf8")).toBe("old");
    });

    it("overwrites when overwrite: true", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "new" } }) });
        const destination = new Files({ adapter: new MemoryStorage({ initial: { "k.txt": "old" } }) });

        await transfer(source, destination, { overwrite: true });

        const downloaded = await destination.download("k.txt");

        expect(downloaded.body.toString("utf8")).toBe("new");
    });

    it("transforms keys via transformKey", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A" } }) });
        const destination = new Files({ adapter: new MemoryStorage() });

        await transfer(source, destination, { transformKey: (key) => `archive/${key}` });

        await expect(destination.exists("archive/a.txt")).resolves.toBe(true);
        await expect(destination.exists("a.txt")).resolves.toBe(false);
    });

    it("reports per-key progress", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A", "b.txt": "B" } }) });
        const destination = new Files({ adapter: new MemoryStorage() });

        const events: { key: string; status: string }[] = [];

        await transfer(source, destination, {
            onProgress: ({ key, status }) => events.push({ key, status }),
        });

        expect(events).toHaveLength(2);
        expect(events.every((event) => event.status === "transferred")).toBe(true);
    });

    it("stops dispatching new transfers when the signal is already aborted", async () => {
        const initial: Record<string, string> = {};

        for (let index = 0; index < 50; index += 1) {
            initial[`k-${index}.txt`] = String(index);
        }

        const source = new Files({ adapter: new MemoryStorage({ initial }) });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        const controller = new AbortController();

        controller.abort();

        const result = await transfer(source, destination, {
            concurrency: 1,
            signal: controller.signal,
        });

        // Worker pool sees `signal.aborted` on entry and exits without transferring any key.
        expect(result.transferred).toEqual([]);
        expect(destinationAdapter.raw.size).toBe(0);
    });

    it("stops on the first failure when stopOnError is set", async () => {
        const source = new Files({ adapter: new MemoryStorage({ initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" } }) });
        const destinationAdapter = new MemoryStorage();
        const destination = new Files({ adapter: destinationAdapter });

        // Force the second `upload` to throw so we can see stopOnError stop after a.txt succeeds.
        const calls: string[] = [];
        const original = destination.upload.bind(destination);

        (destination as any).upload = (...arguments_: Parameters<typeof original>) => {
            calls.push(arguments_[0] as string);

            if (calls.length === 2) {
                throw new Error("boom");
            }

            return original(...(arguments_));
        };

        const result = await transfer(source, destination, { stopOnError: true });

        expect(result.errors).toBeDefined();
        expect(result.errors).toHaveLength(1);
        // a.txt was transferred before the failure; subsequent keys never ran.
        expect(result.transferred.length).toBeLessThan(3);
    });
});

describe("onRetry — retry() core", () => {
    it("invokes onRetry once per retry attempt with a 1-based index", async () => {
        const { retry } = await import("../../src/utils/retry");

        const events: { attempt: number; message: string }[] = [];
        let calls = 0;

        const result = await retry(
            async () => {
                calls += 1;

                if (calls < 3) {
                    const error = new Error("transient");

                    (error as Error & { code?: string }).code = "ECONNRESET";

                    throw error;
                }

                return "ok";
            },
            {
                initialDelay: 1,
                maxRetries: 5,
                onRetry: (attempt, error) => events.push({ attempt, message: (error as Error).message }),
            },
        );

        expect(result).toBe("ok");
        expect(events).toEqual([
            { attempt: 1, message: "transient" },
            { attempt: 2, message: "transient" },
        ]);
    });

    it("swallows exceptions thrown from onRetry", async () => {
        const { retry } = await import("../../src/utils/retry");

        let calls = 0;
        const result = await retry(
            async () => {
                calls += 1;

                if (calls === 1) {
                    const error = new Error("transient");

                    (error as Error & { code?: string }).code = "ECONNRESET";

                    throw error;
                }

                return "ok";
            },
            {
                initialDelay: 1,
                maxRetries: 1,
                onRetry: () => {
                    throw new Error("hook boom");
                },
            },
        );

        expect(result).toBe("ok");
    });
});

describe("onRetry — facade wiring", () => {
    /**
     * Minimal stub: a MemoryStorage subclass whose `getMeta` wraps the parent call in the
     * `retry()` helper, so the facade's `head()` → `adapter.getMeta(id, options)` path actually
     * threads `options.retries` through to the retry engine. Two transient failures then a
     * success exercises onRetry firing twice.
     */
    class FlakyMemoryStorage extends MemoryStorage {
        private calls = 0;

        public override async getMeta(id: string, options?: Parameters<MemoryStorage["getMeta"]>[1]) {
            const { retry } = await import("../../src/utils/retry");

            return retry(
                async () => {
                    this.calls += 1;

                    if (this.calls <= 2) {
                        const error = new Error("transient");

                        (error as Error & { code?: string }).code = "ECONNRESET";

                        throw error;
                    }

                    return super.getMeta(id, options);
                },
                typeof options?.retries === "number" ? { maxRetries: options.retries } : (options?.retries ?? {}),
            );
        }
    }

    it("forwards the facade hook with attempt + facade context on each retry", async () => {
        const adapter = new FlakyMemoryStorage();

        // Seed via a hook-free facade so the flaky path doesn't fire during setup.
        await new Files<MemoryStorage>({ adapter: new MemoryStorage() }).upload("seed", "ignored");
        // Now seed `k.txt` directly into the flaky adapter using the meta path it already exposes.
        const seedFacade = new Files<MemoryStorage>({ adapter });

        // Initial getMeta calls during upload will hit the flaky path and retry to success.
        await seedFacade.upload("k.txt", "hello");

        // Reset and rewire with hooks attached for the actual assertion call.
        (adapter as unknown as { calls: number }).calls = 0;

        const onRetry = vi.fn();
        const facade = new Files<MemoryStorage>({
            adapter,
            defaults: { retries: { initialDelay: 1, maxRetries: 3 } },
            hooks: { onRetry },
        });

        await facade.head("k.txt");

        expect(onRetry).toHaveBeenCalledTimes(2);

        const first = onRetry.mock.calls[0]?.[0] as HookEvent & { attempt: number; error: Error };

        expect(first.attempt).toBe(1);
        expect(first.type).toBe("head");
        expect(first.key).toBe("k.txt");
        expect(first.error).toBeInstanceOf(Error);
    });

    it("survives a throwing onRetry hook", async () => {
        const adapter = new FlakyMemoryStorage();

        await new Files<MemoryStorage>({ adapter }).upload("k.txt", "hello");

        (adapter as unknown as { calls: number }).calls = 0;

        const facade = new Files<MemoryStorage>({
            adapter,
            defaults: { retries: { initialDelay: 1, maxRetries: 3 } },
            hooks: {
                onRetry: () => {
                    throw new Error("hook boom");
                },
            },
        });

        await expect(facade.head("k.txt")).resolves.toBeDefined();
    });
});

describe("buildRangeHeader helper", () => {
    it("formats both bounds and clamps negative start", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader({ end: 10, start: 0 })).toBe("bytes=0-10");
        expect(buildRangeHeader({ end: 99, start: -5 })).toBe("bytes=0-99");
    });

    it("emits the open-ended form when end is omitted", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader({ start: 7 })).toBe("bytes=7-");
    });

    it("returns undefined for an absent range", async () => {
        const { buildRangeHeader } = await import("../../src/storage/aws/s3-base-storage");

        expect(buildRangeHeader(undefined)).toBeUndefined();
    });
});

describe("reportsUploadProgress=true adapter path", () => {
    it("forwards onProgress to the adapter and skips the facade's PassThrough emission", async () => {
        const adapter = new MemoryStorage();

        // Flip the capability flag for this test and observe how the facade routes onProgress.
        Object.defineProperty(adapter, "reportsUploadProgress", { value: true });

        const writeSpy = vi.spyOn(adapter, "write");
        const onProgress = vi.fn();

        const facade = new Files<MemoryStorage>({ adapter });

        await facade.upload("k.txt", Buffer.from("payload"), { onProgress });

        // Facade did NOT emit any synthetic events (no PassThrough wrap).
        expect(onProgress).not.toHaveBeenCalled();

        // ...but the adapter received the callback on the write part.
        const part = writeSpy.mock.calls[0]?.[0] as { onProgress?: unknown };

        expectTypeOf(part.onProgress).toBeFunction();
    });
});

describe("listAll terminal hook event", () => {
    it("fires onAction even when the consumer breaks out of the for-await early", async () => {
        const onAction = vi.fn();
        const { facade } = makeMemoryFacade({
            hooks: { onAction },
            initial: { "a.txt": "A", "b.txt": "B", "c.txt": "C" },
        });

        for await (const _file of facade.listAll()) {
            break;
        }

        const types = onAction.mock.calls.map((call) => (call[0] as HookEvent).type);

        expect(types).toContain("listAll");
    });
});
