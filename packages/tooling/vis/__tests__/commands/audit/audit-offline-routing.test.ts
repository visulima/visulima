import { mkdtempSync, promises as fsPromises, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
    return {
        dbPath: "",
        ecosystemPackages: {},
        npmPackages: [] as { name: string; version: string }[],
    };
});

const queryAdvisories = vi.hoisted(() => vi.fn((): Map<string, never[]> => new Map()));

vi.mock(import("../../../src/security/advisories"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        queryAdvisories,
        resolveAdvisoryDbPath: () => state.dbPath,
    };
});

vi.mock(import("../../../src/security/dependency-scan"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        findDuplicateDependencies: () => [],
        lockedPackages: () => state.npmPackages,
    };
});

vi.mock(import("../../../src/security/multi-eco-lockfiles"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        lockedPackagesForEcosystem: (_workspaceRoot: string, ecosystem: string) => state.ecosystemPackages[ecosystem] ?? [],
    };
});

const { default: execute } = await import("../../../src/commands/audit/handler");

/**
 * Runs the audit handler offline against an in-memory lockfile set and records which
 * ecosystem each package batch was queried under.
 */
const runOffline = async (ecosystem: string): Promise<void> => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "vis-audit-routing-"));

    writeFileSync(state.dbPath, "");

    await execute({
        fs: fsPromises,
        logger: console,
        options: { backend: "vis", ecosystem, format: "json", offline: true },
        visConfig: undefined,
        workspaceRoot,
    } as unknown as Parameters<typeof execute>[0]);
};

const queriedAs = (ecosystem: string): { name: string; version: string }[][] => queryAdvisories.mock.calls
    .filter(([, options]) => (options as { ecosystem: string }).ecosystem === ecosystem)
    .map(([packages]) => packages as { name: string; version: string }[]);

describe("vis audit offline routing", () => {
    beforeEach(() => {
        state.dbPath = join(mkdtempSync(join(tmpdir(), "vis-audit-db-")), "advisories.sqlite");
        state.npmPackages = [];
        state.ecosystemPackages = {};
        queryAdvisories.mockClear();
        vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    it("queries the JavaScript lockfile as npm even when another ecosystem comes first", async () => {
        expect.assertions(3);

        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];
        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub,npm");

        expect(queriedAs("npm")).toStrictEqual([[{ name: "left-pad", version: "1.3.0" }]]);
        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
        expect(queriedAs("Pub").flat()).not.toContainEqual({ name: "left-pad", version: "1.3.0" });
    });

    it("skips the JavaScript lockfile when npm was not requested", async () => {
        expect.assertions(2);

        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];
        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub");

        expect(queriedAs("npm").flat()).toStrictEqual([]);
        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
    });

    it("scans a Dart-only repository when the JavaScript lockfile has no entries", async () => {
        expect.assertions(2);

        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub,npm");

        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
        expect(process.exitCode).not.toBe(1);
    });
});
