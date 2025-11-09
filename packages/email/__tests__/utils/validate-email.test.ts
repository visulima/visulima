import { describe, expect, it } from "vitest";

import { validateEmail } from "../../src/utils/validate-email.js";

describe(validateEmail, () => {
    it("should validate correct email addresses", () => {
        expect(validateEmail("user@example.com")).toBe(true);
        expect(validateEmail("user.name@example.co.uk")).toBe(true);
        expect(validateEmail("user+tag@example.com")).toBe(true);
    });

    it("should reject invalid email addresses", () => {
        expect(validateEmail("invalid")).toBe(false);
        expect(validateEmail("@example.com")).toBe(false);
        expect(validateEmail("user@")).toBe(false);
        expect(validateEmail("user@example")).toBe(false);
    });
});
