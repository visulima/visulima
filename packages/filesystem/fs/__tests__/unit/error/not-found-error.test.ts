import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../../src/error";

describe("notFoundError", () => {
    it("should prefix the message with ENOENT when creating a new instance", () => {
        expect.assertions(1);

        const errorMessage = "no such file or directory, open '/tmp/missing.txt'";
        const error = new NotFoundError(errorMessage);

        expect(error.message).toBe(`ENOENT: ${errorMessage}`);
    });

    it("should have the name 'NotFoundError'", () => {
        expect.assertions(1);

        const error = new NotFoundError("missing");

        expect(error.name).toBe("NotFoundError");
    });

    it("should have the code 'ENOENT'", () => {
        expect.assertions(1);

        const error = new NotFoundError("missing");

        expect(error.code).toBe("ENOENT");
    });

    it("should be an instance of Error", () => {
        expect.assertions(2);

        const error = new NotFoundError("missing");

        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(NotFoundError);
    });

    it("should throw an error when overriding the name property", () => {
        expect.assertions(1);

        const error = new NotFoundError("missing");

        expect(() => {
            error.name = "CustomError";
        }).toThrow("Cannot overwrite name of NotFoundError");
    });

    it("should throw an error when overriding the code property", () => {
        expect.assertions(1);

        const error = new NotFoundError("missing");

        expect(() => {
            error.code = "ENOENT";
        }).toThrow("Cannot overwrite code ENOENT");
    });
});
