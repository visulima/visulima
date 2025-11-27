import { describe, expect, it } from "vitest";

import validateEmail from "../../src/utils/validate-email";

describe(validateEmail, () => {
    it("should validate correct email addresses", () => {
        expect.assertions(3);
        expect(validateEmail("user@example.com")).toBe(true);
        expect(validateEmail("user.name@example.co.uk")).toBe(true);
        expect(validateEmail("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid email addresses", () => {
        expect.assertions(4);
        expect(validateEmail("invalid")).toBe(false);
        expect(validateEmail("@example.com")).toBe(false);
        expect(validateEmail("user@")).toBe(false);
        expect(validateEmail("user@example")).toBe(false);
    });
});
