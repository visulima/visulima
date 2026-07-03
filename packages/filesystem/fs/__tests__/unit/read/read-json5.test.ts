import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import readJson5 from "../../../src/read/read-json5";
import readJson5Sync from "../../../src/read/read-json5-sync";
import type { CompressionType, Json5Reviver, ReadJson5Options } from "../../../src/types";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-json5");
const ANY_ERROR = /./;

type ReadJson5Function = (path: URL | string) => Promise<unknown>;

type ReadJson5FullFunction = (
    path: URL | string,
    reviverOrOptions?: Json5Reviver | ReadJson5Options<CompressionType>,
    options?: ReadJson5Options<CompressionType>,
) => unknown;

describe.each([
    ["readJson5", readJson5],
    ["readJson5Sync", readJson5Sync as ReadJson5Function],
])("%s", (name: string, function_: ReadJson5Function) => {
    it("should read a .json5 file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.json5");
        const result = function_(path);
        const parsed = (name === "readJson5" ? await result : result) as Record<string, unknown>;

        expect(parsed).toStrictEqual({
            features: ["unquoted-keys", "single-quotes", "trailing-commas"],
            name: "json5-example",
            version: "1.0.0",
        });
    });

    it("should throw on a broken .json5 file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "broken.json5");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson5") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(async () => function_(path)).rejects.toThrow(ANY_ERROR);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(path)).toThrow(ANY_ERROR);
        }
    });
});

describe.each([
    ["readJson5", readJson5 as ReadJson5FullFunction],
    ["readJson5Sync", readJson5Sync as ReadJson5FullFunction],
])("%s (options and reviver)", (name: string, function_: ReadJson5FullFunction) => {
    it("should apply a reviver function", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.json5");
        const reviver: Json5Reviver = (key, value) => (key === "version" ? "patched" : value);

        const result = function_(path, reviver);
        const parsed = (name === "readJson5" ? await result : result) as Record<string, unknown>;

        expect(parsed.version).toBe("patched");
    });

    it("should apply a beforeParse hook", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.json5");
        const beforeParse = (content: string): string => content.replace("json5-example", "before-parsed");

        const result = function_(path, { beforeParse });
        const parsed = (name === "readJson5" ? await result : result) as Record<string, unknown>;

        expect(parsed.name).toBe("before-parsed");
    });

    it("should accept an options object as the second argument", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.json5");

        const result = function_(path, { encoding: "utf8" });
        const parsed = (name === "readJson5" ? await result : result) as Record<string, unknown>;

        expect(parsed.name).toBe("json5-example");
    });
});
