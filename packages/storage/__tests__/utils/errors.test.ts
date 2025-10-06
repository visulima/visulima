import { describe, expect, it } from "vitest";

import { ErrorMap, ERRORS, isUploadError, throwErrorCode, UploadError } from "../../src/utils/errors";

describe("utils", () => {
    describe("errors", () => {
        it("should have matching ERROR constants and ErrorMap keys", () => {
            expect.assertions(1);

            expect(Object.keys(ERRORS)).toHaveLength(Object.keys(ErrorMap).length);
        });

        it("should correctly identify UploadError instances", () => {
            expect.assertions(2);

            // eslint-disable-next-line unicorn/error-message
            expect(isUploadError(new Error(""))).toBe(false);
            expect(isUploadError(new UploadError("BadRequest"))).toBe(true);
        });

        it("should throw UploadError when calling throwErrorCode", () => {
            expect.assertions(1);

            expect(() => throwErrorCode("BadRequest")).toThrow(UploadError);
        });
    });
});
