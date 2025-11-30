import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
    batchCheckDomains,
    batchCheckEmails,
    getAllDomains,
    getDomainCount,
    getDomainList,
    getDomainMetadata,
    getDomainsBySource,
    getStatistics,
    isDisposableDomain,
    isDisposableEmail,
    searchDomains,
} from "../src/index";

// Mock domains.json data
const mockDomainsData = [
    {
        domain: "mailinator.com",
        firstSeen: "2024-01-01T00:00:00.000Z",
        lastSeen: "2024-01-15T00:00:00.000Z",
        sources: ["https://github.com/disposable-email-domains/disposable-email-domains"],
    },
    {
        domain: "trashmail.com",
        firstSeen: "2024-01-02T00:00:00.000Z",
        lastSeen: "2024-01-16T00:00:00.000Z",
        sources: ["https://github.com/disposable/disposable-email-domains"],
    },
    {
        domain: "guerrillamail.com",
        firstSeen: "2024-01-03T00:00:00.000Z",
        lastSeen: "2024-01-17T00:00:00.000Z",
        sources: ["https://github.com/disposable-email-domains/disposable-email-domains", "https://github.com/disposable/disposable-email-domains"],
    },
    {
        domain: "10minutemail.com",
        firstSeen: "2024-01-04T00:00:00.000Z",
        lastSeen: "2024-01-18T00:00:00.000Z",
        sources: ["https://github.com/disposable-email-domains/disposable-email-domains"],
    },
];

// Mock fs.readFileSync before imports
vi.mock(import("node:fs"), () => {
    return {
        readFileSync: vi.fn<Parameters<typeof import("node:fs").readFileSync>>(() => JSON.stringify(mockDomainsData)),
    };
});

describe(isDisposableDomain, () => {
    beforeEach(() => {
        // Clear module cache to reset cached data between tests
        vi.resetModules();
    });

    describe(isDisposableDomain, () => {
        it("should detect disposable domains", () => {
            expect.assertions(4);
            expect(isDisposableDomain("mailinator.com")).toBe(true);
            expect(isDisposableDomain("trashmail.com")).toBe(true);
            expect(isDisposableDomain("guerrillamail.com")).toBe(true);
            expect(isDisposableDomain("10minutemail.com")).toBe(true);
        });

        it("should not detect regular domains as disposable", () => {
            expect.assertions(4);
            expect(isDisposableDomain("example.com")).toBe(false);
            expect(isDisposableDomain("gmail.com")).toBe(false);
            expect(isDisposableDomain("company.co.uk")).toBe(false);
            expect(isDisposableDomain("test.org")).toBe(false);
        });

        it("should be case-insensitive", () => {
            expect.assertions(3);
            expect(isDisposableDomain("MAILINATOR.COM")).toBe(true);
            expect(isDisposableDomain("TrashMail.Com")).toBe(true);
            expect(isDisposableDomain("  MAILINATOR.COM  ")).toBe(true);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com", "test-temp.com"]);

            expect(isDisposableDomain("custom-disposable.com", customDomains)).toBe(true);
            expect(isDisposableDomain("test-temp.com", customDomains)).toBe(true);
        });

        it("should return false for invalid inputs", () => {
            expect.assertions(4);
            expect(isDisposableDomain("")).toBe(false);
            expect(isDisposableDomain("invalid")).toBe(false);
            // @ts-expect-error - Testing invalid input
            // eslint-disable-next-line unicorn/no-null
            expect(isDisposableDomain(null)).toBe(false);
            // @ts-expect-error - Testing invalid input
            expect(isDisposableDomain(undefined)).toBe(false);
        });
    });

    describe(isDisposableEmail, () => {
        it("should detect disposable email addresses", () => {
            expect.assertions(4);
            expect(isDisposableEmail("user@mailinator.com")).toBe(true);
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
            expect(isDisposableEmail("user@MAILINATOR.COM")).toBe(true);
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
            expect(isDisposableEmail("@mailinator.com")).toBe(false);
            expect(isDisposableEmail("user@")).toBe(false);
            expect(isDisposableEmail("user@mailinator")).toBe(false);
        });

        it("should handle whitespace", () => {
            expect.assertions(2);
            expect(isDisposableEmail("  user@mailinator.com  ")).toBe(true);
            expect(isDisposableEmail("\tuser@mailinator.com\n")).toBe(true);
        });
    });

    describe(getDomainList, () => {
        it("should return array of domain strings", () => {
            expect.assertions(2);

            const domains = getDomainList();

            expect(Array.isArray(domains)).toBe(true);
            expect(domains.length).toBeGreaterThan(0);
        });

        it("should return domains from mock data", () => {
            expect.assertions(1);

            const domains = getDomainList();

            expect(domains).toContain("mailinator.com");
        });
    });

    describe(getDomainMetadata, () => {
        it("should return metadata for existing domain", () => {
            expect.assertions(4);

            const metadata = getDomainMetadata("mailinator.com");

            expect(metadata).toBeDefined();
            expect(metadata?.domain).toBe("mailinator.com");
            expect(metadata?.firstSeen).toBeDefined();
            expect(metadata?.sources).toBeDefined();
        });

        it("should return undefined for non-existent domain", () => {
            expect.assertions(1);

            const metadata = getDomainMetadata("nonexistent.com");

            expect(metadata).toBeUndefined();
        });

        it("should be case-insensitive", () => {
            expect.assertions(1);

            const metadata = getDomainMetadata("MAILINATOR.COM");

            expect(metadata?.domain).toBe("mailinator.com");
        });
    });

    describe(searchDomains, () => {
        it("should find domains matching pattern", () => {
            expect.assertions(1);

            const results = searchDomains("mail");

            expect(results.length).toBeGreaterThan(0);
        });

        it("should return empty array for no matches", () => {
            expect.assertions(1);

            const results = searchDomains("nonexistentpattern12345");

            expect(results).toStrictEqual([]);
        });

        it("should be case-insensitive", () => {
            expect.assertions(1);

            const results = searchDomains("MAIL");

            expect(results.length).toBeGreaterThan(0);
        });

        it("should return empty array for invalid input", () => {
            expect.assertions(1);
            expect(searchDomains("")).toStrictEqual([]);
        });
    });

    describe(getDomainCount, () => {
        it("should return number of domains", () => {
            expect.assertions(1);

            const count = getDomainCount();

            expectTypeOf(count).toBeNumber();

            expect(count).toBeGreaterThan(0);
        });
    });

    describe(getAllDomains, () => {
        it("should return all domain entries with metadata", () => {
            expect.assertions(4);

            const domains = getAllDomains();

            expect(Array.isArray(domains)).toBe(true);
            expect(domains.length).toBeGreaterThan(0);
            expect(domains[0]).toHaveProperty("domain");
            expect(domains[0]).toHaveProperty("sources");
        });
    });

    describe(getDomainsBySource, () => {
        it("should return domains from specific source", () => {
            expect.assertions(1);

            const domains = getDomainsBySource("Disposable Email Domains - Primary Source");

            expect(Array.isArray(domains)).toBe(true);
        });

        it("should return empty array for non-existent source", () => {
            expect.assertions(1);

            const domains = getDomainsBySource("NonExistent Source");

            expect(domains).toStrictEqual([]);
        });

        it("should return empty array for invalid input", () => {
            expect.assertions(1);
            expect(getDomainsBySource("")).toStrictEqual([]);
        });
    });

    describe(getStatistics, () => {
        it("should return statistics object", () => {
            expect.assertions(5);

            const stats = getStatistics();

            expect(stats).toHaveProperty("totalDomains");
            expect(stats).toHaveProperty("uniqueSources");
            expect(stats).toHaveProperty("domainsPerSource");
            expect(stats).toHaveProperty("dateRange");
            expect(stats.totalDomains).toBeGreaterThan(0);
        });

        it("should have correct structure", () => {
            expect.assertions(2);

            const stats = getStatistics();

            expectTypeOf(stats.totalDomains).toBeNumber();
            expectTypeOf(stats.uniqueSources).toBeNumber();
            expectTypeOf(stats.domainsPerSource).toBeObject();

            expect(stats.dateRange).toHaveProperty("earliest");
            expect(stats.dateRange).toHaveProperty("latest");
        });
    });

    describe(batchCheckDomains, () => {
        it("should check multiple domains", () => {
            expect.assertions(3);

            const domains = ["mailinator.com", "example.com", "trashmail.com"];
            const results = batchCheckDomains(domains);

            expect(results.size).toBe(3);
            expect(results.get("mailinator.com")).toBe(true);
            expect(results.get("example.com")).toBe(false);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com"]);
            const domains = ["custom-disposable.com", "example.com"];
            const results = batchCheckDomains(domains, customDomains);

            expect(results.get("custom-disposable.com")).toBe(true);
            expect(results.get("example.com")).toBe(false);
        });

        it("should handle invalid domains", () => {
            expect.assertions(2);

            const domains = ["", "valid@domain.com"];
            const results = batchCheckDomains(domains);

            expect(results.get("")).toBe(false);
            expect(results.get("valid@domain.com")).toBe(false);
        });
    });

    describe(batchCheckEmails, () => {
        it("should check multiple emails", () => {
            expect.assertions(3);

            const emails = ["user@mailinator.com", "user@example.com", "test@trashmail.com"];
            const results = batchCheckEmails(emails);

            expect(results.size).toBe(3);
            expect(results.get("user@mailinator.com")).toBe(true);
            expect(results.get("user@example.com")).toBe(false);
        });

        it("should handle custom domains", () => {
            expect.assertions(2);

            const customDomains = new Set(["custom-disposable.com"]);
            const emails = ["user@custom-disposable.com", "user@example.com"];
            const results = batchCheckEmails(emails, customDomains);

            expect(results.get("user@custom-disposable.com")).toBe(true);
            expect(results.get("user@example.com")).toBe(false);
        });

        it("should handle invalid emails", () => {
            expect.assertions(3);

            const emails = ["", "invalid", "@mailinator.com"];
            const results = batchCheckEmails(emails);

            expect(results.get("")).toBe(false);
            expect(results.get("invalid")).toBe(false);
            expect(results.get("@mailinator.com")).toBe(false);
        });
    });
});
