import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CONFIG_FILES, defineConfig, findVisConfigFile, loadVisConfig, SECURITY_DEFAULTS } from "../src/config/config";

describe(defineConfig, () => {
    it("should apply secure defaults to empty config", () => {
        expect.assertions(7);

        const config = defineConfig({});

        expect(config.security?.minimumReleaseAge).toBeUndefined();
        expect(config.security?.trustPolicy).toBe("no-downgrade");
        expect(config.security?.trustPolicyIgnoreAfter).toBe(SECURITY_DEFAULTS.trustPolicyIgnoreAfter);
        expect(config.security?.blockExoticSubdeps).toBe(true);
        expect(config.security?.strictDepBuilds).toBe(true);
        expect(config.update?.security).toBe(true);
        expect(config.update?.target).toBe("minor");
    });

    it("should preserve user overrides over defaults", () => {
        expect.assertions(3);

        const config = defineConfig({
            security: { minimumReleaseAge: 1440, strictDepBuilds: false },
            update: { target: "patch" },
        });

        expect(config.security?.minimumReleaseAge).toBe(1440);
        expect(config.security?.strictDepBuilds).toBe(false);
        expect(config.update?.target).toBe("patch");
    });

    it("should merge user allowBuilds with defaults", () => {
        expect.assertions(2);

        const config = defineConfig({
            security: { allowBuilds: { esbuild: true } },
        });

        expect(config.security?.allowBuilds).toStrictEqual({ esbuild: true });
        expect(config.security?.trustPolicy).toBe("no-downgrade");
    });

    it("should support all config sections", () => {
        expect.assertions(2);

        const config = defineConfig({
            ai: { priority: { claude: 100 }, provider: "claude" },
            update: { exclude: ["@types/*"], format: "json", install: false, prerelease: true, security: true, target: "patch" },
        });

        expect(config.ai?.provider).toBe("claude");
        expect(config.update?.target).toBe("patch");
    });

    it("should allow user to explicitly disable a default", () => {
        expect.assertions(2);

        const config = defineConfig({
            security: { blockExoticSubdeps: false, trustPolicy: "off" },
        });

        expect(config.security?.blockExoticSubdeps).toBe(false);
        expect(config.security?.trustPolicy).toBe("off");
    });
});

describe("cONFIG_FILES", () => {
    it("should list all supported extensions", () => {
        expect.assertions(6);

        expect(CONFIG_FILES).toContain("vis.config.ts");
        expect(CONFIG_FILES).toContain("vis.config.js");
        expect(CONFIG_FILES).toContain("vis.config.mjs");
        expect(CONFIG_FILES).toContain("vis.config.cjs");
        expect(CONFIG_FILES).toContain("vis.config.mts");
        expect(CONFIG_FILES).toContain("vis.config.cts");
    });

    it("should check .ts first", () => {
        expect.assertions(1);

        expect(CONFIG_FILES[0]).toBe("vis.config.ts");
    });
});

describe(findVisConfigFile, () => {
    it("should find vis.config.ts", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.ts"), "export default {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.ts"));
    });

    it("should find vis.config.js", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.js"), "module.exports = {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.js"));
    });

    it("should prefer .ts over .js", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.ts"), "export default {};");
        writeFileSync(join(temporaryDirectory, "vis.config.js"), "module.exports = {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.ts"));
    });

    it("should return undefined when no config found", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(findVisConfigFile(temporaryDirectory)).toBeUndefined();
    });
});

describe(loadVisConfig, () => {
    it("should return secure defaults when no file exists", async () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const config = await loadVisConfig(temporaryDirectory);

        expect(config.security?.minimumReleaseAge).toBeUndefined();
        expect(config.security?.trustPolicy).toBe("no-downgrade");
        expect(config.security?.blockExoticSubdeps).toBe(true);
    });

    it("should load a JavaScript config file and apply defaults", async () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), 'export default { update: { target: "minor" } };');

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.target).toBe("minor");
        expect(config.security?.trustPolicy).toBe("no-downgrade");
    });

    it("should load a TypeScript config file and apply defaults", async () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "vis.config.ts"),
            `
interface Config { update?: { target?: string } }
const config: Config = { update: { target: "patch" } };
export default config;
`,
        );

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.target).toBe("patch");
        expect(config.security?.blockExoticSubdeps).toBe(true);
    });

    it("should support function-based config", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), "export default () => ({ update: { security: true } });");

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.security).toBe(true);
    });

    it("should support async function-based config", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), 'export default async () => ({ ai: { provider: "gemini" } });');

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.ai?.provider).toBe("gemini");
    });

    it("should load CJS config file", async () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.cjs"), 'module.exports = { update: { format: "json" } };');

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.format).toBe("json");
    });
});

describe("config cache", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-cache-test-"));
        // Create node_modules so find-cache-dir can resolve
        mkdirSync(join(tmpDir, "node_modules"), { recursive: true });
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
    });

    it("should create a cache file after first load", async () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "vis.config.mjs"), 'export default { update: { target: "patch" } };');

        const config = await loadVisConfig(tmpDir);

        expect(config.update?.target).toBe("patch");

        const cachePath = join(tmpDir, "node_modules", ".cache", "vis", "vis-config-cache.json");
        const cacheExists = (() => {
            try {
                readFileSync(cachePath);

                return true;
            } catch {
                return false;
            }
        })();

        expect(cacheExists).toBe(true);
    });

    it("should return cached config on second load without recompiling", async () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "vis.config.mjs"), 'export default { update: { target: "patch" } };');

        const first = await loadVisConfig(tmpDir);
        const second = await loadVisConfig(tmpDir);

        expect(first.update?.target).toBe("patch");
        expect(second.update?.target).toBe("patch");
    });

    it("should invalidate cache when config file changes", async () => {
        expect.assertions(2);

        writeFileSync(join(tmpDir, "vis.config.mjs"), 'export default { update: { target: "patch" } };');

        const first = await loadVisConfig(tmpDir);

        expect(first.update?.target).toBe("patch");

        // Modify the config file
        writeFileSync(join(tmpDir, "vis.config.mjs"), 'export default { update: { target: "latest" } };');

        const second = await loadVisConfig(tmpDir);

        expect(second.update?.target).toBe("latest");
    });

    it("should handle corrupt cache gracefully", async () => {
        expect.assertions(1);

        writeFileSync(join(tmpDir, "vis.config.mjs"), 'export default { update: { target: "minor" } };');

        // Write corrupt cache
        const cacheDir = join(tmpDir, "node_modules", ".cache", "vis");

        mkdirSync(cacheDir, { recursive: true });
        writeFileSync(join(cacheDir, "vis-config-cache.json"), "not valid json{{{");

        const config = await loadVisConfig(tmpDir);

        expect(config.update?.target).toBe("minor");
    });
});
