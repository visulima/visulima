import { describe, expect, it } from "vitest";

import { ErrorMap, ERRORS, isUploadError, throwErrorCode, UploadError } from "../../src/utils/errors";

describe("utils", () => {
    describe("errors", () => {
        it("errorMap", () => {
            expect(Object.keys(ERRORS)).toHaveLength(Object.keys(ErrorMap).length);
        });

        it("isUploadError", () => {
            // eslint-disable-next-line unicorn/error-message
            expect(isUploadError(new Error(""))).toBe(false);
            expect(isUploadError(new UploadError("BadRequest"))).toBe(true);
        });

        it("throwErrorCode", () => {
            expect(() => throwErrorCode("BadRequest")).toThrow(UploadError);
        });
    });
});
