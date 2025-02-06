import { describe, expect, it } from "vitest";

import { flipCase } from "../../../src/case";

describe("flipCase", () => {
    it("should flip case of mixed case string", () => {
        expect(flipCase("FooBar")).toBe("fOObAR");
        expect(flipCase("fooBar")).toBe("FOObAR");
    });

    it("should flip case of uppercase string", () => {
        expect(flipCase("FOO")).toBe("foo");
        expect(flipCase("FOOBAR")).toBe("foobar");
    });

    it("should flip case of lowercase string", () => {
        expect(flipCase("foo")).toBe("FOO");
        expect(flipCase("foobar")).toBe("FOOBAR");
    });

    it("should handle non-letter characters", () => {
        expect(flipCase("Foo123Bar")).toBe("fOO123bAR");
        expect(flipCase("foo-bar")).toBe("FOO-BAR");
    });

    it("should handle empty string", () => {
        expect(flipCase("")).toBe("");
    });

    describe("emoji support 🎯", () => {
        it("should handle emojis in text", () => {
            expect(flipCase("Foo🐣Bar")).toBe("fOO🐣bAR");
            expect(flipCase("hello🌍World")).toBe("HELLO🌍wORLD");
            expect(flipCase("test🎉Party🎈Fun")).toBe("TEST🎉pARTY🎈fUN");
            expect(flipCase("EMOJI👾Gaming")).toBe("emoji👾gAMING");
            expect(flipCase("upper🚀Case")).toBe("UPPER🚀cASE");
            expect(flipCase("snake_case_🐍_test")).toBe("SNAKE_CASE_🐍_TEST");
            expect(flipCase("kebab-case-🍔-test")).toBe("KEBAB-CASE-🍔-TEST");
            expect(flipCase("flip🤭Case")).toBe("FLIP🤭cASE");
        });
    });
});
