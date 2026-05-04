import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import readJson5 from "../../../src/read/read-json5";
import readJson5Sync from "../../../src/read/read-json5-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-json5");
const ANY_ERROR = /./;

type ReadJson5Function = (path: URL | string) => Promise<unknown>;

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
