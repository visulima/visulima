import { describe, expect, it } from "vitest";

import { getIndexOfNearestSpace } from "../../../src/utils/get-index-of-nearest-space";

describe("getIndexOfNearestSpace", () => {
    it("should return the same index if it's already a space", () => {
        expect.assertions(1);

        expect(getIndexOfNearestSpace("Hello World", 5)).toBe(5);
    });

    it("should find nearest space to the left by default", () => {
        expect.assertions(1);

        expect(getIndexOfNearestSpace("Hello World", 7)).toBe(5);
    });

    it("should find nearest space to the right when searchRight is true", () => {
        expect.assertions(1);

        expect(getIndexOfNearestSpace("Hello World", 3, true)).toBe(5);
    });

    it("should return target index if no space found within 3 characters", () => {
        expect.assertions(2);

        expect(getIndexOfNearestSpace("HelloWorld", 4)).toBe(4);
        expect(getIndexOfNearestSpace("HelloWorld", 4, true)).toBe(4);
    });

    it("should handle text with multiple spaces", () => {
        expect.assertions(2);

        expect(getIndexOfNearestSpace("Hello  World", 7)).toBe(6);
        expect(getIndexOfNearestSpace("Hello  World", 4, true)).toBe(5);
    });

    it("should handle text with leading spaces", () => {
        expect.assertions(2);

        expect(getIndexOfNearestSpace("  Hello", 3)).toBe(1);
        expect(getIndexOfNearestSpace("  Hello", 0, true)).toBe(0);
    });

    it("should handle text with trailing spaces", () => {
        expect.assertions(2);

        expect(getIndexOfNearestSpace("Hello  ", 6)).toBe(6);
        expect(getIndexOfNearestSpace("Hello  ", 4, true)).toBe(5);
    });
});
