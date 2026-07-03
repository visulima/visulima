import { beforeEach, describe, expect, it, vi } from "vitest";

import { areDisposableEmails, extractDomain, isDisposableDomain, isDisposableEmail, preload } from "../src/index";

describe(isDisposableEmail, () => {
    beforeEach(() => {
        // Clear module cache to reset cached data between tests
        vi.resetModules();
    });

    describe(isDisposableEmail, () => {
        it("should detect disposable email addresses", () => {
            expect.assertions(3);
            expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
            expect(isDisposableEmail("test@trashmail.com")).toBe(true);
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

        it("should match subdomains against parent disposable domains (wildcard)", () => {
            expect.assertions(3);
            // `33mail.com` is in the list but `sub.33mail.com` is not, so the
            // parent-domain wildcard loop must resolve the match.
            expect(isDisposableEmail("user@sub.33mail.com")).toBe(true);
            expect(isDisposableEmail("user@a.b.10minutemail.com")).toBe(true);
            // A subdomain of a non-disposable parent must still be false.
            expect(isDisposableEmail("user@sub.example.com")).toBe(false);
        });

        it("should match subdomains against custom parent domains (wildcard)", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com"]);

            // Custom domains use the same wildcard/subdomain semantics as the built-in list.
            expect(isDisposableEmail("user@custom-disposable.com", customDomains)).toBe(true);
            expect(isDisposableEmail("user@sub.custom-disposable.com", customDomains)).toBe(true);
        });

        it("should accept an options object with customDomains", () => {
            expect.assertions(2);

            expect(isDisposableEmail("user@custom-disposable.com", { customDomains: new Set(["custom-disposable.com"]) })).toBe(true);
            expect(isDisposableEmail("user@sub.custom-disposable.com", { customDomains: new Set(["custom-disposable.com"]) })).toBe(true);
        });

        it("should not flag allowlisted domains even if they are in the built-in list", () => {
            expect.assertions(3);

            const allowDomains = new Set(["10minutemail.com"]);

            // Without the allowlist this is disposable.
            expect(isDisposableEmail("user@10minutemail.com")).toBe(true);
            // The allowlist wins over the built-in list.
            expect(isDisposableEmail("user@10minutemail.com", { allowDomains })).toBe(false);
            // And it applies to subdomains via the parent-domain loop.
            expect(isDisposableEmail("user@a.b.10minutemail.com", { allowDomains })).toBe(false);
        });

        it("should let the allowlist override custom domains", () => {
            expect.assertions(1);

            expect(
                isDisposableEmail("user@custom-disposable.com", {
                    allowDomains: new Set(["custom-disposable.com"]),
                    customDomains: new Set(["custom-disposable.com"]),
                }),
            ).toBe(false);
        });
    });

    describe(isDisposableDomain, () => {
        it("should check a bare domain without an email wrapper", () => {
            expect.assertions(3);
            expect(isDisposableDomain("10minutemail.com")).toBe(true);
            expect(isDisposableDomain("sub.33mail.com")).toBe(true);
            expect(isDisposableDomain("example.com")).toBe(false);
        });

        it("should return false for invalid input", () => {
            expect.assertions(2);
            expect(isDisposableDomain("")).toBe(false);
            // @ts-expect-error - testing runtime guard
            expect(isDisposableDomain(undefined)).toBe(false);
        });
    });

    describe(extractDomain, () => {
        it("should extract and normalize the domain", () => {
            expect.assertions(3);
            expect(extractDomain("User@Example.COM")).toBe("example.com");
            expect(extractDomain("a.b+tag@sub.domain.io")).toBe("sub.domain.io");
            expect(extractDomain("trailing@example.com.")).toBe("example.com");
        });

        it("should return undefined for invalid emails", () => {
            expect.assertions(3);
            expect(extractDomain("")).toBeUndefined();
            expect(extractDomain("nope")).toBeUndefined();
            expect(extractDomain("user@")).toBeUndefined();
        });
    });

    describe("edge runtime support", () => {
        it("setDomains injects a list and isListLoaded reflects it", async () => {
            expect.assertions(3);

            // Use a fresh module instance so mutating the cached Set does not leak
            // into other tests that rely on the real built-in list.
            vi.resetModules();

            const module = await import("../src/index");

            module.setDomains(["injected-disposable.test"]);

            expect(module.isListLoaded()).toBe(true);
            expect(module.isDisposableEmail("user@injected-disposable.test")).toBe(true);
            // The built-in list is no longer consulted once injected.
            expect(module.isDisposableEmail("user@10minutemail.com")).toBe(false);
        });

        it("preload resolves without throwing", async () => {
            expect.assertions(1);

            await expect(preload()).resolves.toBeUndefined();
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
