import { describe, expect, expectTypeOf, it } from "vitest";

import DirectoryError from "../../../src/error/directory-error";

describe("directoryError", () => {
    it("should set the error message and code when creating a new instance with a message", () => {
        expect.assertions(2);

        const errorMessage = "Invalid directory";
        const directoryError = new DirectoryError(errorMessage);

        expect(directoryError.message).toBe(`EISDIR: Illegal operation on a directory, ${errorMessage}`);
        expect(directoryError.code).toBe("EISDIR");
    });

    it("should include the provided message in the error message", () => {
        expect.assertions(1);

        const errorMessage = "Invalid directory";
        const directoryError = new DirectoryError(errorMessage);

        expect(directoryError.message).toContain(errorMessage);
    });

    it("should have the error code set to \"EISDIR\"", () => {
        expect.assertions(1);

        const errorMessage = "Invalid directory";
        const directoryError = new DirectoryError(errorMessage);

        expect(directoryError.code).toBe("EISDIR");
    });

    it("should set the error message to a default value when creating a new instance without a message", () => {
        expect.assertions(1);

        const directoryError = new DirectoryError("");

        expect(directoryError.message).toBe("EISDIR: Illegal operation on a directory, ");
    });

    it("should throw an error when trying to overwrite the error name", () => {
        expect.assertions(1);

        const directoryError = new DirectoryError("Invalid directory");

        expect(() => {
            directoryError.name = "NewName";
        }).toThrow("Cannot overwrite name of DirectoryError");
    });

    it("should have the error message as a string", () => {
        expect.assertions(0);

        const errorMessage = "Invalid directory";
        const directoryError = new DirectoryError(errorMessage);

        expectTypeOf(directoryError.message).toBeString();
    });

    it("should be read-only when accessing the code property", () => {
        expect.assertions(1);

        const error = new DirectoryError("Invalid operation");

        expect(() => {
            error.code = "EISDIR";
        }).toThrow("Cannot overwrite code EISDIR");
    });
});
