import { describe, expect, it } from "vitest";

import { identifyCase } from "../../../src/case";

describe("identifyCase", () => {
    it("should identify camelCase", () => {
        expect.assertions(2);
        expect(identifyCase("fooBar")).toBe("camel");
        expect(identifyCase("fooBarBaz")).toBe("camel");
    });

    it("should identify PascalCase", () => {
        expect.assertions(2);
        expect(identifyCase("FooBar")).toBe("pascal");
        expect(identifyCase("FooBarBaz")).toBe("pascal");
    });

    it("should identify snake_case", () => {
        expect.assertions(2);
        expect(identifyCase("foo_bar")).toBe("snake");
        expect(identifyCase("foo_bar_baz")).toBe("snake");
    });

    it("should identify kebab-case", () => {
        expect.assertions(2);
        expect(identifyCase("foo-bar")).toBe("kebab");
        expect(identifyCase("foo-bar-baz")).toBe("kebab");
    });

    it("should identify lowercase", () => {
        expect.assertions(2);
        expect(identifyCase("foo")).toBe("lower");
        expect(identifyCase("foobar")).toBe("lower");
    });

    it("should identify uppercase", () => {
        expect.assertions(2);
        expect(identifyCase("FOO")).toBe("upper");
        expect(identifyCase("FOOBAR")).toBe("upper");
    });

    it("should identify mixed case", () => {
        expect.assertions(2);
        expect(identifyCase("FooBAR")).toBe("mixed");
        expect(identifyCase("FOOBar")).toBe("mixed");
    });

    it("should handle empty string", () => {
        expect.assertions(1);
        expect(identifyCase("")).toBe("lower");
    });
});
