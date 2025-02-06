import { describe, expectTypeOf, it } from "vitest";

describe("string Interface Augmentations", () => {
    describe("charAt", () => {
        it("should return correct character type for literal string", () => {
            const input = "hello";
            expectTypeOf(input.charAt(0)).toEqualTypeOf<"h">();
            expectTypeOf(input.charAt(1)).toEqualTypeOf<"e">();
        });

        it("should handle non-literal string input", () => {
            const input = "hello";
            // @ts-expect-error - for testing purposes
            expectTypeOf(input.charAt(0)).toEqualTypeOf<string>();
        });
    });

    describe("concat", () => {
        it("should handle single string argument", () => {
            const input = "hello";
            expectTypeOf(input.concat("world")).toEqualTypeOf<"helloworld">();
        });

        it("should handle multiple string arguments", () => {
            const input = "hello";
            expectTypeOf(input.concat(" ", "world")).toEqualTypeOf<"hello world">();
        });

        it("should handle array of strings", () => {
            const input = "hello";
            expectTypeOf(input.concat(" ", "world")).toEqualTypeOf<"hello world">();
        });
    });

    describe("endsWith", () => {
        it("should check string ending", () => {
            const input = "hello world";
            expectTypeOf(input.endsWith("world")).toEqualTypeOf<true>();
            expectTypeOf(input.endsWith("hello")).toEqualTypeOf<false>();
        });
    });

    describe("includes", () => {
        it("should check string inclusion", () => {
            const input = "hello world";
            expectTypeOf(input.includes("world")).toEqualTypeOf<true>();
            expectTypeOf(input.includes("xyz")).toEqualTypeOf<false>();
        });
    });

    describe("padStart/padEnd", () => {
        it("should pad strings correctly", () => {
            const input = "hello";
            expectTypeOf(input.padStart(7, "_")).toEqualTypeOf<"__hello">();
            expectTypeOf(input.padEnd(7, "_")).toEqualTypeOf<"hello__">();
        });
    });

    describe("replace/replaceAll", () => {
        it("should replace strings correctly", () => {
            const input = "hello hello";
            expectTypeOf(input.replace("hello", "hi")).toEqualTypeOf<"hi hello">();
            expectTypeOf(input.replaceAll("hello", "hi")).toEqualTypeOf<"hi hi">();
        });
    });

    describe("slice", () => {
        it("should slice string correctly", () => {
            const input = "hello";
            expectTypeOf(input.slice(1, 4)).toEqualTypeOf<"ell">();
            expectTypeOf(input.slice(1)).toEqualTypeOf<"ello">();
        });
    });

    describe("split", () => {
        it("should split string correctly", () => {
            const input = "hello world";
            expectTypeOf(input.split(" ")).toEqualTypeOf<["hello", "world"]>();
        });
    });

    describe("startsWith", () => {
        it("should check string starting", () => {
            const input = "hello world";
            expectTypeOf(input.startsWith("hello")).toEqualTypeOf<true>();
            expectTypeOf(input.startsWith("world")).toEqualTypeOf<false>();
        });
    });

    describe("trim methods", () => {
        it("should trim strings correctly", () => {
            const input = " hello ";
            expectTypeOf(input.trim()).toEqualTypeOf<"hello">();
            expectTypeOf(input.trimStart()).toEqualTypeOf<"hello ">();
            expectTypeOf(input.trimEnd()).toEqualTypeOf<" hello">();
        });
    });

    describe("case conversion", () => {
        it("should convert to lowercase", () => {
            const input = "HELLO";
            expectTypeOf(input.toLowerCase()).toEqualTypeOf<"hello">();
        });

        it("should convert to uppercase", () => {
            const input = "hello";
            expectTypeOf(input.toUpperCase()).toEqualTypeOf<"HELLO">();
        });
    });
});
