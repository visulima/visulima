import { describe, expect, it } from "vitest";

import ValidationError from "../../src/utils/validation-error";

describe("utils", () => {
    describe("validation-error", () => {
        it("should be a Error", () => {
            const body = {
                message: "test",
                code: "test",
            };
            const error = new ValidationError("test", 200, body, {});

            expect(() => {
                throw error;
            }).toThrowError("test");

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(ValidationError);
            expect(error.message).toBe("test");
            expect(error.code).toBe("test");
            expect(error.statusCode).toBe(200);
            expect(error.body).toStrictEqual(body);
            expect(error.headers).toStrictEqual({});
        });
    });
});
