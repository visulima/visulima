import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanExoticSubdeps } from "../../src/security/exotic-subdeps";

const npmLock = (): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { "prod-pkg": "1.0.0" }, name: "fixture", version: "0.0.0" },
            "node_modules/git-dep": { version: "0.0.0" },
            "node_modules/ok-dep": { version: "2.3.4" },
            "node_modules/prod-pkg": {
                dependencies: { "git-dep": "github:attacker/evil#deadbeef", "ok-dep": "^2.0.0" },
                version: "1.0.0",
            },
        },
        version: "0.0.0",
    });

const cleanNpmLock = (): string =>
    JSON.stringify({
        lockfileVersion: 3,
        name: "fixture",
        packages: {
            "": { dependencies: { "prod-pkg": "1.0.0" }, name: "fixture", version: "0.0.0" },
            "node_modules/ok-dep": { version: "2.3.4" },
            "node_modules/prod-pkg": { dependencies: { "ok-dep": "^2.0.0" }, version: "1.0.0" },
        },
        version: "0.0.0",
    });

describe(scanExoticSubdeps, () => {
    let ws: string;

    beforeEach(() => {
        ws = mkdtempSync(join(tmpdir(), "vis-exotic-"));
    });

    afterEach(() => {
        rmSync(ws, { force: true, recursive: true });
    });

    it("flags a transitive dependency pulled from a git source", () => {
        expect.assertions(1);

        writeFileSync(join(ws, "package-lock.json"), npmLock());

        expect(scanExoticSubdeps(ws, "npm")).toStrictEqual([{ declaredBy: "prod-pkg@1.0.0", packageName: "git-dep", source: "github:attacker/evil#deadbeef" }]);
    });

    it("exempts an allow-listed dependency name", () => {
        expect.assertions(1);

        writeFileSync(join(ws, "package-lock.json"), npmLock());

        expect(scanExoticSubdeps(ws, "npm", { allow: ["git-*"] })).toStrictEqual([]);
    });

    it("returns nothing when every transitive edge is registry-backed", () => {
        expect.assertions(1);

        writeFileSync(join(ws, "package-lock.json"), cleanNpmLock());

        expect(scanExoticSubdeps(ws, "npm")).toStrictEqual([]);
    });

    it("returns nothing for an unknown package manager", () => {
        expect.assertions(1);

        writeFileSync(join(ws, "package-lock.json"), npmLock());

        expect(scanExoticSubdeps(ws, "cargo")).toStrictEqual([]);
    });

    it("returns nothing when the lockfile is missing", () => {
        expect.assertions(1);

        expect(scanExoticSubdeps(ws, "npm")).toStrictEqual([]);
    });
});
