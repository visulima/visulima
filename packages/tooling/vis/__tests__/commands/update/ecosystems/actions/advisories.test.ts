import { describe, expect, it, vi } from "vitest";

import type { EcosystemUpdate } from "../../../../../src/commands/update/ecosystems/types";
import type { SecurityVulnerability } from "../../../../../src/security/advisories";

vi.mock(import("node:fs"), async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");

    return { ...actual, existsSync: vi.fn() };
});

vi.mock(import("../../../../../src/security/advisories"), () => {
    return {
        queryAdvisories: vi.fn(),
        resolveAdvisoryDbPath: vi.fn(() => "/fake/db"),
    };
});

const { existsSync } = await import("node:fs");
const { queryAdvisories } = await import("../../../../../src/security/advisories");
const { decorateActionsAdvisories } = await import("../../../../../src/commands/update/ecosystems/actions/advisories");

const mockedExistsSync = vi.mocked(existsSync);
const mockedQueryAdvisories = vi.mocked(queryAdvisories);

const makeUpdate = (overrides: Partial<EcosystemUpdate> & Pick<EcosystemUpdate, "name">): EcosystemUpdate => {
    return {
        currentRef: "v1.0.0",
        currentVersion: "v1.0.0",
        ecosystem: "actions",
        file: "/repo/.github/workflows/ci.yml",
        line: 10,
        newRef: "v2.0.0",
        newVersion: "v2.0.0",
        original: "uses: foo@v1.0.0",
        replacement: "uses: foo@v2.0.0",
        updateType: "minor",
        ...overrides,
    };
};

const vuln = (id: string, summary = "x"): SecurityVulnerability => {
    return {
        fixedVersions: ["v2.0.0"],
        id,
        severity: "HIGH",
        summary,
    };
};

describe(decorateActionsAdvisories.name, () => {
    it("returns updates unchanged when the advisory DB is absent", () => {
        expect.assertions(2);

        mockedExistsSync.mockReturnValue(false);

        const updates = [makeUpdate({ name: "actions/checkout" })];
        const result = decorateActionsAdvisories("/repo", updates);

        expect(result).toBe(updates);
        expect(mockedQueryAdvisories).not.toHaveBeenCalled();
    });

    it("returns updates unchanged when querying throws (best-effort enrichment)", () => {
        expect.assertions(1);

        mockedExistsSync.mockReturnValue(true);
        mockedQueryAdvisories.mockImplementation(() => {
            throw new Error("native binding boom");
        });

        const updates = [makeUpdate({ name: "actions/checkout" })];

        expect(decorateActionsAdvisories("/repo", updates)).toStrictEqual(updates);
    });

    it("attaches advisories from the OSV result keyed by package name", () => {
        expect.assertions(2);

        mockedExistsSync.mockReturnValue(true);
        mockedQueryAdvisories.mockReturnValue(new Map([["actions/checkout", [vuln("GHSA-1", "boom")]]]));

        const updates = [makeUpdate({ name: "actions/checkout" })];
        const result = decorateActionsAdvisories("/repo", updates);

        expect(result[0]?.advisories).toHaveLength(1);
        expect(result[0]?.advisories?.[0]?.id).toBe("GHSA-1");
    });

    it("queries each unique (name, version) pair separately so same-named updates at different versions don't overwrite each other", () => {
        expect.assertions(4);

        mockedExistsSync.mockReturnValue(true);

        // Two updates of the same action pinned to different versions.
        // The fix is to issue one query per unique (name, version) — so
        // the name-keyed result map can't collide on itself.
        mockedQueryAdvisories.mockReset();
        mockedQueryAdvisories.mockImplementation((packages) => {
            const onlyQuery = packages[0];

            if (!onlyQuery) {
                return new Map();
            }

            if (onlyQuery.version === "v1.0.0") {
                return new Map([[onlyQuery.name, [vuln("GHSA-old")]]]);
            }

            if (onlyQuery.version === "v3.0.0") {
                return new Map();
            }

            return new Map();
        });

        const updates = [
            makeUpdate({ currentRef: "v1.0.0", currentVersion: "v1.0.0", file: "/a.yml", name: "actions/checkout" }),
            makeUpdate({ currentRef: "v3.0.0", currentVersion: "v3.0.0", file: "/b.yml", name: "actions/checkout" }),
        ];

        const result = decorateActionsAdvisories("/repo", updates);

        // Vulnerable v1 stays flagged; clean v3 stays clean.
        expect(result[0]?.advisories?.[0]?.id).toBe("GHSA-old");
        expect(result[1]?.advisories).toBeUndefined();

        // One call per unique (name, version) — not one call per update.
        expect(mockedQueryAdvisories).toHaveBeenCalledTimes(2);
        expect(mockedQueryAdvisories.mock.calls.every((call) => call[0]?.length === 1)).toBe(true);
    });

    it("dedupes identical (name, version) pairs across files into a single query", () => {
        expect.assertions(2);

        mockedExistsSync.mockReturnValue(true);
        mockedQueryAdvisories.mockReset();
        mockedQueryAdvisories.mockReturnValue(new Map([["actions/checkout", [vuln("GHSA-shared")]]]));

        const updates = [makeUpdate({ file: "/a.yml", name: "actions/checkout" }), makeUpdate({ file: "/b.yml", name: "actions/checkout" })];

        const result = decorateActionsAdvisories("/repo", updates);

        expect(mockedQueryAdvisories).toHaveBeenCalledTimes(1);
        expect(result.every((update) => update.advisories?.[0]?.id === "GHSA-shared")).toBe(true);
    });
});
