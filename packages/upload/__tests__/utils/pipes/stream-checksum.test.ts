import { createReadStream } from "node:fs";
import { join } from "node:path";
import { PassThrough, pipeline } from "node:stream";
import {
    afterAll, beforeAll, describe, expect, it,
} from "vitest";

import { fsp } from "../../../src/utils/fs";
import { StreamChecksum, streamChecksum } from "../../../src/utils/pipes/stream-checksum";
import { testRoot } from "../../__helpers__/config";
import { cleanup } from "../../__helpers__/utils";

const createTestFile = async (path: string, filepath: string) => {
    await fsp.mkdir(path, { recursive: true });
    await fsp.writeFile(filepath, "test", "utf8");
};

describe("utils", () => {
    describe("pipes", () => {
        const directory = join(testRoot, "stream-checksum");
        const file = join(directory, "test.txt");

        beforeAll(async () => cleanup(directory));

        afterAll(async () => cleanup(directory));

        describe("stream-checksum", () => {
            it("should return a stream checksum", async () => {
                await createTestFile(directory, file);

                // eslint-disable-next-line no-secrets/no-secrets
                const transformer = new StreamChecksum("098f6bcd4621d373cade4e832627b4f6", "md5");

                // eslint-disable-next-line no-secrets/no-secrets
                expect(transformer.checksum).toBe("098f6bcd4621d373cade4e832627b4f6");
                expect(transformer.algorithm).toBe("md5");

                const stream = createReadStream(file);

                const writeableStream = pipeline(stream, transformer, (error) => {
                    expect(error?.message).toBe("Checksum mismatch");
                });

                expect(writeableStream).toBeInstanceOf(StreamChecksum);
                expect(writeableStream.length).toBe(0);
                // @ts-expect-error
                expect(writeableStream.digest).toBe("");
            });
        });

        describe("createReadStream", () => {
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
                expect(stream.length).toBe(0);
            });
        });
    });
});
