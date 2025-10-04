import { describe, expect, it } from "vitest";

import updateSize from "../../../../src/storage/utils/file/update-size";
import { metafile } from "../../../__helpers__/config";

describe("file", () => {
    describe(updateSize, () => {
        it("updateSize updates size when new size is smaller", () => {
            const file = { ...metafile, id: "123" };
            const updatedFile = updateSize(file, 50);

            expect(updatedFile).toEqual({ ...file, size: 50 });
        });

        it("updateSize does not update size when new size is larger", () => {
            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 200);

            expect(updatedFile).toEqual(file);
        });

        it("updateSize does not update size when new size is equal", () => {
            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 100);

            expect(updatedFile).toEqual(file);
        });

        it("updateSize handles negative sizes", () => {
            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, -50);

            expect(updatedFile).toEqual({ ...file, size: -50 });
        });

        it("updateSize handles zero size", () => {
            const file = {
                ...metafile,
                id: "123",
                name: "test.txt",
                size: 100,
            };
            const updatedFile = updateSize(file, 0);

            expect(updatedFile).toEqual({ ...file, size: 0 });
        });
    });
});
