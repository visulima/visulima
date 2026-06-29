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
});
