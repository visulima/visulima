import { describe, expect, it } from "vitest";

import PermissionError from "../../../src/error/permission-error";

describe("permissionError", () => {
    it("should set the error message and code correctly when creating a new instance with a message", () => {
        expect.assertions(2);

        const errorMessage = "Invalid operation";
        const error = new PermissionError(errorMessage);

        expect(error.message).toBe(`EPERM: Operation not permitted, ${errorMessage}`);
        expect(error.code).toBe("EPERM");
    });

    it("should return \"PermissionError\" when accessing the name property", () => {
        expect.assertions(1);

        const error = new PermissionError("Invalid operation");

        expect(error.name).toBe("PermissionError");
    });

    it("should throw an error when trying to overwrite the name property", () => {
        expect.assertions(1);

        const error = new PermissionError("Invalid operation");

        expect(() => {
            error.name = "NewName";
        }).toThrow("Cannot overwrite name of PermissionError");
    });

    it("should be read-only when accessing the code property", () => {
        expect.assertions(1);

        const error = new PermissionError("Invalid operation");

        expect(() => {
            error.code = "EACCES";
        }).toThrow("Cannot overwrite code EPERM");
    });
});
