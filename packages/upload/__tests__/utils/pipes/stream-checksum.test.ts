import { createReadStream } from "node:fs";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough, pipeline } from "node:stream";

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

        describe("stream-checksum", () => {
            it("should return a stream checksum", async () => {
                await createTestFile(directory, file);

                const transformer = new StreamChecksum("098f6bcd4621d373cade4e832627b4f6", "md5");

                expect(transformer.checksum).toBe("098f6bcd4621d373cade4e832627b4f6");
                expect(transformer.algorithm).toBe("md5");

                const stream = createReadStream(file);

                const writeableStream = pipeline(stream, transformer, (error) => {
                    expect(error?.message).toBe("Checksum mismatch");
                });

                expect(writeableStream).toBeInstanceOf(StreamChecksum);
                expect(writeableStream).toHaveLength(0);
                // @ts-expect-error
                expect(writeableStream.digest).toBe("");
            });
        });

        describe(createReadStream, () => {
            it("should return a pass through stream", async () => {
                await createTestFile(directory, file);

                const stream = createReadStream(file);

                const writeableStream = pipeline(stream, streamChecksum("", ""), (error) => {
                    expect(error).toBeUndefined();
                });

                expect(writeableStream).toBeInstanceOf(PassThrough);
            });

            it("should return a stream checksum", async () => {
                await createTestFile(directory, file);

                // eslint-disable-next-line no-secrets/no-secrets
                const transformer = streamChecksum("CY9rzUYh03PK3k6DJie09g==", "md5") as StreamChecksum;

                // eslint-disable-next-line no-secrets/no-secrets
                expect(transformer.checksum).toBe("CY9rzUYh03PK3k6DJie09g==");
                expect(transformer.algorithm).toBe("md5");

                const stream = pipeline(createReadStream(file), transformer, (error) => {
                    expect(error).toBeUndefined();
                });

                expect(stream).toBeInstanceOf(StreamChecksum);
                expect(stream).toHaveLength(0);
            });
        });
    });
});
