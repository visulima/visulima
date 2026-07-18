import { describe, expect, it } from "vitest";

// @ts-expect-error -- build-time script, no type declarations
import FreeEmailSyncManager from "../scripts/free-email-sync-manager.js";

// The sync manager is a build-time generator. These tests exercise the in-memory
// publishing invariant without any network access: blacklisted domains must be
// absent from the published set, the report counts, and the returned set alike.
describe("free-email sync manager exclusion consistency", () => {
    const seed = (manager: FreeEmailSyncManager): void => {
        manager.addDomain("gmail.com", "test");
        manager.addDomain("corp-internal.example", "test");
        manager.excludeDomains.add("corp-internal.example");
    };

    it("omits excluded domains from the published set", () => {
        expect.assertions(2);

        const manager = new FreeEmailSyncManager();

        seed(manager);

        const published = manager.getPublishedDomains();

        expect(published).toContain("gmail.com");
        expect(published).not.toContain("corp-internal.example");
    });

    it("reports the excluded-filtered count in the final stats", () => {
        expect.assertions(2);

        const manager = new FreeEmailSyncManager();

        seed(manager);

        const stats: Record<string, number> = {};

        manager.calculateFinalStats(stats, Date.now());

        expect(stats.totalDomains).toBe(1);
        expect(stats.uniqueDomains).toBe(1);
    });

    it("excludes subdomains of a blacklisted parent domain", () => {
        expect.assertions(3);

        const manager = new FreeEmailSyncManager();

        manager.addDomain("gmail.com", "test");
        manager.addDomain("corp.example", "test");
        manager.addDomain("mail.corp.example", "test");
        manager.excludeDomains.add("corp.example");

        const published = manager.getPublishedDomains();

        expect(published).toContain("gmail.com");
        expect(published).not.toContain("corp.example");
        expect(published).not.toContain("mail.corp.example");
    });
});

describe("free-email sync manager previous-domain preservation", () => {
    it("re-adds previously published domains into the collection", () => {
        expect.assertions(3);

        const manager = new FreeEmailSyncManager();

        manager.addDomain("gmail.com", "test");
        manager.previousDomains = new Set(["gmail.com", "yahoo.com"]);

        const readded = manager.mergePreviousDomains();

        const published = manager.getPublishedDomains();

        // Only yahoo.com was missing from the current collection.
        expect(readded).toBe(1);
        expect(published).toContain("gmail.com");
        expect(published).toContain("yahoo.com");
    });

    it("keeps re-added previous domains subject to the exclude list", () => {
        expect.assertions(2);

        const manager = new FreeEmailSyncManager();

        manager.addDomain("gmail.com", "test");
        manager.previousDomains = new Set(["corp.example"]);
        manager.excludeDomains.add("corp.example");

        manager.mergePreviousDomains();

        const published = manager.getPublishedDomains();

        expect(published).toContain("gmail.com");
        expect(published).not.toContain("corp.example");
    });
});

describe("free-email sync manager parsing pipeline", () => {
    it("extracts domains from host-file, wildcard, email and separator formats", () => {
        expect.assertions(6);

        const manager = new FreeEmailSyncManager();

        expect(manager.extractDomain("0.0.0.0 gmail.com")).toBe("gmail.com");
        expect(manager.extractDomain("127.0.0.1 mail.example.com")).toBe("mail.example.com");
        expect(manager.extractDomain("*.wildcard.com")).toBe("wildcard.com");
        expect(manager.extractDomain("user@provider.com")).toBe("provider.com");
        expect(manager.extractDomain("example.com,extra")).toBe("example.com");
        expect(manager.extractDomain("example.com trailing")).toBe("example.com");
    });

    it("parses a mixed text list, skipping comments and invalid entries", () => {
        expect.assertions(1);

        const manager = new FreeEmailSyncManager();

        const text = ["# comment", "// comment", "; comment", "", "0.0.0.0 gmail.com", "*.yahoo.com", "user@outlook.com", "..", "no-dot", "GMX.NET"].join("\n");

        expect(manager.parseDomainList(text)).toStrictEqual(["gmail.com", "yahoo.com", "outlook.com", "gmx.net"]);
    });

    it("validates domain format", () => {
        expect.assertions(5);

        const manager = new FreeEmailSyncManager();

        expect(manager.isValidDomain("gmail.com")).toBe(true);
        expect(manager.isValidDomain("sub.gmail.com")).toBe(true);
        expect(manager.isValidDomain("no-dot")).toBe(false);
        expect(manager.isValidDomain("..")).toBe(false);
        expect(manager.isValidDomain(`${"a".repeat(254)}.com`)).toBe(false);
    });

    it("converts GitHub URLs to raw URLs, handling refs/heads", () => {
        expect.assertions(2);

        const manager = new FreeEmailSyncManager();

        expect(manager.convertToRawGitHubUrl("https://github.com/owner/repo", "main/list.txt")).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/list.txt",
        );
        expect(manager.convertToRawGitHubUrl("https://github.com/owner/repo", "/refs/heads/main/list.txt")).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/list.txt",
        );
    });
});
