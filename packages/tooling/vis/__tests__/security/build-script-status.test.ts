import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanBuildScriptStatus, scanUnapprovedBuildScripts } from "../../src/security/security";

const writePkg = (dir: string, name: string, scripts: Record<string, string> = {}): string => {
    const pkgDir = join(dir, "node_modules", name);

    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name, scripts, version: "1.0.0" }));

    return pkgDir;
};

describe(scanBuildScriptStatus, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-scan-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    describe("binding.gyp detection (P0)", () => {
        it("flags a package with binding.gyp but no install scripts as needing approval", () => {
            expect.assertions(2);

            // sharp-like: ships a binding.gyp, no install script — npm
            // implicitly runs node-gyp rebuild. LavaMoat catches this; vis
            // must too.
            const pkgDir = writePkg(tmpDir, "node-gyp-pkg");

            writeFileSync(join(pkgDir, "binding.gyp"), "{ \"targets\": [{ \"target_name\": \"x\" }] }\n");

            const status = scanBuildScriptStatus(tmpDir, {});

            expect(status.unapproved).toHaveLength(1);
            expect(status.unapproved[0]!.hooks).toContain("install (binding.gyp)");
        });

        it("does NOT add the synthetic hook when an explicit install script is already declared", () => {
            expect.assertions(1);

            const pkgDir = writePkg(tmpDir, "explicit-install", { install: "node-gyp rebuild" });

            writeFileSync(join(pkgDir, "binding.gyp"), "{}");

            const status = scanBuildScriptStatus(tmpDir, {});

            // The synthetic hook is only emitted when NO explicit hook exists.
            expect(status.unapproved[0]!.hooks).not.toContain("install (binding.gyp)");
        });

        it("ignores a package with neither install scripts nor binding.gyp", () => {
            expect.assertions(1);

            writePkg(tmpDir, "pure-js", { build: "tsc" });

            expect(scanBuildScriptStatus(tmpDir, {}).unapproved).toStrictEqual([]);
        });
    });

    describe("excess / stale allowlist entries (P1)", () => {
        it("reports allowlist entries that no longer match any installed package", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "node install.js" });

            const status = scanBuildScriptStatus(tmpDir, { "removed-pkg": true });

            // The "removed-pkg" entry is stale — flag it.
            expect(status.excess).toStrictEqual(["removed-pkg"]);
        });

        it("does not report excess for a wildcard pattern that matches at least one package", () => {
            expect.assertions(1);

            writePkg(tmpDir, "@prisma/client", { postinstall: "node install.js" });

            const status = scanBuildScriptStatus(tmpDir, { "@prisma/*": true });

            expect(status.excess).toStrictEqual([]);
        });

        it("reports a wildcard pattern that matches nothing", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { "@orphan/*": true });

            expect(status.excess).toStrictEqual(["@orphan/*"]);
        });

        it("ignores allowlist entries explicitly set to false (they are denials, not approvals)", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { "denied-pkg": false });

            expect(status.excess).toStrictEqual([]);
        });
    });

    describe("canonical-name dedup (P1)", () => {
        it("collapses the same package present at two paths to a single entry", () => {
            expect.assertions(2);

            // Top-level esbuild + nested copy under another dep.
            const dependentDir = writePkg(tmpDir, "dependent", { build: "esbuild ." });

            mkdirSync(join(dependentDir, "node_modules", "esbuild"), { recursive: true });
            writeFileSync(
                join(dependentDir, "node_modules", "esbuild", "package.json"),
                JSON.stringify({ name: "esbuild", scripts: { postinstall: "node install.js" }, version: "1.0.0" }),
            );
            writePkg(tmpDir, "esbuild", { postinstall: "node install.js" });

            const status = scanBuildScriptStatus(tmpDir, {});

            // Two copies on disk → one entry in the report.
            expect(status.unapproved).toHaveLength(1);
            expect(status.unapproved[0]!.name).toBe("esbuild");
        });
    });

    describe("pnpm `.pnpm` content store traversal", () => {
        const writeStorePkg = (root: string, storeKey: string, pkgName: string, scripts: Record<string, string> = {}): void => {
            const storeNm = join(root, "node_modules", ".pnpm", storeKey, "node_modules");

            mkdirSync(join(storeNm, pkgName), { recursive: true });
            writeFileSync(join(storeNm, pkgName, "package.json"), JSON.stringify({ name: pkgName, scripts, version: "1.0.0" }));
        };

        it("scans packages that live only under `.pnpm/<hash>/node_modules/<pkg>`", () => {
            expect.assertions(2);

            // Simulates a non-hoisted pnpm peer dep that is not symlinked at
            // the workspace top level. Before the .pnpm traversal fix this
            // package was silently skipped.
            writeStorePkg(tmpDir, "sharp@0.32.0", "sharp", { install: "node install.js" });

            const status = scanBuildScriptStatus(tmpDir, {});

            expect(status.unapproved).toHaveLength(1);
            expect(status.unapproved[0]!.name).toBe("sharp");
        });

        it("dedups a package reachable via both the top-level symlink and the `.pnpm` store", () => {
            expect.assertions(2);

            writePkg(tmpDir, "esbuild", { postinstall: "node install.js" });
            writeStorePkg(tmpDir, "esbuild@1.0.0", "esbuild", { postinstall: "node install.js" });

            const status = scanBuildScriptStatus(tmpDir, {});

            expect(status.unapproved).toHaveLength(1);
            expect(status.unapproved[0]!.name).toBe("esbuild");
        });

        it("handles scoped packages inside `.pnpm`", () => {
            expect.assertions(1);

            writeStorePkg(tmpDir, "@scope+pkg@1.0.0", "@scope/pkg", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, {});

            expect(status.unapproved.map((p) => p.name)).toStrictEqual(["@scope/pkg"]);
        });
    });

    describe("status triage", () => {
        it("separates approved from unapproved packages", () => {
            expect.assertions(2);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });
            writePkg(tmpDir, "sharp", { install: "x" });

            const status = scanBuildScriptStatus(tmpDir, { esbuild: true });

            expect(status.installed.map((p) => p.name)).toStrictEqual(["esbuild"]);
            expect(status.unapproved.map((p) => p.name)).toStrictEqual(["sharp"]);
        });
    });

    describe("pinVersions (P3)", () => {
        it("matches `name@version` keys against the installed version when pinVersions is on", () => {
            expect.assertions(2);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const matching = scanBuildScriptStatus(tmpDir, { "esbuild@1.0.0": true }, { pinVersions: true });
            const mismatched = scanBuildScriptStatus(tmpDir, { "esbuild@0.9.0": true }, { pinVersions: true });

            expect(matching.unapproved).toHaveLength(0);
            expect(mismatched.unapproved.map((p) => p.name)).toStrictEqual(["esbuild"]);
        });

        it("treats a bare name (no @version) as any-version even with pinVersions on", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { esbuild: true }, { pinVersions: true });

            expect(status.unapproved).toHaveLength(0);
        });

        it("treats `name@*` as any-version", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { "esbuild@*": true }, { pinVersions: true });

            expect(status.unapproved).toHaveLength(0);
        });

        it("reports versionDrift when the allowlist key is one version, but a different version is installed", () => {
            expect.assertions(2);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { "esbuild@0.9.0": true }, { pinVersions: true });

            // The 1.0.0 version is what's actually installed.
            expect(status.versionDrift).toStrictEqual([{ from: "esbuild@0.9.0", to: "esbuild@1.0.0" }]);
            // It's also unapproved (since the pin no longer matches).
            expect(status.unapproved.map((p) => p.name)).toStrictEqual(["esbuild"]);
        });

        it("with pinVersions OFF, `name@version` keys are ignored as exact-match and fall through to bare match", () => {
            expect.assertions(1);

            writePkg(tmpDir, "esbuild", { postinstall: "x" });

            // Without pinVersions, the splitAllowKey still strips the version,
            // so this should approve any installed version of esbuild.
            const status = scanBuildScriptStatus(tmpDir, { "esbuild@0.9.0": true });

            expect(status.unapproved).toHaveLength(0);
        });

        it("handles scoped names with versions (`@scope/foo@1.2.3`)", () => {
            expect.assertions(1);

            writePkg(tmpDir, "@org/foo", { postinstall: "x" });

            const status = scanBuildScriptStatus(tmpDir, { "@org/foo@1.0.0": true }, { pinVersions: true });

            expect(status.unapproved).toHaveLength(0);
        });
    });
});

describe(scanUnapprovedBuildScripts, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-scan-legacy-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("preserves the legacy '<name> (<hooks>)' string format for back-compat callers", () => {
        expect.assertions(1);

        writePkg(tmpDir, "esbuild", { postinstall: "x" });

        const result = scanUnapprovedBuildScripts(tmpDir, {});

        expect(result).toStrictEqual(["esbuild (postinstall)"]);
    });

    it("includes the synthetic '(binding.gyp)' label in the legacy string output", () => {
        expect.assertions(1);

        const pkgDir = writePkg(tmpDir, "implicit-gyp");

        writeFileSync(join(pkgDir, "binding.gyp"), "{}");

        expect(scanUnapprovedBuildScripts(tmpDir, {})).toStrictEqual(["implicit-gyp (install (binding.gyp))"]);
    });
});
