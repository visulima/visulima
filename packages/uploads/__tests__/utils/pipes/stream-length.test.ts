import { createReadStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream";
import {
    afterEach, beforeEach, describe, expect, it,
} from "vitest";

import { fsp } from "../../../src/utils/fs";
import StreamLength from "../../../src/utils/pipes/stream-length";
import { testRoot } from "../../__helpers__/config";
import { cleanup } from "../../__helpers__/utils";

const createTestFile = async (path: string, filepath: string) => {
    await fsp.mkdir(path, { recursive: true });
    await fsp.writeFile(filepath, "test", "utf8");
};

describe("utils", () => {
    describe("pipes", () => {
        const directory = join(testRoot, "stream-length");

        afterEach(async () => cleanup(directory));

        beforeEach(async () => cleanup(directory));

        describe("stream-length", () => {
            const file = join(directory, "test.txt");

            it("should return a stream length", async () => {
                await createTestFile(directory, file);

                const transformer = new StreamLength();

                expect(transformer.length).toBe(0);

                const stream = pipeline(createReadStream(file), transformer, (error) => {
                    expect(error).toBeUndefined();
                });

                expect(stream).toBeInstanceOf(StreamLength);
                expect(stream.length).toBe(0);
            });
        });
    });
});
