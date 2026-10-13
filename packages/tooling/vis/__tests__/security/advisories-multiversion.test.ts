import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { queryAdvisories } from "../../src/security/advisories";
import { seedAdvisoryDb } from "./advisory-db-fixture";

let dir: string;
let dbPath: string;

const seed = (rows: Parameters<typeof seedAdvisoryDb>[1]): void => {
    seedAdvisoryDb(dbPath, rows);
};

describe(queryAdvisories, () => {
    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vis-advisory-multiversion-"));
        dbPath = join(dir, "db.sqlite");
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("keys each npm version of one package separately", () => {
        expect.assertions(4);

        seed([{ advisoryId: "GHSA-lodash", ecosystem: "npm", fixed: "4.17.12", introduced: "0", package: "lodash", summary: "lodash proto pollution" }]);

        // Two lodash versions in one lock: 4.17.10 is affected, 4.17.12 is the fix.
        const result = queryAdvisories(
            [
                { name: "lodash", version: "4.17.10" },
                { name: "lodash", version: "4.17.12" },
            ],
            { dbPath, ecosystem: "npm", workspaceRoot: dir },
        );

        expect(result.get("lodash@4.17.10")?.map((v) => v.id)).toStrictEqual(["GHSA-lodash"]);
        expect(result.get("lodash@4.17.10")?.[0]?.fixedVersions).toStrictEqual(["4.17.12"]);
        expect(result.has("lodash@4.17.12")).toBe(false);
        expect(result.has("lodash")).toBe(false);
    });

    it("keys each Cargo version of one crate separately", () => {
        expect.assertions(3);

        seed([{ advisoryId: "RUSTSEC-serde", ecosystem: "crates.io", fixed: "1.0.100", introduced: "0", package: "serde", summary: "serde issue" }]);

        const result = queryAdvisories(
            [
                { name: "serde", version: "1.0.99" },
                { name: "serde", version: "1.0.100" },
            ],
            { dbPath, ecosystem: "crates.io", workspaceRoot: dir },
        );

        expect(result.get("serde@1.0.99")?.map((v) => v.id)).toStrictEqual(["RUSTSEC-serde"]);
        expect(result.has("serde@1.0.100")).toBe(false);
        expect(result.size).toBe(1);
    });
});
