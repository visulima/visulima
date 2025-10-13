import { describe, expect, it } from "vitest";

import getCallerFilename from "../../../../src/processor/caller/get-caller-filename";

describe(getCallerFilename, () => {
    it("should return the filename, line number, and column number when called from a function in a file", () => {
        expect.assertions(3);

        const result = getCallerFilename();

        expect(result.fileName).toBeDefined();
        expect(result.lineNumber).toBeDefined();
        expect(result.columnNumber).toBeDefined();
    });
});
