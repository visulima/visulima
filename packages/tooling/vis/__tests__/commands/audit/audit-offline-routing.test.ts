import { mkdtempSync, promises as fsPromises, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
    return {
        dbPath: "",
        ecosystemPackages: {},
        npmPackages: [] as { name: string; version: string }[],
        schemaVersion: 2,
    };
});

const queryAdvisories = vi.hoisted(() => vi.fn((): Map<string, never[]> => new Map()));

// The schema gate reads the version through the native status call. The file itself only has to exist.
vi.mock(import("#native"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        advisoriesStatus: () => { return { ecosystems: [], exists: true, schemaVersion: state.schemaVersion, sizeBytes: 0 }; },
    };
});

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

const { default: execute, offlineLockfileGaps } = await import("../../../src/commands/audit/handler");

/**
 * Runs the audit handler offline against an in-memory lockfile set and records which
 * ecosystem each package batch was queried under. `lockFiles` are created empty in the
 * workspace: the readers are mocked, but the lock file itself is checked on disk.
 */
const runOffline = async (ecosystem: string, lockFiles: string[] = ["package-lock.json"]): Promise<void> => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), "vis-audit-routing-"));

    for (const lockFile of lockFiles) {
        writeFileSync(join(workspaceRoot, lockFile), "");
    }

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
        writeFileSync(state.dbPath, "");
        state.schemaVersion = 2;
        process.exitCode = undefined;
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

        await runOffline("pub,npm", ["package-lock.json", "pubspec.lock"]);

        expect(queriedAs("npm")).toStrictEqual([[{ name: "left-pad", version: "1.3.0" }]]);
        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
        expect(queriedAs("Pub").flat()).not.toContainEqual({ name: "left-pad", version: "1.3.0" });
    });

    it("skips the JavaScript lockfile when npm was not requested", async () => {
        expect.assertions(2);

        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];
        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub", ["pubspec.lock"]);

        expect(queriedAs("npm").flat()).toStrictEqual([]);
        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
    });

    it("reads a mix.lock as Hex and queries it under the Hex ecosystem", async () => {
        expect.assertions(2);

        state.ecosystemPackages = { Hex: [{ name: "plug", version: "1.15.0" }] };

        await runOffline("hex", ["mix.lock"]);

        expect(queriedAs("Hex")).toStrictEqual([[{ name: "plug", version: "1.15.0" }]]);
        expect(process.exitCode).not.toBe(1);
    });

    it("scans a Dart-only repository when the JavaScript lockfile has no entries", async () => {
        expect.assertions(2);

        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub,npm", ["package-lock.json", "pubspec.lock"]);

        expect(queriedAs("Pub")).toStrictEqual([[{ name: "http", version: "1.2.0" }]]);
        expect(process.exitCode).not.toBe(1);
    });

    it("refuses an offline run on an older advisory database, exits 1, and neither queries nor downloads", async () => {
        expect.assertions(3);

        state.schemaVersion = 1;
        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];

        const fetchSpy = vi.spyOn(globalThis, "fetch");

        await runOffline("npm");

        expect(queryAdvisories).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);

        fetchSpy.mockRestore();
    });
});

describe("vis audit offline lock file gaps", () => {
    beforeEach(() => {
        state.dbPath = join(mkdtempSync(join(tmpdir(), "vis-audit-db-")), "advisories.sqlite");
        writeFileSync(state.dbPath, "");
        state.schemaVersion = 2;
        process.exitCode = undefined;
        state.npmPackages = [];
        state.ecosystemPackages = {};
        queryAdvisories.mockClear();
        vi.spyOn(process.stdout, "write").mockImplementation(() => true);
        vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    it("names the lock file a requested ecosystem is missing", () => {
        expect.assertions(2);

        const workspaceRoot = mkdtempSync(join(tmpdir(), "vis-audit-gaps-"));

        expect(offlineLockfileGaps(workspaceRoot, ["pub"], "npm")).toStrictEqual([`Pub: no pubspec.lock in ${workspaceRoot}`]);

        writeFileSync(join(workspaceRoot, "pubspec.lock"), "");

        expect(offlineLockfileGaps(workspaceRoot, ["pub"], "npm")).toStrictEqual([]);
    });

    it("fails when the only requested ecosystem has no lock file, and scans nothing", async () => {
        expect.assertions(2);

        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("pub", []);

        expect(process.exitCode).toBe(1);
        expect(queryAdvisories).not.toHaveBeenCalled();
    });

    it("fails a multi-ecosystem request when one lock file is missing, even if the other has packages", async () => {
        expect.assertions(2);

        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];
        state.ecosystemPackages = { Pub: [{ name: "http", version: "1.2.0" }] };

        await runOffline("npm,pub", ["package-lock.json"]);

        expect(process.exitCode).toBe(1);
        expect(queryAdvisories).not.toHaveBeenCalled();
    });

    it("fails an npm request with no JavaScript lock file", async () => {
        expect.assertions(2);

        state.npmPackages = [{ name: "left-pad", version: "1.3.0" }];

        await runOffline("npm", []);

        expect(process.exitCode).toBe(1);
        expect(queryAdvisories).not.toHaveBeenCalled();
    });

    it("passes an npm-only request whose lock file exists but has no entries (same rule as any ecosystem)", async () => {
        expect.assertions(2);

        await runOffline("npm", ["package-lock.json"]);

        expect(process.exitCode).not.toBe(1);
        expect(queryAdvisories).not.toHaveBeenCalled();
    });

    it("passes a request whose lock files exist but are empty of dependencies", async () => {
        expect.assertions(2);

        await runOffline("pub,npm", ["package-lock.json", "pubspec.lock"]);

        expect(process.exitCode).not.toBe(1);
        expect(queryAdvisories).not.toHaveBeenCalled();
    });
});
