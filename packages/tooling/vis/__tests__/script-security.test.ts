import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { enforceScriptSecurity, syncAllowBuildsToNativeConfig } from "../src/security";
import type { VisConfig } from "../src/workspace";

// ── enforceScriptSecurity ────────────────────────────────────────────

describe(enforceScriptSecurity, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-script-sec-"));
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    describe("pnpm", () => {
        it("should report scripts blocked by default", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("pnpm", tmpDir, {});

            expect(result.scriptsBlockedByDefault).toBe(true);
        });

        it("should warn when no allowBuilds configured", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("pnpm", tmpDir, {});

            expect(result.warnings.some((w) => w.includes("approve-builds"))).toBe(true);
        });

        it("should not add extra args (pnpm handles natively)", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("pnpm", tmpDir, {
                security: { allowBuilds: { esbuild: true } },
            });

            expect(result.extraArgs).toStrictEqual([]);
        });
    });

    describe("bun", () => {
        it("should report scripts blocked by default", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("bun", tmpDir, {});

            expect(result.scriptsBlockedByDefault).toBe(true);
        });

        it("should warn when trustedDependencies is empty but allowBuilds is set", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: { allowBuilds: { esbuild: true } },
            };

            const result = enforceScriptSecurity("bun", tmpDir, config);

            expect(result.warnings.some((w) => w.includes("trustedDependencies"))).toBe(true);
        });

        it("should not warn when trustedDependencies exists in package.json", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test", trustedDependencies: ["esbuild"] }));

            const result = enforceScriptSecurity("bun", tmpDir, {
                security: { allowBuilds: { esbuild: true } },
            });

            expect(result.warnings.some((w) => w.includes("trustedDependencies is empty"))).toBe(false);
        });
    });

    describe("npm", () => {
        it("should NOT report scripts blocked by default", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("npm", tmpDir, {});

            expect(result.scriptsBlockedByDefault).toBe(false);
        });

        it("should warn about missing ignore-scripts in .npmrc", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("npm", tmpDir, {});

            expect(result.warnings.some((w) => w.includes("ignore-scripts"))).toBe(true);
        });

        it("should add --ignore-scripts when allowBuilds is configured but .npmrc lacks it", () => {
            expect.assertions(1);

            const config: VisConfig = {
                security: { allowBuilds: { esbuild: true } },
            };

            const result = enforceScriptSecurity("npm", tmpDir, config);

            expect(result.extraArgs).toContain("--ignore-scripts");
        });

        it("should collect postInstallPackages from allowBuilds", () => {
            expect.assertions(2);

            const config: VisConfig = {
                security: {
                    allowBuilds: {
                        "@prisma/client": true,
                        "core-js": false,
                        esbuild: true,
                    },
                },
            };

            const result = enforceScriptSecurity("npm", tmpDir, config);

            expect(result.postInstallPackages).toContain("esbuild");
            expect(result.postInstallPackages).not.toContain("core-js");
        });

        it("should not add --ignore-scripts when .npmrc already has it", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "ignore-scripts=true\n");

            const config: VisConfig = {
                security: { allowBuilds: { esbuild: true } },
            };

            const result = enforceScriptSecurity("npm", tmpDir, config);

            expect(result.extraArgs).not.toContain("--ignore-scripts");
        });
    });

    describe("yarn", () => {
        it("should NOT report scripts blocked by default without .yarnrc.yml", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("yarn", tmpDir, {});

            expect(result.scriptsBlockedByDefault).toBe(false);
        });

        it("should warn about yarn classic lacking script blocking", () => {
            expect.assertions(1);

            const result = enforceScriptSecurity("yarn", tmpDir, {});

            expect(result.warnings.some((w) => w.includes("yarn classic"))).toBe(true);
        });

        it("should detect enableScripts: false in .yarnrc.yml", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\nenableScripts: false\n");

            const result = enforceScriptSecurity("yarn", tmpDir, {});

            expect(result.scriptsBlockedByDefault).toBe(true);
        });

        it("should warn when .yarnrc.yml exists without enableScripts: false", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\n");

            const result = enforceScriptSecurity("yarn", tmpDir, {});

            expect(result.warnings.some((w) => w.includes("enableScripts: false"))).toBe(true);
        });
    });
});

// ── syncAllowBuildsToNativeConfig ────────────────────────────────────

describe(syncAllowBuildsToNativeConfig, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-sync-sec-"));
        writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "test" }));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    describe("bun", () => {
        it("should write trustedDependencies to package.json", () => {
            expect.assertions(2);

            const actions = syncAllowBuildsToNativeConfig("bun", tmpDir, {
                "@prisma/client": true,
                "core-js": false,
                esbuild: true,
            });

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8"));

            expect(pkg.trustedDependencies).toStrictEqual(["esbuild", "@prisma/client"]);
            expect(actions.length).toBeGreaterThan(0);
        });
    });

    describe("npm", () => {
        it("should create .npmrc with ignore-scripts=true", () => {
            expect.assertions(1);

            syncAllowBuildsToNativeConfig("npm", tmpDir, { esbuild: true });

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("ignore-scripts=true");
        });

        it("should not duplicate ignore-scripts if already present", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".npmrc"), "registry=https://registry.npmjs.org/\nignore-scripts=true\n");

            syncAllowBuildsToNativeConfig("npm", tmpDir, { esbuild: true });

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");
            const count = (content.match(/ignore-scripts=true/g) ?? []).length;

            expect(count).toBe(1);
        });
    });

    describe("yarn berry", () => {
        it("should write enableScripts to existing .yarnrc.yml", () => {
            expect.assertions(2);

            // .yarnrc.yml must exist for berry detection
            writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\n");

            syncAllowBuildsToNativeConfig("yarn", tmpDir, { esbuild: true });

            const content = readFileSync(join(tmpDir, ".yarnrc.yml"), "utf8");

            expect(content).toContain("nodeLinker: node-modules");
            expect(content).toContain("enableScripts: false");
        });

        it("should change enableScripts from true to false", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "enableScripts: true\n");

            const actions = syncAllowBuildsToNativeConfig("yarn", tmpDir, { esbuild: true });

            expect(actions[0]).toContain("Changed enableScripts to false");
        });

        it("should not duplicate enableScripts if already false", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".yarnrc.yml"), "enableScripts: false\n");

            const actions = syncAllowBuildsToNativeConfig("yarn", tmpDir, { esbuild: true });

            expect(actions[0]).toContain("already has enableScripts");
        });
    });

    describe("yarn classic", () => {
        it("should fall back to .npmrc when no .yarnrc.yml", () => {
            expect.assertions(1);

            // No .yarnrc.yml = classic yarn -> writes to .npmrc
            syncAllowBuildsToNativeConfig("yarn", tmpDir, { esbuild: true });

            const content = readFileSync(join(tmpDir, ".npmrc"), "utf8");

            expect(content).toContain("ignore-scripts=true");
        });
    });

    describe("pnpm", () => {
        it("should report native handling", () => {
            expect.assertions(1);

            const actions = syncAllowBuildsToNativeConfig("pnpm", tmpDir, {
                esbuild: true,
                sharp: true,
            });

            expect(actions[0]).toContain("natively");
        });
    });
});
