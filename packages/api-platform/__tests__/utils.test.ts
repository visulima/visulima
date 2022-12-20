import { describe, expect, it } from "vitest";

import { toHeaderCase } from "../src/utils";

describe("utils", () => {
    describe("toHeaderCase", () => {
        it("should convert a string to header case", () => {
            // eslint-disable-next-line radar/no-duplicate-string
            expect(toHeaderCase("Hello World")).toEqual("Hello-World");
            expect(toHeaderCase("hello world")).toEqual("Hello-World");
            expect(toHeaderCase("Hello, World!")).toEqual("Hello-World");
            expect(toHeaderCase("Hello_World")).toEqual("Hello-World");
        });

        it("should handle empty strings", () => {
            expect(toHeaderCase("")).toEqual("");
        });

        it("should handle single-word strings", () => {
            expect(toHeaderCase("hello")).toEqual("Hello");
            expect(toHeaderCase("HELLO")).toEqual("Hello");
        });

        it("should handle strings with multiple spaces", () => {
            expect(toHeaderCase("Hello   World")).toEqual("Hello-World");
            expect(toHeaderCase("Hello  \t  World")).toEqual("Hello-World");
        });
    });
});
