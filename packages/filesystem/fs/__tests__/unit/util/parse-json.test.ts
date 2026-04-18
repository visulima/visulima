import { CODE_FRAME_POINTER } from "@visulima/error";
import { describe, expect, it } from "vitest";

import JSONError from "../../../src/error/json-error";
import parseJson from "../../../src/utils/parse-json";

const NODE_JS_VERSION = Number(process.versions.node.split(".")[0]);

const INVALID_JSON_STRING = `{
  \t"foo": true,
  }`;

// eslint-disable-next-line regexp/strict
const ERROR_MESSAGE_RE_V18 = /Unexpected token "}"\(\\u{7d}\) in JSON at position 20/;
const ERROR_MESSAGE_RE_V20 = /Expected double-quoted property name in JSON at position 20/;
const ERROR_MESSAGE_RE_V21_PLUS = /Expected double-quoted property name in JSON at position 20 \(line 3 column 3\)/;

let errorMessageRegex: RegExp;

if (NODE_JS_VERSION < 20) {
    errorMessageRegex = ERROR_MESSAGE_RE_V18;
} else if (NODE_JS_VERSION < 21) {
    errorMessageRegex = ERROR_MESSAGE_RE_V20;
} else {
    errorMessageRegex = ERROR_MESSAGE_RE_V21_PLUS;
}

const errorMessageRegexWithFileName = new RegExp(String.raw`${errorMessageRegex.source}.*in foo\.json`);

describe("parse-json", () => {
    // Can parse a valid JSON string without a reviver function
    it("should parse a valid JSON string without a reviver function", () => {
        expect.assertions(1);

        const jsonString = '{"name": "John", "age": 30}';
        const result = parseJson(jsonString);

        expect(result).toStrictEqual({ age: 30, name: "John" });
    });

    // Can parse a valid JSON string with a reviver function
    it("should parse a valid JSON string with a reviver function", () => {
        expect.assertions(1);

        const jsonString = '{"name": "John", "age": 30}';
        const reviver = (key: string, value: number) => {
            if (key === "age") {
                return value + 10;
            }

            return value;
        };

        const result = parseJson(jsonString, reviver);

        expect(result).toStrictEqual({ age: 40, name: "John" });
    });

    it("should parse a JSON string with nested objects and arrays", () => {
        expect.assertions(1);

        const jsonString = '{"name": "John", "age": 30, "hobbies": ["reading", "painting"], "address": {"street": "123 Main St", "city": "New York"}}';
        const result = parseJson(jsonString);

        expect(result).toStrictEqual({
            address: { city: "New York", street: "123 Main St" },
            age: 30,
            hobbies: ["reading", "painting"],
            name: "John",
        });
    });

    it("should throw a JSONError when parsing an empty string", () => {
        expect.assertions(2);

        expect(() => {
            parseJson("");
        }).toThrow(JSONError);

        expect(() => {
            parseJson("  ");
        }).toThrow(JSONError);
    });

    it("should throw a JSONError when parsing an invalid JSON string", () => {
        expect.assertions(1);

        const jsonString = '{"name": "John", "age": 30}';
        const invalidJsonString = jsonString.replace("}", "");

        expect(() => {
            parseJson(invalidJsonString);
        }).toThrow(JSONError);
    });

    it("should throw a JSONError when parsing a JSON string with a trailing comma", () => {
        expect.assertions(1);

        expect(() => {
            parseJson('{"name": "John", "age": 30,}');
        }).toThrow(JSONError);
    });

    it("has error frame properties", () => {
        expect.assertions(1);

        try {
            parseJson(INVALID_JSON_STRING, "foo.json");
        } catch (error: unknown) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect((error as JSONError).codeFrame).toBe(`  1 | {
  2 |   \t"foo": true,
${CODE_FRAME_POINTER} 3 |   }
    |   ^`);
        }
    });

    it("should allow error location out of bounds", () => {
        expect.assertions(1);

        try {
            parseJson("{");
        } catch (error: unknown) {
            const jsonError = error as JSONError;
            let expectedCodeFrame: string | undefined = `${CODE_FRAME_POINTER} 1 | {
    |  ^`;

            if (NODE_JS_VERSION === 18) {
                expectedCodeFrame = undefined;
            } else if (NODE_JS_VERSION === 20) {
                expectedCodeFrame = `${CODE_FRAME_POINTER} 1 | {
    | ^`;
            }

            // eslint-disable-next-line vitest/no-conditional-expect
            expect(jsonError.codeFrame).toStrictEqual(expectedCodeFrame);
        }
    });

    it("should throw a error on a unexpected token", () => {
        expect.assertions(2);

        try {
            parseJson("a");
        } catch (error: unknown) {
            const jsonError = error as JSONError;

            // eslint-disable-next-line vitest/no-conditional-expect
            expect(jsonError).toBeInstanceOf(JSONError);

            const firstLine = jsonError.message.split("\n")[0];

            if (NODE_JS_VERSION === 18) {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(firstLine).toBe(String.raw`Unexpected token "a"(\u{61}) in JSON at position 0`);
            } else {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(firstLine).toBe(String.raw`Unexpected token "a"(\u{61}), "a" is not valid JSON`);
            }
        }
    });

    it("should allow to add fileName to the Error", () => {
        expect.assertions(5);

        expect(() => {
            try {
                parseJson(INVALID_JSON_STRING, "foo.json");
            } catch (error: unknown) {
                const jsonError = error as JSONError;

                // eslint-disable-next-line vitest/no-conditional-expect
                expect(jsonError.fileName).toBe("foo.json");

                throw jsonError;
            }
        }).toThrow(errorMessageRegexWithFileName);

        expect(() => {
            try {
                parseJson(INVALID_JSON_STRING);
            } catch (error: unknown) {
                const jsonError = error as JSONError;

                jsonError.fileName = "foo.json";

                throw jsonError;
            }
        }).toThrow(errorMessageRegexWithFileName);

        expect(() => {
            try {
                parseJson(INVALID_JSON_STRING, "bar.json");
            } catch (error: unknown) {
                const jsonError = error as JSONError;

                // eslint-disable-next-line vitest/no-conditional-expect
                expect(jsonError.fileName).toBe("bar.json");

                jsonError.fileName = "foo.json";

                throw jsonError;
            }
        }).toThrow(errorMessageRegexWithFileName);
    });

    it("should take codeFrame options", () => {
        expect.assertions(1);

        try {
            parseJson(INVALID_JSON_STRING, "foo.json", {
                color: {
                    gutter: (value) => `+++${value}`,
                },
            });
        } catch (error: unknown) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect((error as JSONError).codeFrame).toBe(` +++ 1 | {
 +++ 2 |   \t"foo": true,
${CODE_FRAME_POINTER}+++ 3 |   }
 +++   |   ^`);
        }
    });
});
