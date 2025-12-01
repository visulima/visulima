import { describe, expect, it } from "vitest";

import { isDisposableEmail } from "../../src/utils/validation/disposable-email-domains";

describe(isDisposableEmail, () => {
    it("should detect disposable email addresses from exact matches", () => {
        expect.assertions(4);
        expect(isDisposableEmail("user@mailinator.com")).toBe(true);
        expect(isDisposableEmail("user@trashmail.com")).toBe(true);
        expect(isDisposableEmail("user@guerrillamail.com")).toBe(true);
        expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
    });

    it("should detect disposable email addresses from wildcard matches", () => {
        expect.assertions(2);
        expect(isDisposableEmail("user@subdomain.33mail.com")).toBe(true);
        expect(isDisposableEmail("user@anything.33mail.com")).toBe(true);
    });

    it("should not detect regular email addresses as disposable", () => {
        expect.assertions(4);
        expect(isDisposableEmail("user@example.com")).toBe(false);
        expect(isDisposableEmail("user@gmail.com")).toBe(false);
        expect(isDisposableEmail("user@company.co.uk")).toBe(false);
        expect(isDisposableEmail("user.name+tag@example.com")).toBe(false);
    });

    it("should be case-insensitive", () => {
        expect.assertions(3);
        expect(isDisposableEmail("user@MAILINATOR.COM")).toBe(true);
        expect(isDisposableEmail("USER@trashmail.com")).toBe(true);
        expect(isDisposableEmail("User@TrashMail.Com")).toBe(true);
    });

    it("should handle custom disposable domains", () => {
        expect.assertions(2);

        const customDomains = new Set(["custom-disposable.com", "test-temp.com"]);

        expect(isDisposableEmail("user@custom-disposable.com", customDomains)).toBe(true);
        expect(isDisposableEmail("user@test-temp.com", customDomains)).toBe(true);
    });

    it("should return false for invalid email formats", () => {
        expect.assertions(4);
        expect(isDisposableEmail("")).toBe(false);
        expect(isDisposableEmail("invalid")).toBe(false);
        expect(isDisposableEmail("@mailinator.com")).toBe(false);
        expect(isDisposableEmail("user@")).toBe(false);
    });

    it("should handle whitespace", () => {
        expect.assertions(2);
        expect(isDisposableEmail("  user@mailinator.com  ")).toBe(true);
        expect(isDisposableEmail("\tuser@mailinator.com\n")).toBe(true);
    });
});
