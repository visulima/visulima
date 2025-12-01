import { beforeEach, describe, expect, it, vi } from "vitest";

import { areDisposableEmails, isDisposableEmail } from "../src/index";

describe(isDisposableEmail, () => {
    beforeEach(() => {
        // Clear module cache to reset cached data between tests
        vi.resetModules();
    });

    describe(isDisposableEmail, () => {
        it("should detect disposable email addresses", () => {
            expect.assertions(4);
            expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
            expect(isDisposableEmail("test@trashmail.com")).toBe(true);
            expect(isDisposableEmail("email@guerrillamail.com")).toBe(true);
            expect(isDisposableEmail("temp@10minutemail.com")).toBe(true);
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
            expect(isDisposableEmail("user@10MINUTEMAIL.COM")).toBe(true);
            expect(isDisposableEmail("USER@trashmail.com")).toBe(true);
            expect(isDisposableEmail("User@TrashMail.Com")).toBe(true);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com", "test-temp.com"]);

            expect(isDisposableEmail("user@custom-disposable.com", customDomains)).toBe(true);
            expect(isDisposableEmail("user@test-temp.com", customDomains)).toBe(true);
        });

        it("should return false for invalid email formats", () => {
            expect.assertions(5);
            expect(isDisposableEmail("")).toBe(false);
            expect(isDisposableEmail("invalid")).toBe(false);
            expect(isDisposableEmail("@10minutemail.com")).toBe(false);
            expect(isDisposableEmail("user@")).toBe(false);
            expect(isDisposableEmail("user@10minutemail")).toBe(false);
        });

        it("should handle whitespace", () => {
            expect.assertions(2);
            expect(isDisposableEmail("  user@10minutemail.com  ")).toBe(true);
            expect(isDisposableEmail("\tuser@10minutemail.com\n")).toBe(true);
        });
    });

    describe(areDisposableEmails, () => {
        it("should check multiple emails", () => {
            expect.assertions(3);

            const emails = ["user@10minutemail.com", "user@example.com", "test@trashmail.com"];
            const results = areDisposableEmails(emails);

            expect(results.size).toBe(3);
            expect(results.get("user@10minutemail.com")).toBe(true);
            expect(results.get("user@example.com")).toBe(false);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com"]);
            const emails = ["user@custom-disposable.com", "user@example.com"];
            const results = areDisposableEmails(emails, customDomains);

            expect(results.get("user@custom-disposable.com")).toBe(true);
            expect(results.get("user@example.com")).toBe(false);
        });

        it("should handle invalid emails", () => {
            expect.assertions(3);

            const emails = ["", "invalid", "@10minutemail.com"];
            const results = areDisposableEmails(emails);

            expect(results.get("")).toBe(false);
            expect(results.get("invalid")).toBe(false);
            expect(results.get("@10minutemail.com")).toBe(false);
        });
    });
});
