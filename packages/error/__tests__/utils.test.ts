import { describe, expect, it } from "vitest";

import { normalizeLF, positionAt } from "../src/utils";

describe("utils", () => {
    describe("normalizeLF", () => {
        it("should normalize line endings to LF", () => {
            const source = "const x = 10;\r\nconst error = x.y;\r";

            expect(normalizeLF(source)).toBe("const x = 10;\nconst error = x.y;\n");
        });
    });

    describe("positionAt", () => {
        it("should return line 0 and the offset as column if the text is single-line", () => {
            const text = "Hello, world!";
            const offset = 7;

            expect(positionAt(offset, text)).toStrictEqual({ column: 7, line: 0 });
        });

        it("should return the correct line and column for a multi-line text", () => {
            const text = "Hello,\nworld!\nNew line here.";
            const offset = text.indexOf("world!");

            expect(positionAt(offset, text)).toStrictEqual({ column: 0, line: 1 });
        });

        it("should handle the offset at the very end of the text", () => {
            const text = "Hello,\nworld!";
            const offset = text.length;

            expect(positionAt(offset, text)).toStrictEqual({ column: 6, line: 1 });
        });

        it("should return the last line and remaining column if the offset is beyond text length", () => {
            const text = "Hello,\nworld!";
            const offset = text.length + 5; // beyond the text length

            expect(positionAt(offset, text)).toStrictEqual({ column: 6, line: 1 });
        });

        it("should handle zero offset", () => {
            const text = "Hello,\nworld!";
            const offset = 0;

            expect(positionAt(offset, text)).toStrictEqual({ column: 0, line: 0 });
        });

        it("should return the correct line and column when offset is at the end of a line", () => {
            const text = "Hello,\nworld!";
            const offset = text.indexOf("\n");

            expect(positionAt(offset, text)).toStrictEqual({ column: 6, line: 0 });
        });

        it("should return the correct line and column when offset is at the start of a line", () => {
            const text = "Hello,\nworld!";
            const offset = text.indexOf("w");

            expect(positionAt(offset, text)).toStrictEqual({ column: 0, line: 1 });
        });
    });
});
