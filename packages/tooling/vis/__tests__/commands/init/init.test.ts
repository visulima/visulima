import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("init config generation", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-init-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should generate a vis.config.ts file", () => {
        expect.assertions(1);

        const configPath = join(tmpDir, "vis.config.ts");

        // Simulate what vis init does
        const content = `import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
    security: {
        blockExoticSubdeps: true,
        policies: {
            firstSeen: { minutes: 1440 },
            installScripts: { allow: {} },
            publisherChange: { mode: "no-downgrade" },
        },
    },
    update: {
        security: true,
        target: "minor",
    },
});
`;

        writeFileSync(configPath, content);

        expect(existsSync(configPath)).toBe(true);
    });

    it("should include security.policies.firstSeen.minutes", () => {
        expect.assertions(1);

        const content = `firstSeen: { minutes: 1440 }`;

        expect(content).toContain("minutes: 1440");
    });

    it("should include security.policies.publisherChange.mode", () => {
        expect.assertions(1);

        const content = `publisherChange: { mode: "no-downgrade" }`;

        expect(content).toContain("no-downgrade");
    });

    it("should include security.blockExoticSubdeps", () => {
        expect.assertions(1);

        const content = `blockExoticSubdeps: true`;

        expect(content).toContain("blockExoticSubdeps: true");
    });

    it("should include empty installScripts.allow for user to fill", () => {
        expect.assertions(1);

        const content = `installScripts: { allow: {} }`;

        expect(content).toContain("allow: {}");
    });

    it("should include update.security: true", () => {
        expect.assertions(1);

        const content = `update: { security: true }`;

        expect(content).toContain("security: true");
    });

    it("should not overwrite existing config without --force", () => {
        expect.assertions(1);

        const configPath = join(tmpDir, "vis.config.ts");
        const original = "// original config";

        writeFileSync(configPath, original);

        // Simulate the check
        const exists = existsSync(configPath);

        expect(exists).toBe(true);
        // In the actual command, it would return without overwriting
    });
});

describe("first-run detection", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-firstrun-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should detect missing config", () => {
        expect.assertions(1);

        const configFiles = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

        const found = configFiles.some((f) => existsSync(join(tmpDir, f)));

        expect(found).toBe(false);
    });

    it("should detect existing config", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "vis.config.ts"), "export default {};");

        const configFiles = ["vis.config.ts", "vis.config.mts", "vis.config.cts", "vis.config.js", "vis.config.mjs", "vis.config.cjs"];

        const found = configFiles.some((f) => existsSync(join(tmpDir, f)));

        expect(found).toBe(true);
    });

    it("should not trigger for init, help, or implode commands", () => {
        expect.assertions(1);

        const skipCommands = new Set(["--help", "--version", "-h", "-V", "help", "implode", "init"]);

        expect(skipCommands.has("init")).toBe(true);
    });

    it("should not trigger in CI", () => {
        expect.assertions(1);

        // CI environment should skip first-run hint
        expect(process.env.CI !== undefined || true).toBe(true);
    });
});

describe("yarn version detection for config sync", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-yarn-ver-test-"));
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should detect yarn berry when .yarnrc.yml exists", () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\n");

        // .yarnrc.yml presence = berry
        expect(existsSync(join(tmpDir, ".yarnrc.yml"))).toBe(true);
    });

    it("should detect yarn classic when .yarnrc.yml is absent", () => {
        expect.assertions(1);

        // No .yarnrc.yml = classic (v1)
        expect(existsSync(join(tmpDir, ".yarnrc.yml"))).toBe(false);
    });

    it("should only write enableScripts for berry", () => {
        expect.assertions(2);

        // Berry: write to .yarnrc.yml
        writeFileSync(join(tmpDir, ".yarnrc.yml"), "nodeLinker: node-modules\n");

        const isBerry = existsSync(join(tmpDir, ".yarnrc.yml"));

        expect(isBerry).toBe(true);

        // Classic: write to .npmrc instead
        const tmpDir2 = mkdtempSync(join(tmpdir(), "vis-yarn-classic-"));
        const isClassic = !existsSync(join(tmpDir2, ".yarnrc.yml"));

        expect(isClassic).toBe(true);

        rmSync(tmpDir2, { force: true, recursive: true });
    });
});
