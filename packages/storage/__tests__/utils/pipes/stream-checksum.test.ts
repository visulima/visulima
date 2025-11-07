import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { pipeline } from "node:stream/promises";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { StreamChecksum, streamChecksum } from "../../../src/utils/pipes/stream-checksum";
import { testRoot } from "../../__helpers__/config";

const createTestFile = async (path: string, filepath: string) => {
    await mkdir(path, { recursive: true });
    await writeFile(filepath, "test", "utf8");
};

describe("utils", () => {
    describe("pipes", () => {
        const directory = join(testRoot, "stream-checksum");
        const file = join(directory, "test.txt");

        beforeAll(async () => {
            try {
                await rm(directory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        afterAll(async () => {
            try {
                await rm(directory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        describe(StreamChecksum, () => {
            it("should create StreamChecksum instance with correct properties and validate checksum mismatch", async () => {
                expect.assertions(4);

                await createTestFile(directory, file);

                const transformer = new StreamChecksum("098f6bcd4621d373cade4e832627b4f6", "md5");

                expect(transformer.checksum).toBe("098f6bcd4621d373cade4e832627b4f6");
                expect(transformer.algorithm).toBe("md5");

                const stream = createReadStream(file);

                await expect(pipeline(stream, transformer)).rejects.toThrow("Checksum mismatch");

                expect(transformer).toBeInstanceOf(StreamChecksum);
                expect(transformer.calculatedDigest).toBeTruthy();
            });
        });

        describe(streamChecksum, () => {
            it("should return a PassThrough stream when no checksum provided", async () => {
                expect.assertions(2);

                await createTestFile(directory, file);

                const stream = createReadStream(file);
                const transformer = streamChecksum("", "");

                await expect(pipeline(stream, transformer)).resolves.toBeUndefined();

                expect(transformer).toBeInstanceOf(PassThrough);
            });

            it("should return a StreamChecksum instance with correct properties when checksum provided", async () => {
                expect.assertions(3);

                await createTestFile(directory, file);

                // eslint-disable-next-line no-secrets/no-secrets
                const transformer = streamChecksum("CY9rzUYh03PK3k6DJie09g==", "md5") as StreamChecksum;

                // eslint-disable-next-line no-secrets/no-secrets
                expect(transformer.checksum).toBe("CY9rzUYh03PK3k6DJie09g==");
                expect(transformer.algorithm).toBe("md5");

                await expect(pipeline(createReadStream(file), transformer)).resolves.toBeUndefined();

                expect(transformer).toBeInstanceOf(StreamChecksum);
            });
        });
    });
});
