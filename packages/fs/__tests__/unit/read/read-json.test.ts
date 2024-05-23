import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import JsonError from "../../../src/error/json-error";
import readJson from "../../../src/read/read-json";
import readJsonSync from "../../../src/read/read-json-sync";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-json");

describe.each([
    ["readJson", readJson],
    ["readJsonSync", readJsonSync],
])("%s", (name: string, function_) => {
    it("should read a valid JSON file with default options", async () => {
        expect.assertions(1);

        let result = function_(join(fixturePath, "test.json"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            result = await result;
        }

        expect(result).toStrictEqual({
            name: "John Doe",
        });
    });

    it("should read a valid JSON file with custom options", async () => {
        expect.assertions(1);

        const reviver = (_, value) => value;
        const options = {
            color: {
                gutter: (value: string) => value,
                marker: (value: string) => value,
                message: (value: string) => value,
            },
        };

        let result = function_(join(fixturePath, "test.json"), reviver, options);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            result = await result;
        }

        expect(result).toStrictEqual({
            name: "John Doe",
        });
    });

    it("should read a JSON file with an empty object", async () => {
        expect.assertions(1);

        let result = function_(join(fixturePath, "empty.json"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            result = await result;
        }

        expect(result).toStrictEqual({});
    });

    it("should throw an error if the file path is not string or URL", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(null)).rejects.toThrow("Path must be a non-empty string or URL.");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(null)).toThrow("Path must be a non-empty string or URL.");
        }
    });

    it("should throw an JSONError if the file content is broken", async () => {
        expect.assertions(1);

        try {
            if (name === "readJson") {
                await function_(join(fixturePath, "broken.json"));
            } else {
                function_(join(fixturePath, "broken.json"));
            }
        } catch (error) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error).toBeInstanceOf(JsonError);
        }
    });

    it("should support beforeParse option", async () => {
        expect.assertions(1);

        const beforeParse = (data: string) => data.replace("John Doe", "Test");
        let result = function_(join(fixturePath, "test.json"), {
            beforeParse,
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            result = await result;
        }

        expect(result).toStrictEqual({
            name: "Test",
        });
    });

    it("should throw a error on a missing file", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_("/missing")).rejects.toThrow("EPERM: Operation not permitted, unable to read the non-accessible file: /missing");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_("/missing")).toThrow("EPERM: Operation not permitted, unable to read the non-accessible file: /missing");
        }
    });
});
