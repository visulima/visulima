import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lockedPackages } from "../../src/security/dependency-scan";

const npmLockfileWithDevTransitive = (): string =>
    JSON.stringify(
        {
            name: "fixture",
            version: "0.0.0",
            lockfileVersion: 3,
            packages: {
                "": {
                    name: "fixture",
                    version: "0.0.0",
                    dependencies: {
                        "prod-pkg": "1.0.0",
                    },
                    devDependencies: {
                        "dev-pkg": "2.0.0",
                    },
                },
                "node_modules/prod-pkg": {
                    version: "1.0.0",
                    dependencies: {
                        "shared-dep": "3.0.0",
                    },
                },
                "node_modules/dev-pkg": {
                    version: "2.0.0",
                    dependencies: {
                        "dev-only-transitive": "9.9.9",
                    },
                },
                "node_modules/shared-dep": {
                    version: "3.0.0",
                },
                "node_modules/dev-only-transitive": {
                    version: "9.9.9",
                },
            },
        },
        undefined,
        2,
    );

const packageJsonForLockfile = (): string =>
    JSON.stringify(
        {
            name: "fixture",
            version: "0.0.0",
            dependencies: { "prod-pkg": "1.0.0" },
            devDependencies: { "dev-pkg": "2.0.0" },
        },
        undefined,
        2,
    );

describe("lockedPackages with prod-only filter", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-lockedpkgs-"));
        mkdirSync(workspace, { recursive: true });
        writeFileSync(join(workspace, "package-lock.json"), npmLockfileWithDevTransitive());
        writeFileSync(join(workspace, "package.json"), packageJsonForLockfile());
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("returns every entry when includeDev is true (default)", () => {
        expect.assertions(1);

        const all = lockedPackages(workspace, "npm");
        const names = all.map((p) => p.name).sort();

        expect(names).toEqual(["dev-only-transitive", "dev-pkg", "prod-pkg", "shared-dep"]);
    });

    it("filters out dev roots and dev-only transitives when includeDev is false", () => {
        expect.assertions(1);

        const prod = lockedPackages(workspace, "npm", { includeDev: false });
        const names = prod.map((p) => p.name).sort();

        expect(names).toEqual(["prod-pkg", "shared-dep"]);
    });

    it("returns empty when the lockfile is missing", () => {
        expect.assertions(1);

        const empty = lockedPackages(join(tmpdir(), "definitely-not-a-workspace"), "npm");

        expect(empty).toEqual([]);
    });
});
