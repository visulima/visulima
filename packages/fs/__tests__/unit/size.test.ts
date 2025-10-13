import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { brotliSize, brotliSizeSync, gzipSize, gzipSizeSync, rawSize, rawSizeSync } from "../../src/size";

const fixtureFileContent = "Hello, World!";

describe("size functions", () => {
    let distribution: string;
    let distributionFile: string;

    beforeEach(async () => {
        distribution = temporaryDirectory();
        distributionFile = join(distribution, "file.txt");

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await writeFile(distributionFile, fixtureFileContent, "utf8");
    });

    afterEach(async () => {
        await rm(distribution, { recursive: true });
    });

    describe(gzipSize, () => {
        it("should get size of string", async () => {
            expect.assertions(1);

            const size = await gzipSize(fixtureFileContent);
            const expectedSize = gzipSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of buffer", async () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = await gzipSize(testBuffer);
            const expectedSize = gzipSync(testBuffer).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of file", async () => {
            expect.assertions(1);

            const size = await gzipSize(distributionFile);
            const expectedSize = gzipSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of stream", async () => {
            expect.assertions(1);

            const size = await gzipSize(Readable.from([fixtureFileContent]));
            const expectedSize = gzipSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should handle custom options", async () => {
            expect.assertions(1);

            const options = { level: 9 };
            const size = await gzipSize(fixtureFileContent, options);
            const expectedSize = gzipSync(fixtureFileContent, options).length;

            expect(size).toBe(expectedSize);
        });
    });

    describe(brotliSize, () => {
        it("should get size of string", async () => {
            expect.assertions(1);

            const size = await brotliSize(fixtureFileContent);
            const expectedSize = brotliCompressSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of buffer", async () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = await brotliSize(testBuffer);
            const expectedSize = brotliCompressSync(testBuffer).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of file", async () => {
            expect.assertions(1);

            const size = await brotliSize(distributionFile);
            const expectedSize = brotliCompressSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of stream", async () => {
            expect.assertions(1);

            const size = await brotliSize(Readable.from([fixtureFileContent]));
            const expectedSize = brotliCompressSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should handle custom options", async () => {
            expect.assertions(1);

            const options = { quality: 11 };
            const size = await brotliSize(fixtureFileContent, options);
            const expectedSize = brotliCompressSync(fixtureFileContent, options).length;

            expect(size).toBe(expectedSize);
        });
    });

    describe(rawSize, () => {
        it("should get size of string", async () => {
            expect.assertions(1);

            const size = await rawSize(fixtureFileContent);

            expect(size).toBe(fixtureFileContent.length);
        });

        it("should get size of buffer", async () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = await rawSize(testBuffer);

            expect(size).toBe(testBuffer.length);
        });

        it("should get size of file", async () => {
            expect.assertions(1);

            const size = await rawSize(distributionFile);

            expect(size).toBe(fixtureFileContent.length);
        });

        it("should get size of stream", async () => {
            expect.assertions(1);

            const size = await rawSize(Readable.from([fixtureFileContent]));

            expect(size).toBe(fixtureFileContent.length);
        });
    });

    describe(gzipSizeSync, () => {
        it("should get size of string synchronously", () => {
            expect.assertions(1);

            const size = gzipSizeSync(fixtureFileContent);
            const expectedSize = gzipSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of buffer synchronously", () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = gzipSizeSync(testBuffer);
            const expectedSize = gzipSync(testBuffer).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of file synchronously", () => {
            expect.assertions(1);

            const size = gzipSizeSync(distributionFile);
            const expectedSize = gzipSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should handle custom options synchronously", () => {
            expect.assertions(1);

            const options = { level: 9 };
            const size = gzipSizeSync(fixtureFileContent, options);
            const expectedSize = gzipSync(fixtureFileContent, options).length;

            expect(size).toBe(expectedSize);
        });
    });

    describe(brotliSizeSync, () => {
        it("should get size of string synchronously", () => {
            expect.assertions(1);

            const size = brotliSizeSync(fixtureFileContent);
            const expectedSize = brotliCompressSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of buffer synchronously", () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = brotliSizeSync(testBuffer);
            const expectedSize = brotliCompressSync(testBuffer).length;

            expect(size).toBe(expectedSize);
        });

        it("should get size of file synchronously", () => {
            expect.assertions(1);

            const size = brotliSizeSync(distributionFile);
            const expectedSize = brotliCompressSync(fixtureFileContent).length;

            expect(size).toBe(expectedSize);
        });

        it("should handle custom options synchronously", () => {
            expect.assertions(1);

            const options = { quality: 11 };
            const size = brotliSizeSync(fixtureFileContent, options);
            const expectedSize = brotliCompressSync(fixtureFileContent, options).length;

            expect(size).toBe(expectedSize);
        });
    });

    describe(rawSizeSync, () => {
        it("should get size of string synchronously", () => {
            expect.assertions(1);

            const size = rawSizeSync(fixtureFileContent);

            expect(size).toBe(fixtureFileContent.length);
        });

        it("should get size of buffer synchronously", () => {
            expect.assertions(1);

            const testBuffer = Buffer.from(fixtureFileContent);

            const size = rawSizeSync(testBuffer);

            expect(size).toBe(testBuffer.length);
        });

        it("should get size of file synchronously", () => {
            expect.assertions(1);

            const size = rawSizeSync(distributionFile);

            expect(size).toBe(fixtureFileContent.length);
        });
    });
});
