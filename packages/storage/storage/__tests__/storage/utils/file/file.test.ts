import { describe, expect, it } from "vitest";

import File from "../../../../src/storage/utils/file/file";
import getFileStatus from "../../../../src/storage/utils/file/get-file-status";

describe(File, () => {
    it("should keep a declared size of 0 as an empty file", () => {
        expect.assertions(2);

        expect(new File({ metadata: {}, size: 0 }).size).toBe(0);
        expect(new File({ metadata: { size: "0" } }).size).toBe(0);
    });

    it.each<[number | string | undefined]>([[undefined], [Number.NaN], [-1], ["abc"]])("should read size %p as unknown", (size) => {
        expect.assertions(1);

        expect(new File({ metadata: {}, size }).size).toBeUndefined();
    });
});

describe(getFileStatus, () => {
    it("should complete an empty upload only once a write stored it", () => {
        expect.assertions(2);

        const file = new File({ metadata: {}, size: 0 });

        file.bytesWritten = 0;

        // At create: nothing is stored yet.
        expect(getFileStatus(file)).toBe("created");

        file.createdAt = new Date().toISOString();

        expect(getFileStatus(file)).toBe("completed");
    });
});
