import { describe, expect, it } from "vitest";

import FileName from "../../../../src/storage/utils/file/file-name";

describe("File", () => {
    describe("FileName", () => {
        it.each([
            ["", false],
            ["..", false],
            ["c:\\abs", false],
            ["12", false],
            ["filename?.ext", false],
            ["../filename.ext", false],
            ["/filename.ext", false],
            ["filename.ext", true],
        ])("isValid(%s) === %s", (string_, expected) => {
            expect(FileName.isValid(string_)).toBe(expected);
        });
    });
});
