import { CODE_FRAME_POINTER } from "@visulima/error";
import { describe, expect, it } from "vitest";

import JSONError from "../../../src/error/json-error";
import parseJson from "../../../src/utils/parse-json";

const NODE_JS_VERSION = Number(process.versions.node.split(".")[0]);

const INVALID_JSON_STRING = `{
  \t"foo": true,
  }`;

const errorMessageRegex = (() => {
    if (NODE_JS_VERSION < 20) {
        // eslint-disable-next-line regexp/strict
        return /Unexpected token "}"\(\\u{7d}\) in JSON at position 20/;
    }

    if (NODE_JS_VERSION < 21) {
        return /Expected double-quoted property name in JSON at position 20/;
    }

    return /Expected double-quoted property name in JSON at position 20 \(line 3 column 3\)/;
})();

const errorMessageRegexWithFileName = new RegExp(String.raw`${errorMessageRegex.source}.*in foo\.json`);

describe("parse-json", () => {
    // Can parse a valid JSON string without a reviver function
    it("should parse a valid JSON string without a reviver function", () => {
        expect.assertions(1);

        const jsonString = "{\"name\": \"John\", \"age\": 30}";
        const result = parseJson(jsonString);

        expect(result).toStrictEqual({ age: 30, name: "John" });
    });

    // Can parse a valid JSON string with a reviver function
    it("should parse a valid JSON string with a reviver function", () => {
        expect.assertions(1);

        const jsonString = "{\"name\": \"John\", \"age\": 30}";
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

        const jsonString = "{\"name\": \"John\", \"age\": 30, \"hobbies\": [\"reading\", \"painting\"], \"address\": {\"street\": \"123 Main St\", \"city\": \"New York\"}}";
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

        const jsonString = "{\"name\": \"John\", \"age\": 30}";
        const invalidJsonString = jsonString.replace("}", "");

        expect(() => {
            parseJson(invalidJsonString);
        }).toThrow(JSONError);
    });

    it("should throw a JSONError when parsing a JSON string with a trailing comma", () => {
        expect.assertions(1);

        expect(() => {
            parseJson("{\"name\": \"John\", \"age\": 30,}");
        }).toThrow(JSONError);
    });

    it("has error frame properties", () => {
        expect.assertions(1);

        try {
            parseJson(INVALID_JSON_STRING, "foo.json");
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.codeFrame).toBe(`  1 | {
  2 |   \t"foo": true,
${CODE_FRAME_POINTER as string} 3 |   }
    |   ^`);
        }
    });

    it("should allow error location out of bounds", () => {
        expect.assertions(1);

        try {
            parseJson("{");
        } catch (error: any) {
            let expectedCodeFrame: string | undefined = `${CODE_FRAME_POINTER as string} 1 | {
    |  ^`;

            if (NODE_JS_VERSION === 18) {
                expectedCodeFrame = undefined;
            } else if (NODE_JS_VERSION === 20) {
                expectedCodeFrame = `${CODE_FRAME_POINTER as string} 1 | {
    | ^`;
            }

            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.codeFrame).toStrictEqual(expectedCodeFrame);
        }
    });

    it("should throw a error on a unexpected token", () => {
        expect.assertions(2);

        try {
            parseJson("a");
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error).toBeInstanceOf(JSONError);

            const firstLine = error.message.split("\n")[0];

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
            } catch (error: any) {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(error.fileName).toBe("foo.json");

                throw error;
            }
        }).toThrow(errorMessageRegexWithFileName);

        expect(() => {
            try {
                parseJson(INVALID_JSON_STRING);
            } catch (error: any) {
                error.fileName = "foo.json";

                throw error;
            }
        }).toThrow(errorMessageRegexWithFileName);

        expect(() => {
            try {
                parseJson(INVALID_JSON_STRING, "bar.json");
            } catch (error: any) {
                // eslint-disable-next-line vitest/no-conditional-expect
                expect(error.fileName).toBe("bar.json");

                error.fileName = "foo.json";

                throw error;
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
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.codeFrame).toBe(` +++ 1 | {
 +++ 2 |   \t"foo": true,
${CODE_FRAME_POINTER as string}+++ 3 |   }
 +++   |   ^`);
        }
    });
});
