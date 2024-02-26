import { describe, expect, it } from "vitest";

import { padEnd } from "../../src/util/pad-end";

describe("padEnd", () => {
    it("should return the same string when its length is equal to the target length", () => {
        expect.assertions(1);

        const result = padEnd("hello", 5);

        expect(result).toBe("hello");
    });

    it("should pad the string with spaces at the end to match the target length", () => {
        expect.assertions(1);

        const result = padEnd("hello", 8);

        expect(result).toBe("hello   ");
    });

    it("should return an string when the target length is 0", () => {
        expect.assertions(1);

        const result = padEnd("hello", 0);

        expect(result).toBe("hello");
    });

    it("should return the same string when the target length is negative", () => {
        expect.assertions(1);

        const result = padEnd("hello", -5);

        expect(result).toBe("hello");
    });

    it("should return the same string when the input string is empty", () => {
        expect.assertions(1);

        const result = padEnd("", 5);

        expect(result).toBe("     ");
    });
});
