import { describe, expect, it } from "vitest";

import updateSize from "../../../../src/storage/utils/file/update-size";
import { metafile } from "../../../__helpers__/config";

describe("file", () => {
    describe(updateSize, () => {
        it("should update file size when new size is smaller than current size", () => {
            expect.assertions(1);

            const file = { ...metafile, id: "123" };
            const updatedFile = updateSize(file, 50);

            expect(updatedFile).toStrictEqual({ ...file, size: 50 });
        });

        it("should not update file size when new size is larger than current size", () => {
            expect.assertions(1);

            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 200);

            expect(updatedFile).toStrictEqual(file);
        });

        it("should not update file size when new size equals current size", () => {
            expect.assertions(1);

            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 100);

            expect(updatedFile).toStrictEqual(file);
        });

        it("should handle negative size values", () => {
            expect.assertions(1);

            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, -50);

            expect(updatedFile).toStrictEqual({ ...file, size: -50 });
        });

        it("should handle zero size values", () => {
            expect.assertions(1);

            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 0);

            expect(updatedFile).toStrictEqual({ ...file, size: 0 });
        });
    });
});
