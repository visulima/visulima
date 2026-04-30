import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VisConfig } from "../src/config/workspace";
import { checkSecurityConfig, scanUnapprovedBuildScripts } from "../src/security/security";

describe(checkSecurityConfig, () => {
    describe("no security section", () => {
        it("should warn when security config is missing entirely", () => {
            expect.assertions(2);

            const result = checkSecurityConfig({}, "pnpm");

            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain("No security settings configured");
        });

        it("should suggest using defineConfig", () => {
            expect.assertions(1);

            const result = checkSecurityConfig({}, "npm");

            expect(result.warnings.some((w) => w.includes("defineConfig"))).toBe(true);
        });
    });

    describe("minimumReleaseAge", () => {
        it("should warn when explicitly set to 0", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { minimumReleaseAge: 0 } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("minimumReleaseAge is explicitly set to 0"))).toBe(true);
        });

        it("should not warn when set to a positive value", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { minimumReleaseAge: 1440 } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("minimumReleaseAge"))).toBe(false);
        });

        it("should not warn when undefined (defaults apply)", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { allowBuilds: { esbuild: true } } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("minimumReleaseAge"))).toBe(false);
        });
    });

    describe("allowBuilds", () => {
        it("should warn when not configured for pnpm", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { minimumReleaseAge: 1440 } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("allowBuilds") && w.includes("pnpm"))).toBe(true);
        });

        it("should warn differently for non-pnpm managers", () => {
            expect.assertions(2);

            const config: VisConfig = { security: { minimumReleaseAge: 1440 } };
            const result = checkSecurityConfig(config, "npm");

            expect(result.warnings.some((w) => w.includes("allowBuilds"))).toBe(true);
            expect(result.warnings.some((w) => w.includes("pnpm blocks build scripts"))).toBe(false);
        });

        it("should not warn when configured with entries", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    allowBuilds: { esbuild: true },
                    minimumReleaseAge: 1440,
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("allowBuilds is not configured"))).toBe(false);
        });

        it("should warn when configured with empty object", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    allowBuilds: {},
                    minimumReleaseAge: 1440,
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("allowBuilds"))).toBe(true);
        });
    });

    describe("trustPolicy", () => {
        it("should warn when explicitly set to off", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { minimumReleaseAge: 1440, trustPolicy: "off" } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("trustPolicy is explicitly set to 'off'"))).toBe(true);
        });

        it("should not warn when set to no-downgrade", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    allowBuilds: { esbuild: true },
                    minimumReleaseAge: 1440,
                    trustPolicy: "no-downgrade",
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("trustPolicy"))).toBe(false);
        });

        it("should not warn when undefined (defaults apply)", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { allowBuilds: { esbuild: true } } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("trustPolicy"))).toBe(false);
        });
    });

    describe("blockExoticSubdeps", () => {
        it("should warn when explicitly disabled", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { blockExoticSubdeps: false } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("blockExoticSubdeps is explicitly disabled"))).toBe(true);
        });

        it("should not warn when enabled", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    allowBuilds: { esbuild: true },
                    blockExoticSubdeps: true,
                    minimumReleaseAge: 1440,
                    trustPolicy: "no-downgrade",
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("blockExoticSubdeps"))).toBe(false);
        });

        it("should not warn when undefined (defaults apply)", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { allowBuilds: { esbuild: true } } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("blockExoticSubdeps"))).toBe(false);
        });
    });

    describe("strictDepBuilds", () => {
        it("should error when enabled without allowBuilds", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    minimumReleaseAge: 1440,
                    strictDepBuilds: true,
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.errors.some((e) => e.includes("strictDepBuilds"))).toBe(true);
        });

        it("should not error when enabled with allowBuilds", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: {
                    allowBuilds: { esbuild: true },
                    minimumReleaseAge: 1440,
                    strictDepBuilds: true,
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.errors.some((e) => e.includes("strictDepBuilds"))).toBe(false);
        });

        it("should warn when explicitly disabled", () => {
            expect.assertions(1);

            const config: VisConfig = { security: { strictDepBuilds: false } };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings.some((w) => w.includes("strictDepBuilds is explicitly disabled"))).toBe(true);
        });
    });

    describe("fully configured security", () => {
        it("should produce no warnings when all settings are configured", () => {
            expect.assertions(2);

            const config: VisConfig = {
                security: {
                    allowBuilds: { "@prisma/client": true, esbuild: true },
                    blockExoticSubdeps: true,
                    minimumReleaseAge: 1440,
                    trustPolicy: "no-downgrade",
                },
            };
            const result = checkSecurityConfig(config, "pnpm");

            expect(result.warnings).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
});

describe("approve-builds scanning", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-approve-test-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("should detect packages with postinstall scripts", () => {
        expect.assertions(2);

        // Create a fake node_modules with a package that has postinstall
        const pkgDir = join(tmpDir, "node_modules", "evil-pkg");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                name: "evil-pkg",
                scripts: { postinstall: "node steal-secrets.js" },
            }),
        );

        // Import and test

        const unapproved = scanUnapprovedBuildScripts(tmpDir, {});

        expect(unapproved).toHaveLength(1);
        expect(unapproved[0]).toContain("evil-pkg");
    });

    it("should not flag approved packages", () => {
        expect.assertions(1);

        const pkgDir = join(tmpDir, "node_modules", "esbuild");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                name: "esbuild",
                scripts: { postinstall: "node install.js" },
            }),
        );

        const unapproved = scanUnapprovedBuildScripts(tmpDir, { esbuild: true });

        expect(unapproved).toHaveLength(0);
    });

    it("should handle scoped packages", () => {
        expect.assertions(2);

        const pkgDir = join(tmpDir, "node_modules", "@prisma", "client");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                name: "@prisma/client",
                scripts: { postinstall: "prisma generate" },
            }),
        );

        // Not approved
        const unapproved = scanUnapprovedBuildScripts(tmpDir, {});

        expect(unapproved).toHaveLength(1);
        expect(unapproved[0]).toContain("@prisma/client");
    });

    it("should approve scoped packages with glob pattern", () => {
        expect.assertions(1);

        const pkgDir = join(tmpDir, "node_modules", "@prisma", "client");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                name: "@prisma/client",
                scripts: { postinstall: "prisma generate" },
            }),
        );

        const unapproved = scanUnapprovedBuildScripts(tmpDir, { "@prisma/*": true });

        expect(unapproved).toHaveLength(0);
    });

    it("should not flag packages without build scripts", () => {
        expect.assertions(1);

        const pkgDir = join(tmpDir, "node_modules", "lodash");

        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({
                name: "lodash",
                scripts: { test: "jest" },
            }),
        );

        const unapproved = scanUnapprovedBuildScripts(tmpDir, {});

        expect(unapproved).toHaveLength(0);
    });

    it("should return empty for missing node_modules", () => {
        expect.assertions(1);

        const unapproved = scanUnapprovedBuildScripts(tmpDir, {});

        expect(unapproved).toHaveLength(0);
    });
});
