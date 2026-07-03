import { describe, expect, it } from "vitest";

import { direction } from "../../src/direction";

describe("direction function", () => {
    it("should classify nullish as neutral", () => {
        expect.assertions(1);

        // @ts-expect-error: missing argument.
        expect(direction()).toBe("neutral");
    });

    it("should classify numbers as neutral", () => {
        expect.assertions(2);

        expect(direction("0")).toBe("neutral");
        expect(direction("123")).toBe("neutral");
    });

    it("should classify single Latin characters as ltr", () => {
        expect.assertions(2);

        expect(direction("a")).toBe("ltr");
        expect(direction("A")).toBe("ltr");
    });

    it("should classify Hebrew characters as rtl", () => {
        expect.assertions(1);

        expect(direction("נ")).toBe("rtl");
    });

    it("should classify control characters and symbols as neutral", () => {
        expect.assertions(6);

        expect(direction("\u0000")).toBe("neutral");
        expect(direction(" ")).toBe("neutral");
        expect(direction("!")).toBe("neutral");
        expect(direction("@")).toBe("neutral");
        expect(direction("[")).toBe("neutral");
        expect(direction("`")).toBe("neutral");
    });

    it("should classify English words as ltr", () => {
        expect.assertions(6);

        expect(direction("english")).toBe("ltr");
        expect(direction("sentence")).toBe("ltr");
        expect(direction("Un")).toBe("ltr");
        expect(direction("simple")).toBe("ltr");
        expect(direction("anglais")).toBe("ltr");
        expect(direction("phrase")).toBe("ltr");
    });

    it("should classify Arabic characters as rtl", () => {
        expect.assertions(4);

        expect(direction("أ")).toBe("rtl");
        expect(direction("الجملة")).toBe("rtl");
        expect(direction("الانجليزية")).toBe("rtl");
        expect(direction("بسيطة")).toBe("rtl");
    });

    it("should classify empty string as neutral", () => {
        expect.assertions(1);

        expect(direction("")).toBe("neutral");
    });
});
