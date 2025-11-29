import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream";

import { temporaryDirectory } from "tempy";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import StreamLength from "../../../src/utils/pipes/stream-length";

const createTestFile = async (path: string, filepath: string) => {
    await mkdir(path, { recursive: true });
    await writeFile(filepath, "test", "utf8");
};

describe("utils", () => {
    describe("pipes", () => {
        let directory: string;
        let file: string;

        beforeEach(async () => {
            directory = temporaryDirectory();
            file = join(directory, "test.txt");
        });

        afterEach(async () => {
            try {
                await rm(directory, { force: true, recursive: true });
            } catch {
                // ignore if directory doesn't exist
            }
        });

        describe(StreamLength, () => {
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
