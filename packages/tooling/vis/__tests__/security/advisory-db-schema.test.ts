import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
    return { schemaVersion: 2 };
});

vi.mock(import("#native"), async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        advisoriesStatus: () => { return { ecosystems: [], exists: true, schemaVersion: state.schemaVersion, sizeBytes: 0 }; },
    };
});

const { advisoryDbSchemaError, AdvisoryDbSchemaError, syncAdvisories } = await import("../../src/security/advisories");

const dbAt = (schemaVersion: number): string => {
    const path = join(mkdtempSync(join(tmpdir(), "vis-advisory-schema-")), "advisories.sqlite");

    writeFileSync(path, "");
    state.schemaVersion = schemaVersion;

    return path;
};

describe("advisory database schema gate", () => {
    it("reports a v1 database with the refresh steps", () => {
        expect.assertions(3);

        const error = advisoryDbSchemaError(dbAt(1));

        expect(error).toBeInstanceOf(AdvisoryDbSchemaError);
        expect(error?.message).toContain("schema v1");
        expect(error?.message).toContain("prune --force");
    });

    it("accepts a database at the current schema", () => {
        expect.assertions(1);

        expect(advisoryDbSchemaError(dbAt(2))).toBeUndefined();
    });

    it("sync refuses an outdated database instead of reporting it up to date", async () => {
        expect.assertions(1);

        const dbPath = dbAt(1);

        await expect(
            syncAdvisories({ allowedHosts: [], dbPath, ecosystem: "pub", force: false, source: "https://example.invalid/", workspaceRoot: "/tmp" }),
        ).rejects.toBeInstanceOf(AdvisoryDbSchemaError);
    });
});
