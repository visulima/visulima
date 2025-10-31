import { Hash } from "node:crypto";
import { join } from "node:path";
import {
    afterEach, beforeEach, describe, expect, it,
} from "vitest";

import { fsp } from "../../src/utils/fs";
import RangeChecksum from "../../src/utils/range-checksum";
import RangeHasher from "../../src/utils/range-hasher";
import { testRoot as rootPath } from "../__helpers__/config";
import { cleanup } from "../__helpers__/utils";

const createTestFile = async (testRoot: string, filepath: string) => {
    await fsp.mkdir(testRoot, { recursive: true });
    await fsp.writeFile(filepath, "test", "utf8");
};

describe("utils", async () => {
    const testRoot = join(rootPath, "range-hasher");
    const filepath = join(testRoot, "file.ext");

    beforeEach(() => cleanup(testRoot));

    afterEach(() => cleanup(testRoot));

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
