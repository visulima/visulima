import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import JSONError from "../../../src/error/json-error";
import readJsonc from "../../../src/read/read-jsonc";
import readJsoncSync from "../../../src/read/read-jsonc-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-jsonc");

type ReadJsoncFunction = (path: URL | string, options?: Record<string, unknown>) => Promise<unknown>;

describe.each([
    ["readJsonc", readJsonc],
    ["readJsoncSync", readJsoncSync as ReadJsoncFunction],
])("%s", (name: string, function_: ReadJsoncFunction) => {
    it("should read a .jsonc file stripping comments and trailing commas", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "file.jsonc");
        const result = function_(path);
        const parsed = (name === "readJsonc" ? await result : result) as Record<string, unknown>;

        expect(parsed).toStrictEqual({
            features: ["comments", "trailing-commas"],
            name: "jsonc-example",
            version: "1.0.0",
        });
    });

    it("should throw a JSONError on a broken .jsonc file", async () => {
        expect.assertions(1);

        const path = join(fixturePath, "broken.jsonc");

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJsonc") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(async () => function_(path)).rejects.toThrow(JSONError);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(path)).toThrow(JSONError);
        }
    });
});
