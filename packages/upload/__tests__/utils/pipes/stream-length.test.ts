import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import StreamLength from "../../../src/utils/pipes/stream-length";
import { testRoot } from "../../__helpers__/config";

const createTestFile = async (path: string, filepath: string) => {
    await mkdir(path, { recursive: true });
    await writeFile(filepath, "test", "utf8");
};

describe("utils", () => {
    describe("pipes", () => {
        const directory = join(testRoot, "stream-length");

        afterEach(async () => {
            try {
                await rm(directory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        beforeEach(async () => {
            try {
                await rm(directory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        describe(StreamLength, () => {
            const file = join(directory, "test.txt");

            it("should create StreamLength instance and track stream length correctly", async () => {
                expect.assertions(3);

                await createTestFile(directory, file);

                const transformer = new StreamLength();

                expect(transformer).toHaveLength(0);

                const stream = pipeline(createReadStream(file), transformer, (error) => {
                    expect(error).toBeUndefined();
                });

                expect(stream).toBeInstanceOf(StreamLength);
                expect(stream).toHaveLength(0);
            });
        });
    });
});
