import { rm, stat, utimes, writeFile } from "node:fs/promises";
import { basename } from "node:path";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import LocalMetaStorage from "../../../src/storage/local/local-meta-storage";
import { getMetaVersion } from "../../../src/storage/meta-storage";
import { metafile } from "../../__helpers__/config";

describe(LocalMetaStorage, () => {
    let testRoot: string;

    beforeEach(async () => {
        testRoot = temporaryDirectory();
    });

    afterEach(async () => {
        try {
            await rm(testRoot, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    it("should use default prefix and suffix for metadata file paths", () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({ directory: testRoot });
        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`${metafile.id}.META`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });

    it("should use custom prefix and suffix for metadata file paths", () => {
        expect.assertions(2);

        const meta = new LocalMetaStorage({
            directory: testRoot,
            prefix: ".",
            suffix: ".",
        });

        const metaPath = meta.getMetaPath(metafile.id);

        expect(basename(metaPath)).toBe(`.${metafile.id}.`);
        expect(meta.getIdFromPath(metaPath)).toBe(metafile.id);
    });

    describe("conditional saves", () => {
        it("should save only while the stored content still matches the version", async () => {
            expect.assertions(4);

            const meta = new LocalMetaStorage({ directory: testRoot });

            await meta.save(metafile.id, { ...metafile, bytesWritten: 0 });

            const read = await meta.get(metafile.id);
            const version = getMetaVersion(read) as string;

            expect(version).toMatch(/^[\da-f]{64}$/u);

            await meta.save(metafile.id, { ...metafile, bytesWritten: 5 });

            await expect(meta.saveIfVersion(metafile.id, { ...read, bytesWritten: 1 }, version)).resolves.toBeUndefined();
            await expect(
                meta.saveIfVersion(metafile.id, { ...read, bytesWritten: 9 }, getMetaVersion(await meta.get(metafile.id)) as string),
            ).resolves.toBeDefined();
            await expect(meta.get(metafile.id)).resolves.toStrictEqual(expect.objectContaining({ bytesWritten: 9 }));
        });

        it("should take over a lock left behind by a crashed process", async () => {
            expect.assertions(1);

            const meta = new LocalMetaStorage({ directory: testRoot });
            const lockPath = `${meta.getMetaPath(metafile.id)}.lock`;
            const past = new Date(Date.now() - 60_000);

            await writeFile(lockPath, "");
            await utimes(lockPath, past, past);

            await meta.save(metafile.id, { ...metafile });

            await expect(stat(lockPath)).rejects.toThrow("ENOENT");
        });

        it("should let exactly one of two racing processes win", async () => {
            expect.assertions(1);

            const first = new LocalMetaStorage({ directory: testRoot });
            const second = new LocalMetaStorage({ directory: testRoot });

            await first.save(metafile.id, { ...metafile });

            const version = getMetaVersion(await first.get(metafile.id)) as string;
            const results = await Promise.all([
                first.saveIfVersion(metafile.id, { ...metafile, bytesWritten: 1 }, version),
                second.saveIfVersion(metafile.id, { ...metafile, bytesWritten: 2 }, version),
            ]);

            expect(results.filter((result) => result !== undefined)).toHaveLength(1);
        });
    });
});
