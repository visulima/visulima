import { describe, expect, it } from "vitest";

import {
    ErrorMap,
    ERRORS,
    extractHttpStatus,
    isUploadError,
    mapStatusToErrorCode,
    throwErrorCode,
    UploadError,
    wrapStorageError,
} from "../../src/utils/errors";

describe("utils", () => {
    describe("errors", () => {
        it("should have matching ERROR constants and ErrorMap keys", () => {
            expect.assertions(1);

            const errorValues = Object.values(ERRORS);
            const mapKeys = Object.keys(ErrorMap);

            expect(errorValues.toSorted()).toStrictEqual(mapKeys.toSorted());
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

        describe(extractHttpStatus, () => {
            it("should read `status` (Dropbox / Supabase / fetch)", () => {
                expect.assertions(1);
                expect(extractHttpStatus({ status: 404 })).toBe(404);
            });

            it("should read `statusCode` (Box / Graph)", () => {
                expect.assertions(1);
                expect(extractHttpStatus({ statusCode: 409 })).toBe(409);
            });

            it("should read numeric `code` (googleapis)", () => {
                expect.assertions(1);
                expect(extractHttpStatus({ code: 403 })).toBe(403);
            });

            it("should read `response.status` (axios-style)", () => {
                expect.assertions(1);
                expect(extractHttpStatus({ response: { status: 503 } })).toBe(503);
            });

            it("should return undefined for unknown shapes", () => {
                expect.assertions(3);
                expect(extractHttpStatus(undefined)).toBeUndefined();
                expect(extractHttpStatus(null)).toBeUndefined();
                expect(extractHttpStatus(new Error("boom"))).toBeUndefined();
            });

            it("should ignore non-numeric code fields (TRPC string codes)", () => {
                expect.assertions(1);
                expect(extractHttpStatus({ code: "NOT_FOUND" })).toBeUndefined();
            });
        });

        describe(mapStatusToErrorCode, () => {
            it.each([
                [400, ERRORS.BAD_REQUEST],
                [401, ERRORS.FORBIDDEN],
                [403, ERRORS.FORBIDDEN],
                [404, ERRORS.FILE_NOT_FOUND],
                [405, ERRORS.METHOD_NOT_ALLOWED],
                [409, ERRORS.FILE_CONFLICT],
                [410, ERRORS.GONE],
                [413, ERRORS.REQUEST_ENTITY_TOO_LARGE],
                [415, ERRORS.UNSUPPORTED_MEDIA_TYPE],
                [422, ERRORS.UNPROCESSABLE_ENTITY],
                [423, ERRORS.FILE_LOCKED],
                [429, ERRORS.TOO_MANY_REQUESTS],
                [503, ERRORS.STORAGE_BUSY],
                [500, ERRORS.STORAGE_ERROR],
                [502, ERRORS.STORAGE_ERROR],
                [418, ERRORS.BAD_REQUEST],
            ])("should map status %s → %s", (status, expected) => {
                expect.assertions(1);
                expect(mapStatusToErrorCode(status)).toBe(expected);
            });

            it("should fall back to STORAGE_ERROR for undefined status", () => {
                expect.assertions(1);
                expect(mapStatusToErrorCode(undefined)).toBe(ERRORS.STORAGE_ERROR);
            });

            it("should fall back to UNKNOWN_ERROR for non-HTTP status numbers", () => {
                expect.assertions(1);
                expect(mapStatusToErrorCode(200)).toBe(ERRORS.UNKNOWN_ERROR);
            });
        });

        describe(wrapStorageError, () => {
            it("should wrap a native error with status into an UploadError", () => {
                expect.assertions(4);

                const native = Object.assign(new Error("Not found"), { status: 404 });
                const wrapped = wrapStorageError(native, { adapter: "Dropbox", operation: "delete" });

                expect(wrapped).toBeInstanceOf(UploadError);
                expect(wrapped.UploadErrorCode).toBe(ERRORS.FILE_NOT_FOUND);
                expect(wrapped.message).toBe("Dropbox: delete failed — Not found");
                expect(wrapped.detail).toBe(native);
            });

            it("should pass through existing UploadError instances unchanged", () => {
                expect.assertions(1);

                const existing = new UploadError(ERRORS.FILE_CONFLICT, "already there");
                const wrapped = wrapStorageError(existing, { adapter: "Box", operation: "copy" });

                expect(wrapped).toBe(existing);
            });

            it("should honor an explicit code override", () => {
                expect.assertions(1);

                const wrapped = wrapStorageError(new Error("oops"), {
                    adapter: "OneDrive",
                    code: ERRORS.STORAGE_BUSY,
                    operation: "upload",
                });

                expect(wrapped.UploadErrorCode).toBe(ERRORS.STORAGE_BUSY);
            });

            it("should honor an explicit message override", () => {
                expect.assertions(1);

                const wrapped = wrapStorageError(new Error("ignored"), {
                    adapter: "GoogleDrive",
                    message: "Drive: resumable session failed: HTTP 500",
                    operation: "upload",
                });

                expect(wrapped.message).toBe("Drive: resumable session failed: HTTP 500");
            });

            it("should default to STORAGE_ERROR when no status is extractable", () => {
                expect.assertions(2);

                const wrapped = wrapStorageError(new Error("boom"), {
                    adapter: "Supabase",
                    operation: "list",
                });

                expect(wrapped.UploadErrorCode).toBe(ERRORS.STORAGE_ERROR);
                expect(wrapped.message).toBe("Supabase: list failed — boom");
            });

            it("should include `(HTTP N)` when the error carries a status but no message", () => {
                expect.assertions(1);

                const wrapped = wrapStorageError(
                    { status: 503 },
                    {
                        adapter: "OneDrive",
                        operation: "copy",
                    },
                );

                expect(wrapped.message).toBe("OneDrive: copy failed (HTTP 503)");
            });
        });
    });
});
