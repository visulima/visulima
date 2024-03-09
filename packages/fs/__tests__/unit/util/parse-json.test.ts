import { describe, expect, it } from "vitest";

import JSONError from "../../../src/error/json-error";
import parseJson from "../../../src/utils/parse-json";

const INVALID_JSON_STRING = `
  {
  	"foo": true,
  }`;
const EXPECTED_CODE_FRAME = `
  1 | {
  2 | 	"foo": true,
> 3 | }
    | ^
`.slice(1, -1);

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
        const reviver = (key, value) => {
            if (key === "age") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return value + 10;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
        expect.assertions(1);

        const jsonString = "";

        expect(() => {
            parseJson(jsonString);
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

        const jsonString = '{"name": "John", "age": 30,}';
        expect(() => {
            parseJson(jsonString);
        }).toThrow(JSONError);
    });

    it("has error frame properties", () => {
        expect.assertions(1);

        try {
            parseJson(INVALID_JSON_STRING, "foo.json");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error.codeFrame).toStrictEqual(EXPECTED_CODE_FRAME);
        }
    });
});
