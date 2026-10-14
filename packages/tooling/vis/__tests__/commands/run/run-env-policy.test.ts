import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import runExecute from "../../../src/commands/run/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../test-helpers";

const logger = { debug: () => undefined, error: () => undefined, info: () => undefined, warn: () => undefined };

// The workspace has one package with several targets. Each target has its own
// per-target `options.env`, so one fixture exercises the workspace policy and
// the per-target override in the same run.
const PARENT_VAR = "G2_VIS_UNRELATED";
const ALLOWED_VAR = "G2_VIS_ALLOWED";
const HIDDEN_VAR = "G2_VIS_HIDDEN";

const seedWorkspace = (workspaceRoot: string, envOut: string, countFile: string, tracedCountFile: string): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify({ name: "root" }));

    const packageDir = join(workspaceRoot, "packages", "app");

    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: "@my/app" }));
    writeFileSync(join(packageDir, ".env.test"), "G2_FROM_ENVFILE=file-value\n");

    // The child writes its whole environment to `envOut`, so the assertions read
    // what the real spawned process received.
    writeFileSync(join(packageDir, "dump.cjs"), `require("node:fs").writeFileSync(${JSON.stringify(envOut)}, JSON.stringify(process.env));\n`);
    // A cached target counts its own runs, so a cache hit leaves the count unchanged.
    writeFileSync(join(packageDir, "count.cjs"), `require("node:fs").appendFileSync(${JSON.stringify(countFile)}, "x");\n`);
    // A traced counter that writes outside the workspace, so the tracker does not see it as a self-modified input.
    // It reads its own source, which the tracker records as a workspace input, and counts outside the workspace.
    writeFileSync(join(packageDir, "count-traced.cjs"), `const fs = require("node:fs");\nfs.readFileSync(__filename);\nfs.appendFileSync(${JSON.stringify(tracedCountFile)}, "x");\n`);

    writeFileSync(
        join(packageDir, "project.json"),
        JSON.stringify({
            targets: {
                // A declared task argument, which must reach the clean child as VIS_ARG_MODE.
                argd: {
                    arguments: [{ choices: ["dev", "prod"], name: "mode", required: true, type: "enum" }],
                    command: "node dump.cjs",
                    outputs: [],
                },
                // Default policy: the workspace decides. Also loads an envFile.
                build: { command: "node dump.cjs", options: { envFile: ".env.test" }, outputs: [] },
                // Cached target keyed on the VIS_* names it can see.
                keyed: { cache: true, command: "node count.cjs", fingerprintEnv: ["G2_VIS_*"], outputs: [] },
                // The same keying, but the clean policy comes from this target in an inherit workspace.
                "keyed-scoped": {
                    cache: true,
                    command: "node count.cjs",
                    fingerprintEnv: ["G2_VIS_*"],
                    options: { env: { allow: [ALLOWED_VAR], mode: "clean" } },
                    outputs: [],
                },
                // Per-target opt-out of a clean workspace.
                open: { command: "node dump.cjs", options: { env: { mode: "inherit" } }, outputs: [] },
                // Per-target clean with an allow-list, in an inherit workspace.
                scoped: { command: "node dump.cjs", options: { env: { allow: [ALLOWED_VAR], mode: "clean" } }, outputs: [] },
                // A persistent target runs through its own spawn path, not the executor.
                serve: { command: "node dump.cjs", options: { envFile: ".env.test", persistent: true }, outputs: [] },
                // A strict target: the command references a variable the clean child cannot see.
                strict: {
                    command: `node dump.cjs && echo $${PARENT_VAR}`,
                    options: { strictEnv: true },
                    outputs: [],
                },
                // Traced hashing: the tracker runs the command, so it gets the same environment as an executor run.
                traced: { command: "node dump.cjs", hashMode: "trace", options: { envFile: ".env.test" }, outputs: [] },
                // Traced and clean, keyed on the names its child can see.
                "traced-keyed": {
                    cache: true,
                    command: "node count-traced.cjs",
                    fingerprintEnv: ["G2_VIS_*"],
                    hashMode: "trace",
                    options: { env: { allow: [ALLOWED_VAR], mode: "clean" } },
                    outputs: [],
                },
            },
        }),
    );
};

describe("vis run taskRunner.env and options.env are forwarded to the spawned child", () => {
    let workspaceRoot: string;
    let envOut: string;
    let countFile: string;
    let tracedCountFile: string;
    const saved = { ...process.env };

    const readEnv = (): Record<string, string> => JSON.parse(readFileSync(envOut, "utf8")) as Record<string, string>;

    // Traced targets are only tracked when the run is cached, so their tests opt in.
    const cachedOptions = (): Record<string, unknown> => { return { cache: true, cacheDir: join(workspaceRoot, ".cache") }; };

    // How many times the traced counter ran; a cache hit adds nothing.
    const tracedRuns = (): number => {
        try {
            return readFileSync(tracedCountFile, "utf8").length;
        } catch {
            return 0;
        }
    };

    // How many times the cached target actually ran; a cache hit adds nothing.
    const count = (): number => {
        try {
            return readFileSync(countFile, "utf8").length;
        } catch {
            return 0;
        }
    };

    const run = async (argument: string[], visConfig: unknown, options: Record<string, unknown> = {}): Promise<void> => {
        rmSync(envOut, { force: true });

        await runExecute({
            argument,
            logger,
            options: { cache: false, parallel: 1, preflight: false, skipToolchain: true, ...options },
            runtime: {} as never,
            visConfig,
            workspaceRoot,
        } as never);
    };

    beforeEach(() => {
        // The tracker reports real paths, so the workspace must be too (macOS temp dirs are symlinks).
        workspaceRoot = realpathSync(createTemporaryDirectory("vis-run-env-policy-"));
        envOut = join(workspaceRoot, "child-env.json");
        countFile = join(workspaceRoot, "count.txt");
        tracedCountFile = join(createTemporaryDirectory("vis-run-traced-count-"), "count.txt");
        seedWorkspace(workspaceRoot, envOut, countFile, tracedCountFile);

        process.env[PARENT_VAR] = "parent";
        process.env[ALLOWED_VAR] = "allowed";
        process.env[HIDDEN_VAR] = "1";
    });

    afterEach(() => {
        process.env = { ...saved };
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("default config keeps the whole parent environment", async () => {
        expect.assertions(2);

        await run(["build"], undefined);

        const env = readEnv();

        expect(env[PARENT_VAR]).toBe("parent");
        expect(env["G2_FROM_ENVFILE"]).toBe("file-value");
    });

    it("a clean workspace strips the parent variable but keeps what vis injects", async () => {
        expect.assertions(5);

        await run(["build"], { taskRunner: { env: { mode: "clean" } } });

        const env = readEnv();

        expect(env).not.toHaveProperty(PARENT_VAR);
        // vis injects these on every task child; clean mode must keep them.
        expect(env["VIS_TASK_SLOTS"]).toBe("1");
        expect(env["INIT_CWD"]).toBeDefined();
        expect(env["G2_FROM_ENVFILE"]).toBe("file-value");
        // Windows keeps the variable as `Path`, so match the name without case.
        expect(Object.keys(env).some((key) => key.toUpperCase() === "PATH")).toBe(true);
    });

    it("applies the same clean policy to a persistent target", async () => {
        expect.assertions(3);

        await run(["serve"], { taskRunner: { env: { mode: "clean" } } });

        const env = readEnv();

        expect(env).not.toHaveProperty(PARENT_VAR);
        expect(env["G2_FROM_ENVFILE"]).toBe("file-value");
        expect(env["INIT_CWD"]).toBeDefined();
    });

    it("gives a persistent target VIS_TASK_SLOTS under the default inherit policy", async () => {
        expect.assertions(2);

        await run(["serve"], undefined);

        const env = readEnv();

        expect(env["VIS_TASK_SLOTS"]).toBe("1");
        expect(env["INIT_CWD"]).toBeDefined();
    });

    it("a workspace allow-list keeps a named variable under a clean workspace", async () => {
        expect.assertions(2);

        await run(["build"], { taskRunner: { env: { allow: [ALLOWED_VAR], mode: "clean" } } });

        const env = readEnv();

        expect(env[ALLOWED_VAR]).toBe("allowed");
        expect(env).not.toHaveProperty(PARENT_VAR);
    });

    it("a per-target inherit overrides a clean workspace", async () => {
        expect.assertions(2);

        const visConfig = { taskRunner: { env: { mode: "clean" } } };

        await run(["open"], visConfig);

        expect(readEnv()[PARENT_VAR]).toBe("parent");

        await run(["build"], visConfig);

        expect(readEnv()).not.toHaveProperty(PARENT_VAR);
    });

    it("a per-target clean with an allow-list applies to that target only", async () => {
        expect.assertions(4);

        // Inherit workspace (default): only `scoped` is clean.
        await run(["scoped"], undefined);

        const scoped = readEnv();

        expect(scoped[ALLOWED_VAR]).toBe("allowed");
        expect(scoped).not.toHaveProperty(PARENT_VAR);

        await run(["build"], undefined);

        expect(readEnv()[PARENT_VAR]).toBe("parent");
        expect(readEnv()[ALLOWED_VAR]).toBe("allowed");
    });

    it("keeps VIS_ARG_* task arguments under clean mode", async () => {
        expect.assertions(2);

        await run(["argd", "--mode=prod"], { taskRunner: { env: { mode: "clean" } } });

        const env = readEnv();

        expect(env["VIS_ARG_MODE"]).toBe("prod");
        expect(env).not.toHaveProperty(PARENT_VAR);
    });

    it("fails a strict target that references a variable the clean child cannot see", async () => {
        expect.assertions(2);

        await run(["strict"], { taskRunner: { env: { mode: "clean" } } }).catch(() => undefined);

        // The strict check runs before spawn, so the command never ran.
        expect(existsSync(envOut)).toBe(false);

        // Under inherit the same reference is set, so the command runs.
        await run(["strict"], undefined).catch(() => undefined);

        expect(existsSync(envOut)).toBe(true);
    });

    it("gives a clean traced target the clean environment, vis variables and the tracker's own", async () => {
        expect.assertions(5);

        await run(["traced"], { taskRunner: { env: { mode: "clean" } } }, cachedOptions());

        const env = readEnv();

        expect(env).not.toHaveProperty(PARENT_VAR);
        expect(env["VIS_TASK_SLOTS"]).toBe("1");
        expect(env["INIT_CWD"]).toBeDefined();
        expect(env["G2_FROM_ENVFILE"]).toBe("file-value");
        // The tracker writes its hints path into the child, so the run went through it.
        expect(env["TASK_RUNNER_HINTS"]).toBeDefined();
    });

    it("gives a traced target the vis variables under the default inherit policy", async () => {
        expect.assertions(5);

        await run(["traced"], undefined, cachedOptions());

        const env = readEnv();

        expect(env[PARENT_VAR]).toBe("parent");
        expect(env["VIS_TASK_SLOTS"]).toBe("1");
        expect(env["INIT_CWD"]).toBeDefined();
        expect(env["G2_FROM_ENVFILE"]).toBe("file-value");
        expect(env["TASK_RUNNER_HINTS"]).toBeDefined();
    });

    it("keys a clean traced target on the names its child can see", async () => {
        expect.assertions(3);

        const cached = cachedOptions();
        const visConfig = undefined;

        await run(["traced-keyed"], visConfig, cached);

        expect(tracedRuns()).toBe(1);

        // HIDDEN is not visible to the clean child, so the traced key does not change.
        process.env[HIDDEN_VAR] = "2";
        await run(["traced-keyed"], visConfig, cached);

        expect(tracedRuns()).toBe(1);

        // ALLOWED is visible and matches `G2_VIS_*`: the traced key changes.
        process.env[ALLOWED_VAR] = "changed";
        await run(["traced-keyed"], visConfig, cached);

        expect(tracedRuns()).toBe(2);
    });

    it("keys the cache on the clean child's visible names only", async () => {
        expect.assertions(3);

        const visConfig = { taskRunner: { env: { allow: [ALLOWED_VAR], mode: "clean" } } };
        const cached = { cache: true, cacheDir: join(workspaceRoot, ".cache") };

        await run(["keyed"], visConfig, cached);

        expect(count()).toBe(1);

        // HIDDEN is not allow-listed, so the child never sees it: a cache hit.
        process.env[HIDDEN_VAR] = "2";
        await run(["keyed"], visConfig, cached);

        expect(count()).toBe(1);

        // ALLOWED is visible to the child and matches `G2_VIS_*`: a miss.
        process.env[ALLOWED_VAR] = "changed";
        await run(["keyed"], visConfig, cached);

        expect(count()).toBe(2);
    });

    it("keys a target with its own clean policy on that target's visible names", async () => {
        expect.assertions(3);

        // No workspace policy: only this target is clean. Its child cannot see HIDDEN.
        const cached = { cache: true, cacheDir: join(workspaceRoot, ".cache") };

        await run(["keyed-scoped"], undefined, cached);

        expect(count()).toBe(1);

        process.env[HIDDEN_VAR] = "2";
        await run(["keyed-scoped"], undefined, cached);

        expect(count()).toBe(1);

        process.env[ALLOWED_VAR] = "changed";
        await run(["keyed-scoped"], undefined, cached);

        expect(count()).toBe(2);
    });
});
