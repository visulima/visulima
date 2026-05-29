import { describe, expect, it } from "vitest";

import { unescape } from "../../src/util/unescape";

describe(unescape, () => {
    it("should decode a four-digit unicode escape", () => {
        expect.assertions(1);

        expect(unescape("u0041")).toBe("A");
    });

    it("should decode a bracketed unicode escape", () => {
        expect.assertions(1);

        expect(unescape("u{1F600}")).toBe("\u{1F600}");
    });

    it("should decode a two-digit hex escape", () => {
        expect.assertions(1);

        expect(unescape("x41")).toBe("A");
    });

    it("should decode a named escape sequence", () => {
        expect.assertions(1);

        expect(unescape("n")).toBe("\n");
    });

    it("should return the original character for an unknown escape", () => {
        expect.assertions(1);

        expect(unescape("z")).toBe("z");
    });
});
