import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { CONFIG_FILES, defineConfig, findVisConfigFile, loadVisConfig } from "../src/config";

describe("defineConfig", () => {
    it("should return the config object as-is", () => {
        const config = defineConfig({ update: { target: "minor" } });

        expect(config).toEqual({ update: { target: "minor" } });
    });

    it("should return empty config", () => {
        expect(defineConfig({})).toEqual({});
    });

    it("should support all config sections", () => {
        const config = defineConfig({
            ai: { priority: { claude: 100 }, provider: "claude" },
            update: { exclude: ["@types/*"], format: "json", install: false, prerelease: true, security: true, target: "patch" },
        });

        expect(config.ai?.provider).toBe("claude");
        expect(config.update?.target).toBe("patch");
    });
});

describe("cONFIG_FILES", () => {
    it("should list all supported extensions", () => {
        expect(CONFIG_FILES).toContain("vis.config.ts");
        expect(CONFIG_FILES).toContain("vis.config.js");
        expect(CONFIG_FILES).toContain("vis.config.mjs");
        expect(CONFIG_FILES).toContain("vis.config.cjs");
        expect(CONFIG_FILES).toContain("vis.config.mts");
        expect(CONFIG_FILES).toContain("vis.config.cts");
    });

    it("should check .ts first", () => {
        expect(CONFIG_FILES[0]).toBe("vis.config.ts");
    });
});

describe("findVisConfigFile", () => {
    it("should find vis.config.ts", () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.ts"), "export default {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.ts"));
    });

    it("should find vis.config.js", () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.js"), "module.exports = {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.js"));
    });

    it("should prefer .ts over .js", () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.ts"), "export default {};");
        writeFileSync(join(temporaryDirectory, "vis.config.js"), "module.exports = {};");

        expect(findVisConfigFile(temporaryDirectory)).toBe(join(temporaryDirectory, "vis.config.ts"));
    });

    it("should return undefined when no config found", () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(findVisConfigFile(temporaryDirectory)).toBeUndefined();
    });
});

describe("loadVisConfig", () => {
    it("should return empty config when no file exists", async () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const config = await loadVisConfig(temporaryDirectory);

        expect(config).toEqual({});
    });

    it("should load a JavaScript config file", async () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), "export default { update: { target: \"minor\" } };");

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.target).toBe("minor");
    });

    it("should load a TypeScript config file", async () => {
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
    });

    it("should support function-based config", async () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), "export default () => ({ update: { security: true } });");

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.security).toBe(true);
    });

    it("should support async function-based config", async () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.mjs"), "export default async () => ({ ai: { provider: \"gemini\" } });");

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.ai?.provider).toBe("gemini");
    });

    it("should load CJS config file", async () => {
        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "vis.config.cjs"), "module.exports = { update: { format: \"json\" } };");

        const config = await loadVisConfig(temporaryDirectory);

        expect(config.update?.format).toBe("json");
    });
});
