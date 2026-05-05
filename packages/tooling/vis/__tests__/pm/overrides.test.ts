import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyOverrides, lockfileContainsPackage, readLockfileText, readOverrides } from "../../src/pm/overrides";

describe("overrides", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-overrides-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    // ── Helpers ─────────────────────────────────────────────────────────

    const writePkgJson = (dir: string, content: Record<string, unknown>): string => {
        const filePath = join(dir, "package.json");

        writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`);

        return filePath;
    };

    const readPkgJson = (dir: string): Record<string, unknown> => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<string, unknown>;

    // ── readOverrides ───────────────────────────────────────────────────

    describe(readOverrides, () => {
        describe("npm", () => {
            it("should read overrides from package.json", () => {
                expect.assertions(2);

                const pkgJson = { overrides: { lodash: "^4.17.21" } };
                const result = readOverrides(tmpDir, pkgJson, { name: "npm", version: "10.0.0" });

                expect(result.source).toBe("package.json");
                expect(result.overrides).toStrictEqual({ lodash: "^4.17.21" });
            });

            it("should return empty when no overrides field", () => {
                expect.assertions(1);

                const result = readOverrides(tmpDir, {}, { name: "npm", version: "10.0.0" });

                expect(result.overrides).toStrictEqual({});
            });
        });

        describe("pnpm v9", () => {
            it("should read pnpm.overrides from package.json", () => {
                expect.assertions(2);

                const pkgJson = { pnpm: { overrides: { express: "^4.18.0" } } };
                const result = readOverrides(tmpDir, pkgJson, { name: "pnpm", version: "9.15.0" });

                expect(result.source).toBe("package.json");
                expect(result.overrides).toStrictEqual({ express: "^4.18.0" });
            });
        });

        describe("pnpm v10+", () => {
            it("should read overrides from pnpm-workspace.yaml", () => {
                expect.assertions(2);

                writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n\noverrides:\n  lodash: ^4.17.21\n");

                const result = readOverrides(tmpDir, {}, { name: "pnpm", version: "10.32.1" });

                expect(result.source).toBe("pnpm-workspace.yaml");
                expect(result.overrides).toStrictEqual({ lodash: "^4.17.21" });
            });

            it("should return empty when pnpm-workspace.yaml has no overrides", () => {
                expect.assertions(2);

                writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

                const result = readOverrides(tmpDir, {}, { name: "pnpm", version: "10.32.1" });

                expect(result.source).toBe("pnpm-workspace.yaml");
                expect(result.overrides).toStrictEqual({});
            });

            it("should return empty when no pnpm-workspace.yaml exists", () => {
                expect.assertions(1);

                const result = readOverrides(tmpDir, {}, { name: "pnpm", version: "10.32.1" });

                expect(result.overrides).toStrictEqual({});
            });
        });

        describe("yarn", () => {
            it("should read resolutions from package.json", () => {
                expect.assertions(2);

                const pkgJson = { resolutions: { chalk: "^5.0.0" } };
                const result = readOverrides(tmpDir, pkgJson, { name: "yarn", version: "4.0.0" });

                expect(result.source).toBe("package.json");
                expect(result.overrides).toStrictEqual({ chalk: "^5.0.0" });
            });
        });

        describe("bun", () => {
            it("should read resolutions from package.json", () => {
                expect.assertions(1);

                const pkgJson = { resolutions: { "is-regex": "^1.1.4" } };
                const result = readOverrides(tmpDir, pkgJson, { name: "bun", version: "1.2.0" });

                expect(result.overrides).toStrictEqual({ "is-regex": "^1.1.4" });
            });
        });
    });

    // ── applyOverrides ──────────────────────────────────────────────────

    describe(applyOverrides, () => {
        it("should add new overrides to npm package.json", () => {
            expect.assertions(3);

            const pkgJsonPath = writePkgJson(tmpDir, { dependencies: { lodash: "^4.0.0" }, name: "test" });

            const result = applyOverrides(tmpDir, pkgJsonPath, [{ original: "lodash", spec: "npm:@socketregistry/lodash@^4" }], {
                name: "npm",
                version: "10.0.0",
            });

            expect(result.added).toStrictEqual(["lodash"]);
            expect(result.updated).toStrictEqual([]);

            const pkg = readPkgJson(tmpDir);

            expect(pkg.overrides).toStrictEqual({ lodash: "$lodash" });
        });

        it("should use $<name> reference for npm direct deps", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { dependencies: { express: "^4.0.0" }, name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "express", spec: "npm:@socketregistry/express@^4" }], { name: "npm", version: "10.0.0" });

            const pkg = readPkgJson(tmpDir);

            expect((pkg.overrides as Record<string, string>).express).toBe("$express");
        });

        it("should use spec directly for non-direct deps (npm)", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { dependencies: {}, name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "qs", spec: "npm:@socketregistry/qs@^6" }], { name: "npm", version: "10.0.0" });

            const pkg = readPkgJson(tmpDir);

            expect((pkg.overrides as Record<string, string>).qs).toBe("npm:@socketregistry/qs@^6");
        });

        it("should write resolutions for yarn", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "chalk", spec: "npm:@socketregistry/chalk@^5" }], { name: "yarn", version: "4.0.0" });

            const pkg = readPkgJson(tmpDir);

            expect(pkg.resolutions).toStrictEqual({ chalk: "npm:@socketregistry/chalk@^5" });
        });

        it("should write pnpm.overrides for pnpm v9", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "lodash", spec: "npm:@socketregistry/lodash@^4" }], { name: "pnpm", version: "9.15.0" });

            const pkg = readPkgJson(tmpDir);
            const pnpm = pkg.pnpm as Record<string, unknown>;

            expect(pnpm.overrides).toStrictEqual({ lodash: "npm:@socketregistry/lodash@^4" });
        });

        it("should write to pnpm-workspace.yaml for pnpm v10+", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            const result = applyOverrides(tmpDir, pkgJsonPath, [{ original: "lodash", spec: "npm:@socketregistry/lodash@^4" }], {
                name: "pnpm",
                version: "10.32.1",
            });

            expect(result.added).toStrictEqual(["lodash"]);

            const yaml = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(yaml).toContain("'lodash': 'npm:@socketregistry/lodash@^4'");
        });

        it("should update existing overrides", () => {
            expect.assertions(2);

            const pkgJsonPath = writePkgJson(tmpDir, { name: "test", overrides: { lodash: "^4.17.0" } });

            const result = applyOverrides(tmpDir, pkgJsonPath, [{ original: "lodash", spec: "npm:@socketregistry/lodash@^4" }], {
                name: "npm",
                version: "10.0.0",
            });

            expect(result.added).toStrictEqual([]);
            expect(result.updated).toStrictEqual(["lodash"]);
        });

        it("should skip when spec is unchanged", () => {
            expect.assertions(2);

            const pkgJsonPath = writePkgJson(tmpDir, { name: "test", overrides: { lodash: "npm:@socketregistry/lodash@^4" } });

            const result = applyOverrides(tmpDir, pkgJsonPath, [{ original: "lodash", spec: "npm:@socketregistry/lodash@^4" }], {
                name: "npm",
                version: "10.0.0",
            });

            expect(result.added).toStrictEqual([]);
            expect(result.updated).toStrictEqual([]);
        });

        it("should sort overrides alphabetically", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            applyOverrides(
                tmpDir,
                pkgJsonPath,
                [
                    { original: "zzz", spec: "a" },
                    { original: "aaa", spec: "b" },
                ],
                { name: "npm", version: "10.0.0" },
            );

            const pkg = readPkgJson(tmpDir);
            const keys = Object.keys(pkg.overrides as Record<string, string>);

            expect(keys).toStrictEqual(["aaa", "zzz"]);
        });

        it("should place overrides field near dependencies", () => {
            expect.assertions(1);

            const pkgJsonPath = writePkgJson(tmpDir, { dependencies: { react: "^18" }, engines: { node: ">=20" }, name: "test", version: "1.0.0" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "react", spec: "$react" }], { name: "npm", version: "10.0.0" });

            const pkg = readPkgJson(tmpDir);
            const keys = Object.keys(pkg);
            const depsIdx = keys.indexOf("dependencies");
            const overridesIdx = keys.indexOf("overrides");

            expect(overridesIdx).toBe(depsIdx + 1);
        });

        it("should preserve indent style", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), `${JSON.stringify({ name: "test" }, null, "\t")}\n`);

            applyOverrides(tmpDir, join(tmpDir, "package.json"), [{ original: "foo", spec: "bar" }], { name: "npm", version: "10.0.0" });

            const raw = readFileSync(join(tmpDir, "package.json"), "utf8");

            expect(raw).toContain("\t");
        });

        it("should adopt indent from .editorconfig over file sniffing", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = space\nindent_size = 4\n", "utf8");
            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "foo", spec: "bar" }], { name: "npm", version: "10.0.0" });

            const raw = readFileSync(pkgJsonPath, "utf8");

            expect(raw).toMatch(/\n {4}"/);
        });

        it("should ignore .editorconfig when useEditorconfig is false", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".editorconfig"), "root = true\n\n[*.json]\nindent_style = space\nindent_size = 4\n", "utf8");
            const pkgJsonPath = writePkgJson(tmpDir, { name: "test" });

            applyOverrides(tmpDir, pkgJsonPath, [{ original: "foo", spec: "bar" }], { name: "npm", version: "10.0.0" }, false);

            const raw = readFileSync(pkgJsonPath, "utf8");

            expect(raw).toMatch(/\n {2}"/);
        });
    });

    // ── lockfileContainsPackage ─────────────────────────────────────────

    describe(lockfileContainsPackage, () => {
        it("should detect npm lockfile entries", () => {
            expect.assertions(2);

            const lockText = "{ \"packages\": { \"node_modules/lodash\": { \"version\": \"4.17.21\" } } }";

            expect(lockfileContainsPackage(`"lodash":`, "lodash", "npm")).toBe(true);
            expect(lockfileContainsPackage(lockText, "nonexistent", "npm")).toBe(false);
        });

        it("should detect pnpm lockfile entries", () => {
            expect.assertions(2);

            expect(lockfileContainsPackage("lodash@4.17.21:\n  resolution:", "lodash", "pnpm")).toBe(true);
            expect(lockfileContainsPackage("'express':\n  specifier:", "express", "pnpm")).toBe(true);
        });

        it("should detect yarn lockfile entries", () => {
            expect.assertions(2);

            expect(lockfileContainsPackage("lodash@^4.17.0:\n  version: 4.17.21", "lodash", "yarn")).toBe(true);
            expect(lockfileContainsPackage("react@^18.0.0:", "nonexistent", "yarn")).toBe(false);
        });

        it("should detect bun lockfile entries (both formats)", () => {
            expect.assertions(2);

            expect(lockfileContainsPackage("\"lodash\":", "lodash", "bun")).toBe(true);
            expect(lockfileContainsPackage("chalk@5.0.0:", "chalk", "bun")).toBe(true);
        });

        it("should return false for empty lockfile text", () => {
            expect.assertions(1);

            expect(lockfileContainsPackage("", "lodash", "npm")).toBe(false);
        });
    });

    // ── readLockfileText ────────────────────────────────────────────────

    describe(readLockfileText, () => {
        it("should read npm lockfile", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package-lock.json"), "{\"lockfileVersion\": 3}");

            const text = readLockfileText(tmpDir, "npm");

            expect(text).toContain("lockfileVersion");
        });

        it("should read pnpm lockfile", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");

            const text = readLockfileText(tmpDir, "pnpm");

            expect(text).toContain("lockfileVersion");
        });

        it("should read yarn lockfile", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "yarn.lock"), "# yarn lockfile v1");

            const text = readLockfileText(tmpDir, "yarn");

            expect(text).toContain("yarn lockfile");
        });

        it("should return empty string when no lockfile exists", () => {
            expect.assertions(1);

            expect(readLockfileText(tmpDir, "npm")).toBe("");
        });

        it("should try bun.lock first for bun", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "bun.lock"), "{\"packages\":{}}");

            expect(readLockfileText(tmpDir, "bun")).toContain("packages");
        });
    });
});
