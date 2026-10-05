import { readFile, rm, utimes, writeFile } from "node:fs/promises";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LocalMetaStorage from "../../../src/storage/local/local-meta-storage";
import { File } from "../../../src/storage/utils/file";

/** Runs before each lock removal or metafile rename the meta storage does, to interleave another process. */
const hooks = vi.hoisted(() => {
    return { beforeRemove: undefined as ((path: string) => Promise<void>) | undefined };
});

vi.mock(import("node:fs/promises"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        rename: async (...arguments_: Parameters<typeof actual.rename>) => {
            await hooks.beforeRemove?.(String(arguments_[0]));

            return actual.rename(...arguments_);
        },
        unlink: async (...arguments_: Parameters<typeof actual.unlink>) => {
            await hooks.beforeRemove?.(String(arguments_[0]));

            return actual.unlink(...arguments_);
        },
    };
});

describe("localMetaStorage file lock", () => {
    let directory: string;

    beforeEach(() => {
        directory = temporaryDirectory();
    });

    afterEach(async () => {
        hooks.beforeRemove = undefined;
        await rm(directory, { force: true, recursive: true });
    });

    const createFile = (): File => new File({ contentType: "text/plain", id: "upload", metadata: {}, originalName: "a.txt", size: 1 });

    it("should not release a lock another process took over while the save ran", async () => {
        expect.assertions(1);

        const meta = new LocalMetaStorage({ directory });
        const lockPath = `${meta.getMetaPath("upload")}.lock`;

        hooks.beforeRemove = async (path) => {
            // The metafile lands while the lock is held: another process takes the lock over now.
            if (path.endsWith(".tmp")) {
                hooks.beforeRemove = undefined;
                await writeFile(lockPath, "other-owner");
            }
        };

        await meta.save("upload", createFile());

        await expect(readFile(lockPath, "utf8")).resolves.toBe("other-owner");
    });

    it("should leave the live lock of a waiter that took a stale lock over first", async () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({ directory });
        const lockPath = `${meta.getMetaPath("upload")}.lock`;
        const past = new Date(Date.now() - 60_000);
        let replaced = false;

        await meta.save("upload", createFile());
        await writeFile(lockPath, "stale");
        await utimes(lockPath, past, past);

        hooks.beforeRemove = async (path) => {
            // Between this waiter's staleness check and its removal, another waiter takes the stale lock over.
            if (path === lockPath && !replaced) {
                replaced = true;
                await writeFile(lockPath, "live");
            }
        };

        const saved = meta.save("upload", createFile());

        await vi.waitFor(() => {
            if (!replaced) {
                throw new Error("not taken over yet");
            }
        });
        await new Promise((resolve) => {
            setTimeout(resolve, 50);
        });

        await expect(readFile(lockPath, "utf8")).resolves.toBe("live");

        // The other waiter finishes; this one acquires the lock then.
        hooks.beforeRemove = undefined;
        await rm(lockPath);

        await expect(saved).resolves.toBeDefined();
    });
});
