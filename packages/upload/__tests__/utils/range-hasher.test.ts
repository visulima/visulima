import { Hash } from "node:crypto";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import RangeChecksum from "../../src/utils/range-checksum";
import RangeHasher from "../../src/utils/range-hasher";
import { testRoot as rootPath } from "../__helpers__/config";

const createTestFile = async (testRoot: string, filepath: string) => {
    await mkdir(testRoot, { recursive: true });
    await writeFile(filepath, "test", "utf8");
};

describe("utils", async () => {
    const testRoot = join(rootPath, "range-hasher");
    const filepath = join(testRoot, "file.ext");

    beforeEach(async () => {
        try {
            await rm(testRoot, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    afterEach(async () => {
        try {
            await rm(testRoot, { force: true, recursive: true });
        } catch {
            // ignore if directory doesn't exist
        }
    });

    describe("range-hasher", async () => {
        it("hex", async () => {
            await createTestFile(testRoot, filepath);

            const rangeHasher = new RangeHasher();

            expect(rangeHasher.hex(filepath)).toBe("");

            await rangeHasher.updateFromFs(filepath, 0);

            expect(rangeHasher.hex(filepath)).toBe("a94a8fe5ccb19ba61c4c0873d391e987982fbbd3");
        });

        it("base64", async () => {
            await createTestFile(testRoot, filepath);

            const rangeHasher = new RangeHasher();

            expect(rangeHasher.base64(filepath)).toBe("");

            await rangeHasher.updateFromFs(filepath, 0);

            // eslint-disable-next-line no-secrets/no-secrets
            expect(rangeHasher.base64(filepath)).toBe("qUqP5cyxm6YcTAhz05Hph5gvu9M=");
        });

        it("digester", () => {
            const rangeHasher = new RangeHasher();

            expect(rangeHasher.digester(filepath)).toBeInstanceOf(RangeChecksum);
        });

        it("updateFromFs", async () => {
            await createTestFile(testRoot, filepath);

            const rangeHasher = new RangeHasher();

            const hash = await rangeHasher.updateFromFs(filepath);

            expect(hash).toBeInstanceOf(Hash);
            expect(rangeHasher.get(filepath)).toBeInstanceOf(Hash);
            expect(rangeHasher.get(filepath)).toBe(hash);
        });
    });
});
