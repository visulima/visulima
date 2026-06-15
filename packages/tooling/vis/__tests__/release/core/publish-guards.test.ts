import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import {
    extractPackFilesFromRaw,
    hashTarball,
    runExportsExist,
    runLifecycleScripts,
    runPublishGuards,
    runRuntimeAudit,
} from "../../../src/release/core/publish-guards";
import type { PackageManifest } from "../../../src/release/types";

const stubRunner = (responses: { args: ReadonlyArray<string>; exitCode?: number; stdout: string }[]): CommandRunner => {
    let cursor = 0;

    return {
        run: async (_command, args) => {
            const next = responses[cursor];

            cursor += 1;

            if (!next) {
                return { exitCode: 1, stderr: "no more stub responses", stdout: "" };
            }

            const matches = next.args.every((value, index) => value === args[index]);

            return matches
                ? { exitCode: next.exitCode ?? 0, stderr: "", stdout: next.stdout }
                : { exitCode: 1, stderr: `expected ${next.args.join(" ")}, got ${args.join(" ")}`, stdout: "" };
        },
    };
};

describe(runExportsExist, () => {
    let pkgDir: string;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-guards-exports-"));
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
    });

    it("passes when every leaf exists", async () => {
        mkdirSync(join(pkgDir, "dist"), { recursive: true });
        writeFileSync(join(pkgDir, "dist", "index.js"), "");
        writeFileSync(join(pkgDir, "dist", "index.d.ts"), "");
        writeFileSync(join(pkgDir, "dist", "cli.js"), "");

        const manifest: PackageManifest = {
            bin: { mycli: "./dist/cli.js" },
            exports: {
                ".": { default: "./dist/index.js", types: "./dist/index.d.ts" },
            },
            main: "./dist/index.js",
            name: "x",
            types: "./dist/index.d.ts",
            version: "1.0.0",
        };

        const result = await runExportsExist(pkgDir, manifest);

        expect(result.passed).toBe(true);
    });

    it("flags missing main / types / bin", async () => {
        const manifest: PackageManifest = {
            bin: "./dist/cli.js",
            main: "./dist/index.js",
            name: "x",
            types: "./dist/index.d.ts",
            version: "1.0.0",
        };

        const result = await runExportsExist(pkgDir, manifest);

        expect(result.passed).toBe(false);
        expect(result.findings.map((f) => f.id).sort()).toEqual([
            "exportsExist:bin:./dist/cli.js",
            "exportsExist:main:./dist/index.js",
            "exportsExist:types:./dist/index.d.ts",
        ]);
    });

    it("checks wildcard prefix dirs", async () => {
        const manifest: PackageManifest = {
            exports: { "./feat/*": "./dist/feat/*.js" },
            name: "x",
            version: "1.0.0",
        };

        const missing = await runExportsExist(pkgDir, manifest);

        expect(missing.passed).toBe(false);

        mkdirSync(join(pkgDir, "dist", "feat"), { recursive: true });

        const present = await runExportsExist(pkgDir, manifest);

        expect(present.passed).toBe(true);
    });

    it("ignores bare specifiers", async () => {
        const manifest: PackageManifest = {
            exports: { ".": "react" },
            name: "x",
            version: "1.0.0",
        };

        const result = await runExportsExist(pkgDir, manifest);

        expect(result.passed).toBe(true);
    });

    it("rejects manifest exports that traverse outside the package dir (RFC §19.4)", async () => {
        const manifest: PackageManifest = {
            bin: { evil: "./../../usr/bin/env" },
            main: "./../../etc/passwd",
            name: "x",
            version: "1.0.0",
        };

        const result = await runExportsExist(pkgDir, manifest);

        // Both leaves must be flagged regardless of whether the traversal
        // target happens to exist on disk.
        expect(result.passed).toBe(false);

        const ids = result.findings.map((f) => f.id);

        expect(ids).toContain("exportsExist:main:./../../etc/passwd");
        expect(ids).toContain("exportsExist:bin.evil:./../../usr/bin/env");
    });
});

describe(runLifecycleScripts, () => {
    const manifest = (scripts: Record<string, string>): PackageManifest => {
        return {
            name: "x",
            scripts,
            version: "1.0.0",
        };
    };

    it("returns passed when no lifecycle scripts present", () => {
        const result = runLifecycleScripts(manifest({ build: "tsc" }), "strict");

        expect(result.passed).toBe(true);
    });

    it("strict mode flags any unauthorized lifecycle script", () => {
        const result = runLifecycleScripts(manifest({ postinstall: "node bad.js" }), "strict");

        expect(result.passed).toBe(false);
        expect(result.findings).toHaveLength(1);
        expect(result.findings[0]?.id).toBe("lifecycleScripts:postinstall");
    });

    it("allow-list bypasses on exact-match", () => {
        const result = runLifecycleScripts(
            manifest({ postinstall: "node-gyp rebuild" }),
            { allow: { postinstall: "node-gyp rebuild" }, mode: "strict" },
        );

        expect(result.passed).toBe(true);
    });

    it("allow-list rejects on partial match", () => {
        const result = runLifecycleScripts(
            manifest({ postinstall: "node-gyp rebuild --debug" }),
            { allow: { postinstall: "node-gyp rebuild" }, mode: "strict" },
        );

        expect(result.passed).toBe(false);
    });

    it("off mode short-circuits to passed", () => {
        const result = runLifecycleScripts(manifest({ postinstall: "rm -rf /" }), "off");

        expect(result.passed).toBe(true);
        expect(result.findings).toHaveLength(0);
    });
});

describe(runRuntimeAudit, () => {
    let pkgDir: string;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-guards-audit-"));
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
    });

    it("passes when no runtime advisories", async () => {
        const runner = stubRunner([
            {
                args: ["audit", "--omit=dev", "--json"],
                stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0, low: 0, moderate: 0 } } }),
            },
        ]);

        const result = await runRuntimeAudit(pkgDir, runner, "moderate");

        expect(result.passed).toBe(true);
    });

    it("fails when count >= configured severity", async () => {
        const runner = stubRunner([
            {
                args: ["audit", "--omit=dev", "--json"],
                stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 2, low: 0, moderate: 0 } } }),
            },
        ]);

        const result = await runRuntimeAudit(pkgDir, runner, "high");

        expect(result.passed).toBe(false);
        expect(result.findings[0]?.id).toBe("audit:high");
    });

    it("ignores severities below the threshold", async () => {
        const runner = stubRunner([
            {
                args: ["audit", "--omit=dev", "--json"],
                stdout: JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0, low: 5, moderate: 0 } } }),
            },
        ]);

        const result = await runRuntimeAudit(pkgDir, runner, "high");

        expect(result.passed).toBe(true);
    });

    it("short-circuits when setting is off", async () => {
        const runner = stubRunner([]);

        const result = await runRuntimeAudit(pkgDir, runner, "off");

        expect(result.passed).toBe(true);
    });

    it("returns parse-failure finding when output isn't JSON", async () => {
        const runner = stubRunner([
            { args: ["audit", "--omit=dev", "--json"], exitCode: 0, stdout: "not json" },
        ]);

        const result = await runRuntimeAudit(pkgDir, runner, "moderate");

        expect(result.passed).toBe(false);
        expect(result.findings[0]?.id).toBe("audit:parse");
    });
});

describe(extractPackFilesFromRaw, () => {
    it("reads npm pack --json shape (array)", () => {
        const raw = [
            {
                filename: "pkg-1.0.0.tgz",
                files: [
                    { path: "package.json", size: 100 },
                    { path: "dist/index.js", size: 250 },
                ],
            },
        ];

        expect(extractPackFilesFromRaw(raw)).toEqual(["package.json", "dist/index.js"]);
    });

    it("reads pnpm pack --json shape (object)", () => {
        const raw = {
            filename: "pkg-1.0.0.tgz",
            files: [{ path: "package.json" }, { path: "dist/index.js" }],
        };

        expect(extractPackFilesFromRaw(raw)).toEqual(["package.json", "dist/index.js"]);
    });

    it("returns undefined for plain stdout strings (yarn, bun)", () => {
        expect(extractPackFilesFromRaw("➤ YN0036: │ Calling the \"prepack\" lifecycle script")).toBeUndefined();
    });

    it("returns undefined for null / non-objects", () => {
        expect(extractPackFilesFromRaw(null)).toBeUndefined();
        expect(extractPackFilesFromRaw(42)).toBeUndefined();
    });

    it("returns undefined when the files key is missing or wrong type", () => {
        expect(extractPackFilesFromRaw({ filename: "x.tgz" })).toBeUndefined();
        expect(extractPackFilesFromRaw({ files: "not an array" })).toBeUndefined();
    });

    it("skips file entries without a string path", () => {
        const raw = { files: [{ path: "ok.js" }, { size: 10 }, { path: 42 }] };

        expect(extractPackFilesFromRaw(raw)).toEqual(["ok.js"]);
    });
});

describe(hashTarball, () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "vis-guards-hash-"));
    });

    afterEach(() => {
        rmSync(dir, { force: true, recursive: true });
    });

    it("computes deterministic SHA256 + SHA512 hashes", async () => {
        const tarball = join(dir, "pkg-1.0.0.tgz");

        writeFileSync(tarball, "stable test content");

        const a = await hashTarball(tarball);
        const b = await hashTarball(tarball);

        expect(a.sha256).toBe(b.sha256);
        expect(a.sha512).toBe(b.sha512);
        expect(a.size).toBe("stable test content".length);
        expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(a.sha512).toMatch(/^[0-9a-f]{128}$/);
    });
});

describe("runPublishGuards orchestration", () => {
    let pkgDir: string;

    beforeEach(() => {
        pkgDir = mkdtempSync(join(tmpdir(), "vis-guards-orchestrate-"));
        mkdirSync(join(pkgDir, "dist"), { recursive: true });
        writeFileSync(join(pkgDir, "dist", "index.js"), "");
    });

    afterEach(() => {
        rmSync(pkgDir, { force: true, recursive: true });
    });

    it("runs only the gates that are enabled", async () => {
        const runner = stubRunner([]);
        const manifest: PackageManifest = { main: "./dist/index.js", name: "x", version: "1.0.0" };

        const report = await runPublishGuards({
            config: { exportsExist: true },
            manifest,
            packFiles: [],
            pkgDir,
            runner,
        });

        expect(report.results).toHaveLength(1);
        expect(report.results[0]?.gate).toBe("exportsExist");
    });

    it("classifies lifecycle warnings vs strict blockers", async () => {
        const runner = stubRunner([]);
        const manifest: PackageManifest = {
            name: "x",
            scripts: { postinstall: "do bad" },
            version: "1.0.0",
        };

        const warnReport = await runPublishGuards({
            config: { lifecycleScripts: "warn" },
            manifest,
            packFiles: [],
            pkgDir,
            runner,
        });

        expect(warnReport.blockers).toHaveLength(0);
        expect(warnReport.warnings).toHaveLength(1);

        const strictReport = await runPublishGuards({
            config: { lifecycleScripts: "strict" },
            manifest,
            packFiles: [],
            pkgDir,
            runner,
        });

        expect(strictReport.blockers).toHaveLength(1);
        expect(strictReport.warnings).toHaveLength(0);
    });

    it("returns empty report when config is undefined", async () => {
        const runner = stubRunner([]);
        const manifest: PackageManifest = { name: "x", version: "1.0.0" };

        const report = await runPublishGuards({
            config: undefined,
            manifest,
            packFiles: [],
            pkgDir,
            runner,
        });

        expect(report.results).toHaveLength(0);
        expect(report.blockers).toHaveLength(0);
    });
});
