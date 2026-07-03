import { describe, expectTypeOf, it } from "vitest";

import type {
    CharAt,
    Concat,
    EndsWith,
    Includes,
    Length,
    PadEnd,
    PadStart,
    Replace,
    ReplaceAll,
    Reverse,
    Slice,
    Split,
    StartsWith,
    ToLowerCase,
    ToUpperCase,
    Trim,
    TrimEnd,
    TrimStart,
} from "../../src/types";

describe("string Type Utils", () => {
    describe("charAt", () => {
        it("should return correct character type for literal string", () => {
            expectTypeOf<CharAt<"hello", 0>>().toEqualTypeOf<"h">();
            expectTypeOf<CharAt<"hello", 1>>().toEqualTypeOf<"e">();
            expectTypeOf<CharAt<"hello", 4>>().toEqualTypeOf<"o">();
        });

        it("should return string type for non-literal inputs", () => {
            // eslint-disable-next-line sonarjs/redundant-type-aliases
            type DynamicString = string;

            expectTypeOf<CharAt<DynamicString, 0>>().toEqualTypeOf<string>();
        });
    });

    describe("concat", () => {
        it("should concatenate string array correctly", () => {
            expectTypeOf<Concat<["hello", " ", "world"]>>().toEqualTypeOf<"hello world">();
            expectTypeOf<Concat<["a", "b", "c"]>>().toEqualTypeOf<"abc">();
        });

        it("should handle empty array", () => {
            expectTypeOf<Concat<[]>>().toEqualTypeOf<"">();
        });

        it("should handle single element", () => {
            expectTypeOf<Concat<["hello"]>>().toEqualTypeOf<"hello">();
        });
    });

    describe("endsWith", () => {
        it("should check if string ends with substring", () => {
            expectTypeOf<EndsWith<"hello world", "world">>().toEqualTypeOf<true>();
            expectTypeOf<EndsWith<"hello world", "hello">>().toEqualTypeOf<false>();
        });

        it("should handle position parameter", () => {
            expectTypeOf<EndsWith<"hello world", "hello", 5>>().toEqualTypeOf<true>();
        });
    });

    describe("includes", () => {
        it("should check if string includes substring", () => {
            expectTypeOf<Includes<"hello world", "world">>().toEqualTypeOf<true>();
            expectTypeOf<Includes<"hello world", "xyz">>().toEqualTypeOf<false>();
        });

        it("should handle position parameter", () => {
            expectTypeOf<Includes<"hello world", "world", 6>>().toEqualTypeOf<true>();
            expectTypeOf<Includes<"hello world", "hello", 1>>().toEqualTypeOf<false>();
        });
    });

    describe("length", () => {
        it("should return correct length for literal strings", () => {
            expectTypeOf<Length<"hello">>().toEqualTypeOf<5>();
            expectTypeOf<Length<"">>().toEqualTypeOf<0>();
        });

        it("should return number for non-literal strings", () => {
            // eslint-disable-next-line sonarjs/redundant-type-aliases
            type DynamicString = string;

            expectTypeOf<Length<DynamicString>>().toEqualTypeOf<number>();
        });
    });

    describe("padStart/PadEnd", () => {
        it("should pad start correctly", () => {
            expectTypeOf<PadStart<"hello", 7>>().toEqualTypeOf<"  hello">();
            expectTypeOf<PadStart<"hello", 7, "_">>().toEqualTypeOf<"__hello">();
        });

        it("should pad end correctly", () => {
            expectTypeOf<PadEnd<"hello", 7>>().toEqualTypeOf<"hello  ">();
            expectTypeOf<PadEnd<"hello", 7, "_">>().toEqualTypeOf<"hello__">();
        });
    });

    describe("replace/ReplaceAll", () => {
        it("should replace first occurrence", () => {
            expectTypeOf<Replace<"hello hello", "hello", "hi">>().toEqualTypeOf<"hi hello">();
        });

        it("should replace all occurrences", () => {
            expectTypeOf<ReplaceAll<"hello hello", "hello", "hi">>().toEqualTypeOf<"hi hi">();
        });
    });

    describe("slice", () => {
        it("should slice string correctly", () => {
            expectTypeOf<Slice<"hello", 1, 4>>().toEqualTypeOf<"ell">();
            expectTypeOf<Slice<"hello", 1>>().toEqualTypeOf<"ello">();
        });
    });

    describe("split", () => {
        it("should split string correctly", () => {
            expectTypeOf<Split<"hello world", " ">>().toEqualTypeOf<["hello", "world"]>();
            expectTypeOf<Split<"a,b,c", ",">>().toEqualTypeOf<["a", "b", "c"]>();
        });
    });

    describe("startsWith", () => {
        it("should check if string starts with substring", () => {
            expectTypeOf<StartsWith<"hello world", "hello">>().toEqualTypeOf<true>();
            expectTypeOf<StartsWith<"hello world", "world">>().toEqualTypeOf<false>();
        });

        it("should handle position parameter", () => {
            expectTypeOf<StartsWith<"hello world", "world", 6>>().toEqualTypeOf<true>();
        });
    });

    describe("trim/TrimStart/TrimEnd", () => {
        it("should trim whitespace correctly", () => {
            expectTypeOf<Trim<" hello ">>().toEqualTypeOf<"hello">();
            expectTypeOf<TrimStart<" hello ">>().toEqualTypeOf<"hello ">();
            expectTypeOf<TrimEnd<" hello ">>().toEqualTypeOf<" hello">();
        });
    });

    describe("reverse", () => {
        it("should reverse string correctly", () => {
            expectTypeOf<Reverse<"hello">>().toEqualTypeOf<"olleh">();
            expectTypeOf<Reverse<"a">>().toEqualTypeOf<"a">();
            expectTypeOf<Reverse<"">>().toEqualTypeOf<"">();
        });
    });

    describe("toLowerCase/ToUpperCase", () => {
        it("should convert to lowercase correctly", () => {
            expectTypeOf<ToLowerCase<"HELLO">>().toEqualTypeOf<"hello">();
            expectTypeOf<ToLowerCase<"HeLLo">>().toEqualTypeOf<"hello">();
        });

        it("should convert to uppercase correctly", () => {
            expectTypeOf<ToUpperCase<"hello">>().toEqualTypeOf<"HELLO">();
            expectTypeOf<ToUpperCase<"HeLLo">>().toEqualTypeOf<"HELLO">();
        });

        it("should return string type for non-literal inputs", () => {
            // eslint-disable-next-line sonarjs/redundant-type-aliases
            type DynamicString = string;

            expectTypeOf<ToLowerCase<DynamicString>>().toEqualTypeOf<string>();
            expectTypeOf<ToUpperCase<DynamicString>>().toEqualTypeOf<string>();
        });
    });
});
