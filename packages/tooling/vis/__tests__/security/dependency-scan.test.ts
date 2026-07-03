import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findDuplicateDependencies, lockedPackages, resolveLockfile } from "../../src/security/dependency-scan";

const npmLockfileWith = (pkg: string): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { [pkg]: "1.0.0" }, name: "fixture", version: "0.0.0" },
            [`node_modules/${pkg}`]: { version: "1.0.0" },
        },
        version: "0.0.0",
    });

const npmLockfileWithDevTransitive = (): string =>
    JSON.stringify(
        {
            lockfileVersion: 3,
            name: "fixture",
            packages: {
                "": {
                    dependencies: {
                        "prod-pkg": "1.0.0",
                    },
                    devDependencies: {
                        "dev-pkg": "2.0.0",
                    },
                    name: "fixture",
                    version: "0.0.0",
                },
                "node_modules/dev-only-transitive": {
                    version: "9.9.9",
                },
                "node_modules/dev-pkg": {
                    dependencies: {
                        "dev-only-transitive": "9.9.9",
                    },
                    version: "2.0.0",
                },
                "node_modules/prod-pkg": {
                    dependencies: {
                        "shared-dep": "3.0.0",
                    },
                    version: "1.0.0",
                },
                "node_modules/shared-dep": {
                    version: "3.0.0",
                },
            },
            version: "0.0.0",
        },
        undefined,
        2,
    );

const packageJsonForLockfile = (): string =>
    JSON.stringify(
        {
            dependencies: { "prod-pkg": "1.0.0" },
            devDependencies: { "dev-pkg": "2.0.0" },
            name: "fixture",
            version: "0.0.0",
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

        expect(names).toStrictEqual(["dev-only-transitive", "dev-pkg", "prod-pkg", "shared-dep"]);
    });

    it("filters out dev roots and dev-only transitives when includeDev is false", () => {
        expect.assertions(1);

        const prod = lockedPackages(workspace, "npm", { includeDev: false });
        const names = prod.map((p) => p.name).sort();

        expect(names).toStrictEqual(["prod-pkg", "shared-dep"]);
    });

    it("returns empty when the lockfile is missing", () => {
        expect.assertions(1);

        const empty = lockedPackages(join(tmpdir(), "definitely-not-a-workspace"), "npm");

        expect(empty).toStrictEqual([]);
    });
});

describe("npm-shrinkwrap precedence", () => {
    let workspace: string;

    beforeEach(() => {
        workspace = mkdtempSync(join(tmpdir(), "vis-shrinkwrap-"));
        mkdirSync(workspace, { recursive: true });
    });

    afterEach(() => {
        rmSync(workspace, { force: true, recursive: true });
    });

    it("resolveLockfile picks npm-shrinkwrap.json over package-lock.json when both exist", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "npm-shrinkwrap.json"), npmLockfileWith("from-shrinkwrap"));
        writeFileSync(join(workspace, "package-lock.json"), npmLockfileWith("from-package-lock"));

        expect(resolveLockfile(workspace, "npm")?.file).toBe("npm-shrinkwrap.json");
    });

    it("resolveLockfile falls back to package-lock.json when only it exists", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "package-lock.json"), npmLockfileWith("only-pkg-lock"));

        expect(resolveLockfile(workspace, "npm")?.file).toBe("package-lock.json");
    });

    it("resolveLockfile returns the canonical entry when neither npm lockfile exists", () => {
        expect.assertions(1);

        // Lets callers keep their own ENOENT handling on a stable path.
        expect(resolveLockfile(workspace, "npm")?.file).toBe("package-lock.json");
    });

    it("lockedPackages reads npm-shrinkwrap.json in preference to package-lock.json", () => {
        expect.assertions(1);

        writeFileSync(join(workspace, "npm-shrinkwrap.json"), npmLockfileWith("from-shrinkwrap"));
        writeFileSync(join(workspace, "package-lock.json"), npmLockfileWith("from-package-lock"));

        expect(lockedPackages(workspace, "npm").map((p) => p.name)).toStrictEqual(["from-shrinkwrap"]);
    });

    it("findDuplicateDependencies reads npm-shrinkwrap.json in preference to package-lock.json", () => {
        expect.assertions(3);

        const dupLock = JSON.stringify({
            lockfileVersion: 3,
            name: "fixture",
            packages: {
                "": { name: "fixture", version: "0.0.0" },
                "node_modules/dup": { version: "1.0.0" },
                "node_modules/holder/node_modules/dup": { version: "2.0.0" },
            },
            version: "0.0.0",
        });

        writeFileSync(join(workspace, "npm-shrinkwrap.json"), dupLock);
        writeFileSync(join(workspace, "package-lock.json"), npmLockfileWith("no-dup-here"));

        const dupes = findDuplicateDependencies(workspace, "npm");

        expect(dupes).toHaveLength(1);
        expect(dupes[0]?.name).toBe("dup");
        expect([...(dupes[0]?.versions ?? [])].sort()).toStrictEqual(["1.0.0", "2.0.0"]);
    });
});
