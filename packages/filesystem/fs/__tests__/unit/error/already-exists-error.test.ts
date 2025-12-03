import { describe, expect, it } from "vitest";

import { AlreadyExistsError } from "../../../src/error";

describe("alreadyExistsError", () => {
    it("should set the message as the error message when creating a new instance with a message", () => {
        expect.assertions(1);

        const errorMessage = "File already exists";
        const error = new AlreadyExistsError(errorMessage);

        expect(error.message).toBe(`EEXIST: ${errorMessage}`);
    });

    it("should have the name 'AlreadyExistsError'", () => {
        expect.assertions(1);

        const error = new AlreadyExistsError("File already exists");

        expect(error.name).toBe("AlreadyExistsError");
    });

    it("should have the code 'EEXIST'", () => {
        expect.assertions(1);

        const error = new AlreadyExistsError("File already exists");

        expect(error.code).toBe("EEXIST");
    });

    it("should throw an error when overriding the name property", () => {
        expect.assertions(1);

        const error = new AlreadyExistsError("File already exists");

        expect(() => {
            error.name = "CustomError";
        }).toThrow("Cannot overwrite name of AlreadyExistsError");
    });

    it("should be read-only when accessing the code property", () => {
        expect.assertions(1);

        const error = new AlreadyExistsError("Invalid operation");

        expect(() => {
            error.code = "EEXIST";
        }).toThrow("Cannot overwrite code EEXIST");
    });
});
