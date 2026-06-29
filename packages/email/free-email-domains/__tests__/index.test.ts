import { beforeEach, describe, expect, it, vi } from "vitest";

import { areFreeEmails, extractDomain, isFreeDomain, isFreeEmail, preload } from "../src/index";

describe(isFreeEmail, () => {
    beforeEach(() => {
        // Clear module cache to reset cached data between tests
        vi.resetModules();
    });

    describe(isFreeEmail, () => {
        it("should detect free email addresses", () => {
            expect.assertions(3);
            expect(isFreeEmail("user@gmail.com")).toBe(true);
            expect(isFreeEmail("test@yahoo.com")).toBe(true);
            expect(isFreeEmail("hello@outlook.com")).toBe(true);
        });

        it("should not detect corporate/custom domains as free", () => {
            expect.assertions(3);
            expect(isFreeEmail("user@visulima.com")).toBe(false);
            expect(isFreeEmail("user@anolilab.com")).toBe(false);
            expect(isFreeEmail("user.name+tag@my-private-company.test")).toBe(false);
        });

        it("should be case-insensitive", () => {
            expect.assertions(3);
            expect(isFreeEmail("user@GMAIL.COM")).toBe(true);
            expect(isFreeEmail("USER@yahoo.com")).toBe(true);
            expect(isFreeEmail("User@OutLook.Com")).toBe(true);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-free.test", "my-free-mail.test"]);

            expect(isFreeEmail("user@custom-free.test", customDomains)).toBe(true);
            expect(isFreeEmail("user@my-free-mail.test", customDomains)).toBe(true);
        });

        it("should return false for invalid email formats", () => {
            expect.assertions(5);
            expect(isFreeEmail("")).toBe(false);
            expect(isFreeEmail("invalid")).toBe(false);
            expect(isFreeEmail("@gmail.com")).toBe(false);
            expect(isFreeEmail("user@")).toBe(false);
            expect(isFreeEmail("user@gmail")).toBe(false);
        });

        it("should handle whitespace", () => {
            expect.assertions(2);
            expect(isFreeEmail("  user@gmail.com  ")).toBe(true);
            expect(isFreeEmail("\tuser@gmail.com\n")).toBe(true);
        });

        it("should match subdomains against parent free domains (wildcard)", () => {
            expect.assertions(3);
            // `gmail.com` is in the list but `mail.gmail.com` is not, so the
            // parent-domain wildcard loop must resolve the match.
            expect(isFreeEmail("user@mail.gmail.com")).toBe(true);
            expect(isFreeEmail("user@a.b.yahoo.com")).toBe(true);
            // A subdomain of a non-free parent must still be false.
            expect(isFreeEmail("user@sub.visulima.com")).toBe(false);
        });

        it("should match subdomains against custom parent domains (wildcard)", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-free.test"]);

            // Custom domains use the same wildcard/subdomain semantics as the built-in list.
            expect(isFreeEmail("user@custom-free.test", customDomains)).toBe(true);
            expect(isFreeEmail("user@sub.custom-free.test", customDomains)).toBe(true);
        });

        it("should accept an options object with customDomains", () => {
            expect.assertions(2);

            expect(isFreeEmail("user@custom-free.test", { customDomains: new Set(["custom-free.test"]) })).toBe(true);
            expect(isFreeEmail("user@sub.custom-free.test", { customDomains: new Set(["custom-free.test"]) })).toBe(true);
        });

        it("should not flag allowlisted domains even if they are in the built-in list", () => {
            expect.assertions(3);

            const allowDomains = new Set(["gmail.com"]);

            // Without the allowlist this is a free provider.
            expect(isFreeEmail("user@gmail.com")).toBe(true);
            // The allowlist wins over the built-in list.
            expect(isFreeEmail("user@gmail.com", { allowDomains })).toBe(false);
            // And it applies to subdomains via the parent-domain loop.
            expect(isFreeEmail("user@a.b.gmail.com", { allowDomains })).toBe(false);
        });

        it("should let the allowlist override custom domains", () => {
            expect.assertions(1);

            expect(
                isFreeEmail("user@custom-free.test", {
                    allowDomains: new Set(["custom-free.test"]),
                    customDomains: new Set(["custom-free.test"]),
                }),
            ).toBe(false);
        });
    });

    describe(isFreeDomain, () => {
        it("should check a bare domain without an email wrapper", () => {
            expect.assertions(3);
            expect(isFreeDomain("gmail.com")).toBe(true);
            expect(isFreeDomain("mail.yahoo.com")).toBe(true);
            expect(isFreeDomain("visulima.com")).toBe(false);
        });

        it("should return false for invalid input", () => {
            expect.assertions(2);
            expect(isFreeDomain("")).toBe(false);
            // @ts-expect-error - testing runtime guard
            expect(isFreeDomain(undefined)).toBe(false);
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

            module.setDomains(["injected-free.test"]);

            expect(module.isListLoaded()).toBe(true);
            expect(module.isFreeEmail("user@injected-free.test")).toBe(true);
            // The built-in list is no longer consulted once injected.
            expect(module.isFreeEmail("user@gmail.com")).toBe(false);
        });

        it("preload resolves without throwing", async () => {
            expect.assertions(1);

            await expect(preload()).resolves.toBeUndefined();
        });
    });

    describe(areFreeEmails, () => {
        it("should check multiple emails", () => {
            expect.assertions(3);

            const emails = ["user@gmail.com", "user@visulima.com", "test@yahoo.com"];
            const results = areFreeEmails(emails);

            expect(results.size).toBe(3);
            expect(results.get("user@gmail.com")).toBe(true);
            expect(results.get("user@visulima.com")).toBe(false);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-free.test"]);
            const emails = ["user@custom-free.test", "user@visulima.com"];
            const results = areFreeEmails(emails, customDomains);

            expect(results.get("user@custom-free.test")).toBe(true);
            expect(results.get("user@visulima.com")).toBe(false);
        });

        it("should handle invalid emails", () => {
            expect.assertions(3);

            const emails = ["", "invalid", "@gmail.com"];
            const results = areFreeEmails(emails);

            expect(results.get("")).toBe(false);
            expect(results.get("invalid")).toBe(false);
            expect(results.get("@gmail.com")).toBe(false);
        });
    });
});
