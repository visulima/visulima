import type { Stats } from "node:fs";

import { describe, expect, it } from "vitest";

import { getFileInfoType } from "../../../src/ensure/utils/get-file-info-type";

describe(getFileInfoType, () => {
    it("should return undefined if type is not found", () => {
        expect.assertions(1);

        const fileInfo = {
            isDirectory: () => false,
            isFile: () => false,
            isSymbolicLink: () => false,
        };

        const result = getFileInfoType(fileInfo as Stats);

        expect(result).toBeUndefined();
    });

    it("should return \"file\" if type is file", () => {
        expect.assertions(1);

        const fileInfo = {
            isDirectory: () => false,
            isFile: () => true,
            isSymbolicLink: () => false,
        };

        const result = getFileInfoType(fileInfo as Stats);

        expect(result).toBe("file");
    });

    it("should return \"dir\" if type is directory", () => {
        expect.assertions(1);

        const fileInfo = {
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => false,
        };

        const result = getFileInfoType(fileInfo as Stats);

        expect(result).toBe("dir");
    });

    it("should return \"symlink\" if type is symlink", () => {
        expect.assertions(1);

        const fileInfo = {
            isDirectory: () => false,
            isFile: () => false,
            isSymbolicLink: () => true,
        };

        const result = getFileInfoType(fileInfo as Stats);

        expect(result).toBe("symlink");
    });
});
