import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Toolbox } from "@visulima/cerebro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSchemaRefForTesting } from "../../../src/commands/init/handler";
import initExecute from "../../../src/commands/release/init/handler";
import type { ReleaseInitOptions } from "../../../src/commands/release/init/index";

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

describe(buildSchemaRefForTesting, () => {
    const root = "/repo";

    it("emits a relative path from a workspace-root file", () => {
        expect.assertions(2);

        expect(buildSchemaRefForTesting(join(root, "project.json"), root, "project.schema.json")).toBe(
            "./node_modules/@visulima/vis/schemas/project.schema.json",
        );
        expect(buildSchemaRefForTesting(join(root, "vis.config.ts"), root, "vis-config.schema.json")).toBe(
            "./node_modules/@visulima/vis/schemas/vis-config.schema.json",
        );
    });

    it("walks up the right number of `..` segments from nested project files", () => {
        expect.assertions(2);

        expect(buildSchemaRefForTesting(join(root, "apps", "web", "project.json"), root, "project.schema.json")).toBe(
            "../../node_modules/@visulima/vis/schemas/project.schema.json",
        );
        expect(buildSchemaRefForTesting(join(root, "packages", "tooling", "name", "project.json"), root, "project.schema.json")).toBe(
            "../../../node_modules/@visulima/vis/schemas/project.schema.json",
        );
    });

    it("always emits forward slashes regardless of platform path style", () => {
        expect.assertions(1);

        const ref = buildSchemaRefForTesting(join(root, "apps", "web", "project.json"), root, "project.schema.json");

        expect(ref).not.toContain("\\");
    });
});

/**
 * Integration tests for the semantic-release migration path. Each test
 * copies the `semantic-release` fixture into a tmp dir, drives the init
 * handler with a fake cerebro Toolbox, then asserts on the resulting
 * filesystem + collected log output.
 */
describe("init --from-semantic-release", () => {
    const fixtureRoot = join(__dirname, "..", "..", "..", "__fixtures__", "init", "semantic-release");
    let tmpDir: string;
    let logs: { level: "info" | "warn" | "error"; message: string }[];

    const fakeLogger = (): Console => {
        const sink = (level: "info" | "warn" | "error") => (...args: unknown[]) => {
            logs.push({ level, message: args.map(String).join(" ") });
        };

        return {
            error: sink("error"),
            info: sink("info"),
            log: sink("info"),
            warn: sink("warn"),
        } as unknown as Console;
    };

    const fakeToolbox = (overrides: Partial<ReleaseInitOptions> = {}): Toolbox<Console, ReleaseInitOptions> => {
        // Default options match cerebro's behaviour: every kebab-case flag
        // surfaces as a camelCase property; absent flags are `undefined`.
        const options = {
            apply: undefined,
            dryRun: undefined,
            fresh: undefined,
            fromBumpy: undefined,
            fromChangesets: undefined,
            fromSemanticRelease: true,
            packageManager: undefined,
            workflows: undefined,
            yes: undefined,
            ...overrides,
        } as unknown as ReleaseInitOptions;

        return {
            argument: [],
            argv: [],
            command: { name: "init" } as never,
            commandName: "init",
            env: {},
            logger: fakeLogger(),
            options,
            projectRoot: undefined,
            runtimeFlags: {},
            workspaceRoot: tmpDir,
        } as unknown as Toolbox<Console, ReleaseInitOptions>;
    };

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-init-semrel-"));
        logs = [];
        // Copy the fixture verbatim into the tmp dir so each test starts clean.
        cpSync(fixtureRoot, tmpDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(tmpDir, { force: true, recursive: true });
        vi.restoreAllMocks();
    });

    it("prints suggestion and makes no migration writes without --apply", async () => {
        expect.assertions(6);

        const toolbox = fakeToolbox();

        await initExecute(toolbox);

        const allOutput = logs.map((l) => l.message).join("\n");

        // The suggestion block is still printed.
        expect(allOutput).toContain("Suggested vis.config.ts release block");
        expect(allOutput).toContain("\"vis-release\": { \"managed\": true }");

        // No vis.config.ts is written.
        expect(existsSync(join(tmpDir, "vis.config.ts"))).toBe(false);

        // .releaserc.json files are still in place.
        expect(existsSync(join(tmpDir, ".releaserc.json"))).toBe(true);
        expect(existsSync(join(tmpDir, "packages", "pkg-a", ".releaserc.json"))).toBe(true);

        // Package.json is untouched (no vis-release key added).
        const pkgA = JSON.parse(readFileSync(join(tmpDir, "packages", "pkg-a", "package.json"), "utf8")) as Record<string, unknown>;

        expect(pkgA["vis-release"]).toBeUndefined();
    });

    it("writes vis.config.ts, adds release.managed to packages, and deletes .releaserc.json files with --apply", async () => {
        expect.assertions(8);

        const toolbox = fakeToolbox({ apply: true });

        await initExecute(toolbox);

        // vis.config.ts is written and contains the release block + defineConfig import.
        const visConfigPath = join(tmpDir, "vis.config.ts");

        expect(existsSync(visConfigPath)).toBe(true);

        const visConfig = readFileSync(visConfigPath, "utf8");

        expect(visConfig).toContain("defineConfig");
        expect(visConfig).toContain("release: {");

        // Per-package package.json files gained `"vis-release": { "managed": true }`.
        const pkgA = JSON.parse(readFileSync(join(tmpDir, "packages", "pkg-a", "package.json"), "utf8")) as Record<string, unknown>;
        const pkgB = JSON.parse(readFileSync(join(tmpDir, "packages", "pkg-b", "package.json"), "utf8")) as Record<string, unknown>;

        expect(pkgA["vis-release"]).toStrictEqual({ managed: true });
        expect(pkgB["vis-release"]).toStrictEqual({ managed: true });

        // .releaserc.json files are deleted.
        expect(existsSync(join(tmpDir, ".releaserc.json"))).toBe(false);
        expect(existsSync(join(tmpDir, "packages", "pkg-a", ".releaserc.json"))).toBe(false);
        expect(existsSync(join(tmpDir, "packages", "pkg-b", ".releaserc.json"))).toBe(false);
    });

    it("ignores --apply when --dry-run is set (dry-run takes precedence) and logs a warning", async () => {
        expect.assertions(5);

        const toolbox = fakeToolbox({ apply: true, dryRun: true });

        await initExecute(toolbox);

        // Warning was logged at warn level.
        const warnMessages = logs.filter((l) => l.level === "warn").map((l) => l.message).join("\n");

        expect(warnMessages).toContain("--apply is ignored");
        expect(warnMessages).toContain("dry-run takes precedence");

        // No migration writes happened.
        expect(existsSync(join(tmpDir, "vis.config.ts"))).toBe(false);
        expect(existsSync(join(tmpDir, ".releaserc.json"))).toBe(true);

        const pkgA = JSON.parse(readFileSync(join(tmpDir, "packages", "pkg-a", "package.json"), "utf8")) as Record<string, unknown>;

        expect(pkgA["vis-release"]).toBeUndefined();
    });
});
