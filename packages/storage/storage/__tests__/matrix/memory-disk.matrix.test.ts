import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe } from "vitest";

import DiskStorage from "../../src/storage/local/disk-storage";
import MemoryStorage from "../../src/storage/memory/memory-storage";
import { describeMatrix } from "../__helpers__/matrix";

describe("memory storage matrix", () => {
    describeMatrix({
        resumable: true,
        setup: () => {
            let storage: MemoryStorage;

            return {
                createStorage: (options) => {
                    storage = new MemoryStorage({ ...options });

                    return storage;
                },
                hasObject: (key) => storage.raw.has(key),
                putObject: (key, content) => {
                    const now = new Date().toISOString();

                    storage.raw.set(key, {
                        bytes: Buffer.from(content),
                        contentType: "text/plain",
                        createdAt: now,
                        eTag: '"app"',
                        metadata: {},
                        modifiedAt: now,
                    });
                },
            };
        },
    });
});

describe("disk storage matrix", () => {
    describeMatrix({
        resumable: true,
        setup: async () => {
            const directory = await mkdtemp(join(tmpdir(), "storage-matrix-"));

            return {
                cleanup: async () => rm(directory, { force: true, recursive: true }),
                createStorage: (options) => new DiskStorage({ directory, ...options }),
                hasObject: (key) => existsSync(join(directory, key)),
                putObject: async (key, content) => writeFile(join(directory, key), content),
            };
        },
    });
});
