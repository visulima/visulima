import { fileURLToPath } from "node:url";

import { dirname, join } from "@visulima/path";
import type { JsonValue } from "type-fest";
import { describe, expect, it } from "vitest";

import JsonError from "../../../src/error/json-error";
import readJson from "../../../src/read/read-json";
import readJsonSync from "../../../src/read/read-json-sync";
import type { JsonReviver, ReadJsonOptions } from "../../../src/types";

// eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const fixturePath = join(__dirname, "..", "..", "..", "__fixtures__", "read-json");

type ReadJsonFunction = (path: URL | string, reviverOrOptions?: JsonReviver | ReadJsonOptions, options?: ReadJsonOptions) => JsonValue | Promise<JsonValue>;

describe.each([
    ["readJson", readJson as ReadJsonFunction],
    ["readJsonSync", readJsonSync as ReadJsonFunction],
])("%s", (name: string, function_: ReadJsonFunction) => {
    it("should read a valid JSON file with default options", async () => {
        expect.assertions(1);

        const result: JsonValue | Promise<JsonValue> = function_(join(fixturePath, "test.json"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(result).resolves.toStrictEqual({
                name: "John Doe",
            });
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(result).toStrictEqual({
                name: "John Doe",
            });
        }
    });

    it("should read a valid JSON file with custom options", async () => {
        expect.assertions(1);

        const reviver: JsonReviver = (_: string, value: JsonValue): JsonValue => value;
        const options: ReadJsonOptions = {
            color: {
                gutter: (value: string) => value,
                marker: (value: string) => value,
                message: (value: string) => value,
            },
        };

        const result: JsonValue | Promise<JsonValue> = function_(join(fixturePath, "test.json"), reviver, options);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(result).resolves.toStrictEqual({
                name: "John Doe",
            });
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(result).toStrictEqual({
                name: "John Doe",
            });
        }
    });

    it("should read a JSON file with an empty object", async () => {
        expect.assertions(1);

        const result: JsonValue | Promise<JsonValue> = function_(join(fixturePath, "empty.json"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(result).resolves.toStrictEqual({});
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(result).toStrictEqual({});
        }
    });

    it("should throw an error if the file path is not string or URL", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(null as unknown as string)).rejects.toThrow("Path must be a non-empty string or URL.");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(null as unknown as string)).toThrow("Path must be a non-empty string or URL.");
        }
    });

    it("should throw an JSONError if the file content is broken", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_(join(fixturePath, "broken.json"))).rejects.toBeInstanceOf(JsonError);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_(join(fixturePath, "broken.json"))).toThrow(JsonError);
        }
    });

    it("should support beforeParse option", async () => {
        expect.assertions(1);

        const beforeParse = (data: string) => data.replace("John Doe", "Test");
        const result: JsonValue | Promise<JsonValue> = function_(join(fixturePath, "test.json"), {
            beforeParse,
        });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(result).resolves.toStrictEqual({
                name: "Test",
            });
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(result).toStrictEqual({
                name: "Test",
            });
        }
    });

    it("should throw a error on a missing file", async () => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "readJson") {
            // eslint-disable-next-line vitest/no-conditional-expect
            await expect(() => function_("/missing")).rejects.toThrow("ENOENT: no such file or directory, open '/missing'");
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(() => function_("/missing")).toThrow("ENOENT: no such file or directory, open '/missing'");
        }
    });
});
