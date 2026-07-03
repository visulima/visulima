import { describe, expect, it } from "vitest";

import { RestrictionError, validateFile, validateFiles } from "../../src/core/restrictions";

const makeFile = (name: string, size: number, type = ""): File => {
    const blob = new Blob([new Uint8Array(size)], { type });

    return new File([blob], name, { type });
};

/** Runs `function_` and returns whatever it throws, so assertions stay out of `catch`. */
const captureError = (function_: () => void): unknown => {
    try {
        function_();
    } catch (error) {
        return error;
    }

    return undefined;
};

describe("restrictions", () => {
    describe(validateFile, () => {
        it("should pass when no restrictions are configured", () => {
            expect.assertions(1);

            expect(() => {
                validateFile(makeFile("a.txt", 10));
            }).not.toThrow();
        });

        it("should reject a file larger than maxFileSize", () => {
            expect.assertions(2);

            const error = captureError(() => {
                validateFile(makeFile("big.bin", 100), { maxFileSize: 50 });
            });

            expect(error).toBeInstanceOf(RestrictionError);
            expect((error as RestrictionError).reason).toBe("fileTooLarge");
        });

        it("should reject a file smaller than minFileSize", () => {
            expect.assertions(1);

            expect(() => {
                validateFile(makeFile("tiny.bin", 1), { minFileSize: 10 });
            }).toThrow(RestrictionError);
        });

        it("should accept an exact MIME type match", () => {
            expect.assertions(1);

            expect(() => {
                validateFile(makeFile("a.png", 10, "image/png"), { allowedFileTypes: ["image/png"] });
            }).not.toThrow();
        });

        it("should accept a wildcard MIME type match", () => {
            expect.assertions(1);

            expect(() => {
                validateFile(makeFile("a.jpg", 10, "image/jpeg"), { allowedFileTypes: ["image/*"] });
            }).not.toThrow();
        });

        it("should accept an extension match", () => {
            expect.assertions(1);

            expect(() => {
                validateFile(makeFile("doc.pdf", 10, "application/pdf"), { allowedFileTypes: [".pdf"] });
            }).not.toThrow();
        });

        it("should reject a disallowed type", () => {
            expect.assertions(2);

            const error = captureError(() => {
                validateFile(makeFile("a.exe", 10, "application/x-msdownload"), { allowedFileTypes: ["image/*"] });
            });

            expect(error).toBeInstanceOf(RestrictionError);
            expect((error as RestrictionError).reason).toBe("typeNotAllowed");
        });
    });

    describe(validateFiles, () => {
        it("should reject too many files", () => {
            expect.assertions(2);

            const error = captureError(() => {
                validateFiles([makeFile("a", 1), makeFile("b", 1), makeFile("c", 1)], { maxNumberOfFiles: 2 });
            });

            expect(error).toBeInstanceOf(RestrictionError);
            expect((error as RestrictionError).reason).toBe("tooManyFiles");
        });

        it("should validate each file in the batch", () => {
            expect.assertions(1);

            expect(() => {
                validateFiles([makeFile("a", 10), makeFile("b", 100)], { maxFileSize: 50 });
            }).toThrow(RestrictionError);
        });
    });
});
