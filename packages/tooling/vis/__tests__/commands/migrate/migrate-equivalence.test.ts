import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    buildSourceModel,
    buildVisModel,
    detectSourceTool,
    diffModels,
    equivalenceExitCode,
    formatEquivalenceReport,
} from "../../../src/commands/migrate/equivalence";
import { migrateVerifyGraphExecute } from "../../../src/commands/migrate/handler";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

const writeJson = (dir: string, name: string, value: unknown): void => {
    writeFileSync(join(dir, name), JSON.stringify(value));
};

const writeVisConfig = (dir: string, config: Record<string, unknown>): void => {
    writeFileSync(join(dir, "vis.config.mjs"), `export default ${JSON.stringify(config)};`);
};

describe("migrate verify-graph equivalence", () => {
    let tmp: string;

    beforeEach(() => {
        tmp = createTemporaryDirectory("vis-equiv-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmp);
    });

    describe("source parsers", () => {
        it("normalizes turbo dependsOn into canonical edge tokens", () => {
            expect.assertions(2);

            writeJson(tmp, "turbo.json", {
                tasks: {
                    build: { dependsOn: ["^build"], inputs: ["src/**"], outputs: ["dist/**"] },
                    test: { cache: false, dependsOn: ["build", "ui#build"] },
                },
            });

            const model = buildSourceModel(tmp, "turbo");

            expect(model.get("*#build")).toStrictEqual({
                cache: undefined,
                dependsOn: ["^build"],
                env: [],
                id: "*#build",
                inputs: ["src/**"],
                outputs: ["dist/**"],
            });
            expect(model.get("*#test")?.dependsOn).toStrictEqual(["build", "ui#build"]);
        });

        it("folds turbo global env/deps into a synthetic global node", () => {
            expect.assertions(1);

            writeJson(tmp, "turbo.json", {
                globalDependencies: ["tsconfig.json"],
                globalEnv: ["CI"],
                tasks: { build: {} },
            });

            expect(buildSourceModel(tmp, "turbo").get("__global__")).toMatchObject({
                env: ["CI"],
                inputs: ["tsconfig.json"],
            });
        });

        it("parses nx targetDefaults and per-project project.json", () => {
            expect.assertions(2);

            writeJson(tmp, "nx.json", { targetDefaults: { build: { cache: true, dependsOn: ["^build"] } } });
            const pkgDir = join(tmp, "packages", "ui");

            mkdirSync(pkgDir, { recursive: true });
            writeJson(pkgDir, "project.json", { name: "ui", targets: { test: { inputs: ["src/**"] } } });

            const model = buildSourceModel(tmp, "nx");

            expect(model.get("*#build")).toMatchObject({ cache: true, dependsOn: ["^build"] });
            expect(model.get("ui#test")?.inputs).toStrictEqual(["src/**"]);
        });

        it("parses moon root tasks with ^:/~: dep syntax", () => {
            expect.assertions(1);

            mkdirSync(join(tmp, ".moon"), { recursive: true });
            writeFileSync(join(tmp, ".moon", "tasks.yml"), ["tasks:", "  build:", "    deps:", "      - ^:build", "      - ~:codegen"].join("\n"));

            expect(buildSourceModel(tmp, "moon").get("*#build")?.dependsOn).toStrictEqual(["^build", "codegen"]);
        });
    });

    describe("vis model", () => {
        it("reads tasks + taskRunner globals through loadVisConfig", async () => {
            expect.assertions(2);

            writeVisConfig(tmp, {
                taskRunner: { globalEnv: ["CI"], globalInputs: ["tsconfig.json"] },
                tasks: { build: { dependsOn: [{ dependencies: true, target: "build" }], inputs: ["src/**"] } },
            });

            const model = await buildVisModel(tmp);

            expect(model.get("*#build")?.dependsOn).toStrictEqual(["^build"]);
            expect(model.get("__global__")).toMatchObject({ env: ["CI"], inputs: ["tsconfig.json"] });
        });
    });

    describe(diffModels, () => {
        it("reports zero findings when the migration is faithful", async () => {
            expect.assertions(2);

            writeJson(tmp, "turbo.json", {
                globalEnv: ["CI"],
                tasks: { build: { dependsOn: ["^build"], inputs: ["src/**"], outputs: ["dist/**"] } },
            });
            writeVisConfig(tmp, {
                taskRunner: { globalEnv: ["CI"] },
                tasks: { build: { dependsOn: [{ dependencies: true, target: "build" }], inputs: ["src/**"], outputs: ["dist/**"] } },
            });

            const report = diffModels(buildSourceModel(tmp, "turbo"), await buildVisModel(tmp), "turbo");

            expect(report.findings).toStrictEqual([]);
            expect(equivalenceExitCode(report, "error")).toBe(0);
        });

        it("flags a dropped target, changed edges and a flipped cache flag as errors", async () => {
            expect.assertions(4);

            writeJson(tmp, "turbo.json", {
                tasks: {
                    build: { dependsOn: ["^build"], inputs: ["src/**"] },
                    lint: { cache: false },
                },
            });
            // Migration dropped `lint`, narrowed `build` inputs, and lost the `^build` edge.
            writeVisConfig(tmp, { tasks: { build: { inputs: [] } } });

            const report = diffModels(buildSourceModel(tmp, "turbo"), await buildVisModel(tmp), "turbo");
            const axes = report.findings.filter((f) => f.severity === "error").map((f) => `${f.node}:${f.axis}`);

            expect(axes).toContain("*#lint:target-set");
            expect(axes).toContain("*#build:dependsOn");
            expect(axes).toContain("*#build:inputs");
            expect(equivalenceExitCode(report, "error")).toBe(1);
        });

        it("treats turbo project#task skipped-by-design as a non-fatal warning", async () => {
            expect.assertions(3);

            writeJson(tmp, "turbo.json", { tasks: { build: {}, "ui#build": { outputs: ["dist/**"] } } });
            writeVisConfig(tmp, { tasks: { build: {} } });

            const report = diffModels(buildSourceModel(tmp, "turbo"), await buildVisModel(tmp), "turbo");
            const finding = report.findings.find((f) => f.node === "ui#build");

            expect(finding?.severity).toBe("warning");
            expect(finding?.detail).toContain("skipped by design");
            expect(equivalenceExitCode(report, "error")).toBe(0);
        });

        it("gates warnings only when --fail-on=warning", async () => {
            expect.assertions(2);

            writeJson(tmp, "turbo.json", { tasks: { build: {} } });
            writeVisConfig(tmp, { tasks: { build: {}, extra: {} } });

            const report = diffModels(buildSourceModel(tmp, "turbo"), await buildVisModel(tmp), "turbo");

            expect(equivalenceExitCode(report, "error")).toBe(0);
            expect(equivalenceExitCode(report, "warning")).toBe(1);
        });
    });

    describe("formatEquivalenceReport (Axis A)", () => {
        it("emits byte-stable JSON to stdout across runs", () => {
            expect.assertions(1);

            const report = {
                findings: [
                    { axis: "inputs" as const, detail: "b", node: "*#b", severity: "error" as const },
                    { axis: "dependsOn" as const, detail: "a", node: "*#a", severity: "warning" as const },
                ],
                source: "turbo" as const,
                sourceNodeCount: 2,
                visNodeCount: 2,
            };
            const logger = createMockLogger();
            const writes: string[] = [];
            const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
                writes.push(String(chunk));

                return true;
            });

            formatEquivalenceReport(report, "json", logger);
            formatEquivalenceReport(report, "json", logger);
            spy.mockRestore();

            expect(writes[0]).toBe(writes[1]);
        });
    });

    describe(detectSourceTool, () => {
        it("auto-detects the single present tool, undefined when ambiguous", () => {
            expect.assertions(2);

            writeJson(tmp, "turbo.json", { tasks: {} });

            expect(detectSourceTool(tmp)).toBe("turbo");

            writeJson(tmp, "nx.json", {});

            expect(detectSourceTool(tmp)).toBeUndefined();
        });
    });

    describe("source parser edge cases", () => {
        it("canonicalizes a moon cross-project `project:build` dep into `project#build`", () => {
            expect.assertions(1);

            mkdirSync(join(tmp, ".moon"), { recursive: true });
            writeFileSync(join(tmp, ".moon", "tasks.yml"), ["tasks:", "  build:", "    deps:", "      - ui:build"].join("\n"));

            expect(buildSourceModel(tmp, "moon").get("*#build")?.dependsOn).toStrictEqual(["ui#build"]);
        });

        it("returns an empty model when turbo.json is malformed JSON instead of throwing", () => {
            expect.assertions(1);

            writeFileSync(join(tmp, "turbo.json"), "{ this is not json");

            expect(buildSourceModel(tmp, "turbo").size).toBe(0);
        });

        it("returns an empty model when .moon/tasks.yml is malformed YAML", () => {
            expect.assertions(1);

            mkdirSync(join(tmp, ".moon"), { recursive: true });
            writeFileSync(join(tmp, ".moon", "tasks.yml"), "tasks:\n  build:\n - : : :\n");

            expect(buildSourceModel(tmp, "moon").size).toBe(0);
        });
    });
});

describe("migrateVerifyGraphExecute (handler guards)", () => {
    let tmp: string;
    let savedExitCode: typeof process.exitCode;
    let stdoutSpy: ReturnType<typeof vi.spyOn>;

    const run = async (options: Record<string, unknown>): Promise<ReturnType<typeof createMockLogger>> => {
        const logger = createMockLogger();

        await (migrateVerifyGraphExecute as unknown as (toolbox: unknown) => Promise<void>)({ logger, options, workspaceRoot: tmp });

        return logger;
    };

    beforeEach(() => {
        tmp = createTemporaryDirectory("vis-equiv-handler-");
        savedExitCode = process.exitCode;
        process.exitCode = undefined;
        stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
        stdoutSpy.mockRestore();
        process.exitCode = savedExitCode;
        cleanupTemporaryDirectory(tmp);
    });

    it("rejects an invalid --format with exit code 1 and a warning", async () => {
        expect.assertions(2);

        const logger = await run({ format: "yaml" });

        expect(process.exitCode).toBe(1);
        expect(logger.warnMessages.some((m) => m.includes("Invalid --format"))).toBe(true);
    });

    it("rejects an invalid --from with exit code 1 and a warning", async () => {
        expect.assertions(2);

        const logger = await run({ from: "gradle" });

        expect(process.exitCode).toBe(1);
        expect(logger.warnMessages.some((m) => m.includes("Invalid --from"))).toBe(true);
    });

    it("warns when the source tool cannot be auto-detected", async () => {
        expect.assertions(2);

        const logger = await run({});

        expect(process.exitCode).toBe(1);
        expect(logger.warnMessages.some((m) => m.includes("Could not auto-detect"))).toBe(true);
    });

    it("warns when the source tool yields an empty task graph", async () => {
        expect.assertions(2);

        writeJson(tmp, "turbo.json", { tasks: {} });

        const logger = await run({ from: "turbo" });

        expect(process.exitCode).toBe(1);
        expect(logger.warnMessages.some((m) => m.includes("No turbo task graph found"))).toBe(true);
    });

    it("warns when no migrated vis task graph exists", async () => {
        expect.assertions(2);

        writeJson(tmp, "turbo.json", { tasks: { build: { dependsOn: ["^build"] } } });

        const logger = await run({ from: "turbo" });

        expect(process.exitCode).toBe(1);
        expect(logger.warnMessages.some((m) => m.includes("No migrated vis task graph"))).toBe(true);
    });

    it("exits 0 on a faithful migration and emits json to stdout", async () => {
        expect.assertions(2);

        writeJson(tmp, "turbo.json", { tasks: { build: { dependsOn: ["^build"], inputs: ["src/**"] } } });
        writeVisConfig(tmp, { tasks: { build: { dependsOn: [{ dependencies: true, target: "build" }], inputs: ["src/**"] } } });

        await run({ format: "json", from: "turbo" });

        expect(process.exitCode).toBe(0);
        expect(stdoutSpy.mock.calls.length).toBeGreaterThan(0);
    });

    it("gates a purely additive divergence only under --fail-on=warning", async () => {
        expect.assertions(2);

        writeJson(tmp, "turbo.json", { tasks: { build: {} } });
        writeVisConfig(tmp, { tasks: { build: {}, extra: {} } });

        await run({ failOn: "warning", format: "json", from: "turbo" });

        expect(process.exitCode).toBe(1);

        process.exitCode = undefined;
        await run({ failOn: "error", format: "json", from: "turbo" });

        expect(process.exitCode).toBe(0);
    });
});
