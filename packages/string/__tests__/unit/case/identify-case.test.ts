import { describe, expect, it } from "vitest";

import { identifyCase } from "../../../src/case";

describe("identifyCase", () => {
    it("should identify camelCase including variations", () => {
        expect.assertions(7);
        expect(identifyCase("fooBar")).toBe("camel");
        expect(identifyCase("fooBarBaz")).toBe("camel");
        expect(identifyCase("innerHTML")).toBe("camel");
        expect(identifyCase("dataType1")).toBe("camel"); // Ends with number
        expect(identifyCase("myXMLParser")).toBe("camel");
        expect(identifyCase("getID")).toBe("camel");
        expect(identifyCase("aB")).toBe("camel"); // Short camelCase
    });

    it("should identify PascalCase including variations", () => {
        expect.assertions(6);
        expect(identifyCase("FooBar")).toBe("pascal");
        expect(identifyCase("FooBarBaz")).toBe("pascal");
        expect(identifyCase("Pascal")).toBe("pascal");
        expect(identifyCase("XMLHttpRequest")).toBe("pascal");
        expect(identifyCase("AClass")).toBe("pascal");
        expect(identifyCase("PaScAlCase")).toBe("pascal"); // Mixed capitalization within Pascal structure
    });

    it("should identify snake_case including variations", () => {
        expect.assertions(7);
        expect(identifyCase("foo_bar")).toBe("snake");
        expect(identifyCase("foo_bar_baz")).toBe("snake");
        expect(identifyCase("my_variable")).toBe("snake");
        expect(identifyCase("my_variable_1")).toBe("snake"); // Ends with number
        expect(identifyCase("a_b_c")).toBe("snake");
        expect(identifyCase("abc_123")).toBe("snake"); // Mixed alphanumeric
        expect(identifyCase("a_")).toBe("snake"); // Ends with underscore
    });

    it("should identify kebab-case including variations", () => {
        expect.assertions(7);
        expect(identifyCase("foo-bar")).toBe("kebab");
        expect(identifyCase("foo-bar-baz")).toBe("kebab");
        expect(identifyCase("my-component")).toBe("kebab");
        expect(identifyCase("my-component-1")).toBe("kebab"); // Ends with number
        expect(identifyCase("a-b-c")).toBe("kebab");
        expect(identifyCase("abc-123")).toBe("kebab"); // Mixed alphanumeric
        expect(identifyCase("a-")).toBe("kebab"); // Ends with hyphen
    });

    it("should identify lowercase including variations", () => {
        expect.assertions(5);
        expect(identifyCase("foo")).toBe("lower");
        expect(identifyCase("foobar")).toBe("lower");
        expect(identifyCase("lowercase")).toBe("lower");
        expect(identifyCase("abc")).toBe("lower");
        expect(identifyCase("abc xyz")).toBe("lower"); // Lowercase with space
    });

    it("should identify uppercase including variations", () => {
        expect.assertions(6);
        expect(identifyCase("FOO")).toBe("upper");
        expect(identifyCase("FOOBAR")).toBe("upper");
        expect(identifyCase("UPPERCASE")).toBe("upper");
        expect(identifyCase("ABC")).toBe("upper");
        expect(identifyCase("ABC123")).toBe("upper"); // Uppercase with numbers
        expect(identifyCase("A1B2C3")).toBe("upper"); // Uppercase interleaved with numbers
    });

    it("should identify UPPER_SNAKE_CASE including variations", () => {
        expect.assertions(5);
        expect(identifyCase("UPPER_SNAKE")).toBe("upper_snake");
        expect(identifyCase("MY_CONSTANT")).toBe("upper_snake");
        expect(identifyCase("MY_CONSTANT_1")).toBe("upper_snake"); // Ends with number
        expect(identifyCase("ABC_123")).toBe("upper_snake"); // Mixed alphanumeric
        expect(identifyCase("A_")).toBe("upper_snake"); // Ends with underscore
    });

    it("should identify title including variations", () => {
        expect.assertions(3);

        expect(identifyCase("Title Case")).toBe("title");
        expect(identifyCase("A Title Case")).toBe("title");
        expect(identifyCase("2024 Annual Report")).toBe("title");
    });

    it("should identify sentence including variations", () => {
        expect.assertions(5);

        expect(identifyCase("Sentence case")).toBe("sentence");
        expect(identifyCase("A sentence case")).toBe("sentence");
        expect(identifyCase("A long year, was 2024")).toBe("sentence");
        expect(identifyCase("A long year, was 2024.")).toBe("sentence"); // Ends with punctuation
        expect(identifyCase("The cat saw John run.")).toBe("sentence");
    });

    it("should identify various mixed cases", () => {
        expect.assertions(11);

        expect(identifyCase("a_b-c")).toBe("mixed"); // Snake and kebab
        expect(identifyCase("Fo_ob1_r")).toBe("mixed");
        expect(identifyCase("Foo_b9ar")).toBe("mixed");
        expect(identifyCase("Foo_bar_baz")).toBe("mixed"); // Pascal and snake
        expect(identifyCase("Fo122345")).toBe("mixed");
        expect(identifyCase("M123ed")).toBe("mixed");
        expect(identifyCase("M1x3d")).toBe("mixed");
        expect(identifyCase("Class1")).toBe("mixed"); // Pascal with number
        expect(identifyCase("Class1Name2")).toBe("mixed"); // Pascal with numbers
        expect(identifyCase("abc123")).toBe("mixed"); // Lowercase with number
        expect(identifyCase("a1b2c3")).toBe("mixed"); // Lowercase interleaved with numbers
    });

    it("should handle invalid/edge cases", () => {
        expect.assertions(7);
        // Invalid inputs
        expect(identifyCase("123")).toBe("unknown"); // Numbers only
        expect(identifyCase("!@#")).toBe("unknown"); // Symbols only
        expect(identifyCase("abc!def")).toBe("unknown"); // Mixed with symbols
        // Single characters
        expect(identifyCase("a")).toBe("lower");
        expect(identifyCase("A")).toBe("upper");
        // Other edge cases
        expect(identifyCase("123ABC")).toBe("mixed"); // Starts with number, then uppercase
        expect(identifyCase("123abc")).toBe("mixed"); // Starts with number, then lowercase
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(identifyCase("")).toBe("unknown");
    });

    it("should handle null input", () => {
        expect.assertions(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => identifyCase(null as any)).toThrow(TypeError);
    });
});
