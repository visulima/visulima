import { describe, expect, it } from "vitest";

import { assertNextPartSize, isBadDigest, MIN_PART_SIZE, withoutParts } from "../../../src/storage/aws/s3-utils";

describe("s3 utils", () => {
    describe(withoutParts, () => {
        it("drops the parts list and keeps everything else", () => {
            expect.assertions(1);

            expect(withoutParts({ bytesWritten: 5, id: "a", Parts: [{ PartNumber: 1 }] })).toStrictEqual({ bytesWritten: 5, id: "a" });
        });
    });

    describe(isBadDigest, () => {
        it("recognizes BadDigest by code, name or message", () => {
            expect.assertions(4);

            expect(isBadDigest({ Code: "BadDigest" })).toBe(true);
            expect(isBadDigest(Object.assign(new Error("x"), { name: "BadDigest" }))).toBe(true);
            expect(isBadDigest(new Error("BadDigest: md5 mismatch"))).toBe(true);
            expect(isBadDigest(new Error("NoSuchUpload"))).toBe(false);
        });
    });

    describe(assertNextPartSize, () => {
        it("rejects a non-final part under 5 MiB", () => {
            expect.assertions(1);

            expect(() => assertNextPartSize({ contentLength: 1024, start: 0 }, { bytesWritten: 0, size: MIN_PART_SIZE * 2 })).toThrow(
                expect.objectContaining({ UploadErrorCode: "BadRequest" }),
            );
        });

        it("accepts a small final part and parts of at least 5 MiB", () => {
            expect.assertions(2);

            expect(() =>
                assertNextPartSize({ contentLength: 1024, start: MIN_PART_SIZE }, { bytesWritten: MIN_PART_SIZE, size: MIN_PART_SIZE + 1024 }),
            ).not.toThrow();
            expect(() => assertNextPartSize({ contentLength: MIN_PART_SIZE, start: 0 }, { bytesWritten: 0, size: MIN_PART_SIZE * 3 })).not.toThrow();
        });
    });
});
