import { describe, expect, it } from "vitest";

import indexToPosition from "../../../src/utils/index-to-position";

describe("indexToPosition", () => {
    it("should return an object with line and column properties", () => {
        expect.assertions(1);

        const result = indexToPosition("Hello\nWorld", 6);

        expect(result).toStrictEqual({ column: 0, line: 1 });
    });

    it("should return {line: 0, column: 0} for textIndex = 0", () => {
        expect.assertions(1);

        const result = indexToPosition("Hello\nWorld", 0);

        expect(result).toStrictEqual({ column: 0, line: 0 });
    });

    it("should return {line: 0, column: 1} for empty text and textIndex = 0", () => {
        expect.assertions(1);

        const result = indexToPosition("", 0);

        expect(result).toStrictEqual({ column: 0, line: 1 });
    });

    it("should return {line: 0, column: 1} for textIndex < 0", () => {
        expect.assertions(1);

        const result = indexToPosition("Hello\nWorld", -1);

        expect(result).toStrictEqual({ column: 0, line: 1 });
    });

    it("should throw a error for textIndex >= text.length", () => {
        expect.assertions(1);

        expect(() => indexToPosition("Hello\nWorld", 12)).toThrow("Index out of bounds");
    });
});
