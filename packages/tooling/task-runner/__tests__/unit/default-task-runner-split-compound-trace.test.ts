import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { cleanEnvEssentialNames } from "../../src/child-env";
import { defaultTaskRunner } from "../../src/default-task-runner";
import { EmptyLifeCycle } from "../../src/life-cycle";
import type { ProjectGraph, Task, TaskGraph, TaskResults, TaskRunnerContext, TaskRunnerOptions } from "../../src/types";

/*
 * `hashMode: "trace"` segments. Each segment runs through the tracker on its
 * own command, so the tracker sees exactly the files that segment reads. The
 * traced path runs the command itself and never calls the task executor, so
 * executions are counted from the side effect of a real script: `step.cjs`
 * reads `input-<name>.txt` in the package and appends its name to a log kept
 * outside the workspace.
 */

const unusedExecutor = async (): Promise<never> => {
    throw new Error("a traced command runs through the tracker, not the task executor");
};

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `trace-split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const statusesOf = (results: TaskResults): Record<string, string | undefined> => Object.fromEntries([...results].map(([id, result]) => [id, result.status]));

interface RunOptions {
    /** Extra fields for the runner context. */
    context?: Partial<TaskRunnerContext>;
    /** Declared `inputs` of the target. Leave unset for a target without `inputs`. */
    inputs?: string[];
    /** Runner options for this run. */
    runner?: TaskRunnerOptions;
    /** Extra fields for the target task. */
    task?: Partial<Task>;
}

describe("defaultTaskRunner with splitCompound on a traced target", () => {
    let workspaceRoot: string;
    let logFile: string;
    let appDirectory: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        appDirectory = join(workspaceRoot, "packages/app");
        logFile = `${workspaceRoot}-runs.log`;

        await mkdir(appDirectory, { recursive: true });
        await writeFile(join(appDirectory, "package.json"), JSON.stringify({ name: "app" }));

        await Promise.all(["a", "b", "c"].map((name) => writeFile(join(appDirectory, `input-${name}.txt`), `${name}-1`)));

        // The script is a real Node process, so the tracker records what it reads.
        await writeFile(
            join(appDirectory, "step.cjs"),
            [
                `const { appendFileSync, readFileSync } = require("node:fs");`,
                `const name = process.argv[2];`,
                `const input = readFileSync(${JSON.stringify(appDirectory)} + "/input-" + name + ".txt", "utf8");`,
                String.raw`appendFileSync(${JSON.stringify(logFile)}, name + "\n");`,
                `const hints = process.env["TASK_RUNNER_HINTS"];`,
                `if (input.includes("nocache") && hints) {`,
                String.raw`    appendFileSync(hints, JSON.stringify({ op: "disableCache" }) + "\n");`,
                `}`,
                // Not `process.exit()`: an early exit drops the tracker's record of this process.
                `process.exitCode = input.includes("fail") ? 1 : 0;`,
                ``,
            ].join("\n"),
        );
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
        await rm(logFile, { force: true });
    });

    const readRuns = async (): Promise<string[]> => {
        try {
            const content = await readFile(logFile, "utf8");

            return content.split("\n").filter(Boolean);
        } catch {
            return [];
        }
    };

    const clearRuns = (): Promise<void> => rm(logFile, { force: true });

    const writeInput = (name: string, content: string): Promise<void> => writeFile(join(appDirectory, `input-${name}.txt`), content);

    const run = async (command: string, { context = {}, inputs, runner = {}, task: overrides = {} }: RunOptions = {}): Promise<TaskResults> => {
        const task: Task = {
            hashMode: "trace",
            id: "app:build",
            outputs: [],
            overrides: { command },
            projectRoot: "packages/app",
            splitCompound: true,
            target: { project: "app", target: "build" },
            ...(inputs === undefined ? {} : { declaresInputs: true }),
            ...overrides,
        };
        const projectGraph: ProjectGraph = {
            dependencies: { app: [] },
            nodes: {
                app: {
                    data: { root: "packages/app", targets: inputs === undefined ? {} : { build: { inputs } } },
                    name: "app",
                    type: "application",
                },
            },
        };
        const taskGraph: TaskGraph = { dependencies: { "app:build": [] }, roots: ["app:build"], tasks: { "app:build": task } };

        return defaultTaskRunner([task], runner, {
            lifeCycle: new EmptyLifeCycle(),
            projectGraph,
            taskExecutor: unusedExecutor,
            taskGraph,
            workspaceRoot,
            ...context,
        });
    };

    const threeSegments = "node step.cjs a && node step.cjs b && node step.cjs c";

    it("re-runs only the last segment when only its input changes, and serves a full hit with no execution", async () => {
        expect.assertions(8);

        await run(threeSegments);

        await expect(readRuns()).resolves.toStrictEqual(["a", "b", "c"]);

        await clearRuns();

        const unchanged = await run(threeSegments);

        await expect(readRuns()).resolves.toStrictEqual([]);
        expect(statusesOf(unchanged)).toStrictEqual({ "app:build#1": "local-cache", "app:build#2": "local-cache", "app:build#3": "local-cache" });

        await writeInput("c", "c-2");
        await clearRuns();

        const changed = await run(threeSegments);

        await expect(readRuns()).resolves.toStrictEqual(["c"]);
        expect(changed.get("app:build#1")?.status).toBe("local-cache");
        expect(changed.get("app:build#2")?.status).toBe("local-cache");
        expect(changed.get("app:build#3")?.status).toBe("success");
        expect(changed.get("app:build#2")?.cacheMissReasons).toBeUndefined();
    });

    it("re-runs every segment when only the first segment's input changes, though the later inputs are unchanged", async () => {
        expect.assertions(4);

        await run(threeSegments);
        await writeInput("a", "a-2");
        await clearRuns();

        const changed = await run(threeSegments);

        // Segments two and three read only their own files, which did not change. They re-run because
        // each one's trace key folds in the key of the segment before it, and that key moved.
        await expect(readRuns()).resolves.toStrictEqual(["a", "b", "c"]);
        expect(statusesOf(changed)).toStrictEqual({ "app:build#1": "success", "app:build#2": "success", "app:build#3": "success" });
        expect(changed.get("app:build#2")?.cacheMissReasons).toStrictEqual([expect.objectContaining({ type: "chain-changed" })]);

        await clearRuns();
        await run(threeSegments);

        await expect(readRuns()).resolves.toStrictEqual([]);
    });

    it("stops the chain at a failing middle segment, and the segments after it are neither run nor cached", async () => {
        expect.assertions(3);

        await writeInput("b", "fail");

        const failing = await run(threeSegments);

        expect(statusesOf(failing)).toStrictEqual({ "app:build#1": "success", "app:build#2": "failure", "app:build#3": "skipped" });
        await expect(readRuns()).resolves.toStrictEqual(["a", "b"]);

        await writeInput("b", "b-1");
        await clearRuns();

        // Segment one is served from cache. Segment three was never cached, so it runs.
        await run(threeSegments);

        await expect(readRuns()).resolves.toStrictEqual(["b", "c"]);
    });

    // `true` is a POSIX builtin. cmd.exe has none, so the two tests that rely on it are POSIX-only.
    it.skipIf(process.platform === "win32")("falls back to the declared hash for a segment whose tracker saw nothing, and chains the segment after it on that hash", async () => {
        expect.assertions(6);

        // `true` reads no workspace file, so the tracker observes nothing for it.
        const command = "node step.cjs a && true && node step.cjs c";

        await run(command, { inputs: ["{projectRoot}/input-b.txt"] });
        await clearRuns();

        const hit = await run(command, { inputs: ["{projectRoot}/input-b.txt"] });

        await expect(readRuns()).resolves.toStrictEqual([]);
        expect(hit.get("app:build#2")?.hashSource).toBe("declared-fallback");
        expect(statusesOf(hit)).toStrictEqual({ "app:build#1": "local-cache", "app:build#2": "local-cache", "app:build#3": "local-cache" });

        // The declared input changed, so the fallback key moved and the segment after it re-runs.
        await writeInput("b", "b-2");
        await clearRuns();

        const changed = await run(command, { inputs: ["{projectRoot}/input-b.txt"] });

        await expect(readRuns()).resolves.toStrictEqual(["c"]);
        expect(changed.get("app:build#2")?.status).toBe("success");
        expect(changed.get("app:build#3")?.status).toBe("success");
    });

    it.skipIf(process.platform === "win32")("never serves a segment whose tracker saw nothing and which declares no inputs, so the segment after it cannot be keyed", async () => {
        expect.assertions(4);

        const command = "node step.cjs a && true && node step.cjs c";

        await run(command);
        await clearRuns();

        const second = await run(command);

        // Segment one hits. The empty segment has no key, so segment three is neither served nor stored.
        expect(statusesOf(second)).toStrictEqual({ "app:build#1": "local-cache", "app:build#2": "success", "app:build#3": "success" });
        expect(second.get("app:build#2")?.hashSource).toBeUndefined();
        await expect(readRuns()).resolves.toStrictEqual(["c"]);

        await clearRuns();
        await run(command);

        await expect(readRuns()).resolves.toStrictEqual(["c"]);
    });

    it("leaves a traced command with an unsupported construct whole, and still caches it as one task", async () => {
        expect.assertions(4);

        const diagnostics: string[] = [];

        await run("cd . && node step.cjs a", { runner: { onDiagnostic: (_id, message) => diagnostics.push(message) } });

        expect(diagnostics).toStrictEqual([expect.stringContaining("`cd`")]);
        await expect(readRuns()).resolves.toStrictEqual(["a"]);

        await clearRuns();

        const second = await run("cd . && node step.cjs a");

        expect(statusesOf(second)).toStrictEqual({ "app:build": "local-cache" });
        await expect(readRuns()).resolves.toStrictEqual([]);
    });

    it("keeps the chain when the run uses global auto-fingerprinting", async () => {
        expect.assertions(3);

        const results = await run(threeSegments, { runner: { autoFingerprint: true } });

        expect([...results.keys()]).toStrictEqual(["app:build#1", "app:build#2", "app:build#3"]);

        await clearRuns();
        await run(threeSegments, { runner: { autoFingerprint: true } });

        await expect(readRuns()).resolves.toStrictEqual([]);

        await writeInput("a", "a-2");
        await clearRuns();
        await run(threeSegments, { runner: { autoFingerprint: true } });

        await expect(readRuns()).resolves.toStrictEqual(["a", "b", "c"]);
    });

    it("re-runs only the segment whose stored tracker differs, and the segment after it still hits", async () => {
        expect.assertions(3);

        await run(threeSegments);

        // Replant segment two's entry under the other tracker kind, keeping its file hashes valid.
        const cache = new Cache({ workspaceRoot });
        const stored = await cache.getByTaskId("app:build#2");
        const otherTracker = stored?.fingerprint?.tracker === "preload" ? "interpose" : "preload";

        await cache.put("other-tracker-key", stored!.terminalOutput, [], stored!.code, { ...stored!.fingerprint!, tracker: otherTracker });
        await cache.setTaskIndex("app:build#2", "other-tracker-key");

        await clearRuns();

        const results = await run(threeSegments);

        expect(results.get("app:build#2")?.cacheMissReasons).toStrictEqual([expect.objectContaining({ type: "tracker-changed" })]);
        expect(statusesOf(results)).toStrictEqual({ "app:build#1": "local-cache", "app:build#2": "success", "app:build#3": "local-cache" });
        await expect(readRuns()).resolves.toStrictEqual(["b"]);
    });

    it("refuses a segment that fails the strict-env check before it spawns, and runs nothing after it", async () => {
        expect.assertions(3);

        let strictEnvFailure = true;
        const preTraceCheck = (task: Task): string | undefined => strictEnvFailure && String(task.overrides["command"]).includes("step.cjs b") ? "strict env: BAR is not set" : undefined;

        const failing = await run(threeSegments, { context: { preTraceCheck } });

        expect(statusesOf(failing)).toStrictEqual({ "app:build#1": "success", "app:build#2": "failure", "app:build#3": "skipped" });
        expect(failing.get("app:build#2")?.terminalOutput).toContain("strict env: BAR is not set");

        // Once the variable is set, segment two runs and is cached. Segment three was never cached, so it runs too.
        strictEnvFailure = false;
        await clearRuns();

        await run(threeSegments, { context: { preTraceCheck } });

        await expect(readRuns()).resolves.toStrictEqual(["b", "c"]);
    });

    it("keys each segment on the child environment it receives, not the parent's", async () => {
        expect.assertions(2);

        let flag = "one";
        // The platform's essential names (PATH, and SystemRoot on Windows, without which node will not start).
        const essentials = Object.fromEntries(cleanEnvEssentialNames().flatMap((name) => (process.env[name] === undefined ? [] : [[name, process.env[name]]])));
        const context = {
            // Clean child environment: the children see only the essentials and the flag, so the flag is what the key reads.
            resolveChildEnv: () => { return { env: { ...essentials, CHILD_FLAG: flag }, inheritEnv: false }; },
        };
        const task = { fingerprintEnv: ["CHILD_FLAG"] };

        await run(threeSegments, { context, task });
        await clearRuns();

        await run(threeSegments, { context, task });

        await expect(readRuns()).resolves.toStrictEqual([]);

        // The child's value changed, so every segment re-runs, the first one included.
        flag = "two";
        await clearRuns();

        await run(threeSegments, { context, task });

        await expect(readRuns()).resolves.toStrictEqual(["a", "b", "c"]);
    });

    it("does not cache a segment that asks not to be cached, nor the segment after it", async () => {
        expect.assertions(5);

        await writeInput("b", "nocache");

        const first = await run(threeSegments);

        expect(first.get("app:build#2")?.cacheDisabledByTask).toBe(true);

        await clearRuns();

        const second = await run(threeSegments);

        // Segment one is cached. Segment two asked not to be, and segment three has no key to chain on.
        await expect(readRuns()).resolves.toStrictEqual(["b", "c"]);
        expect(statusesOf(second)).toStrictEqual({ "app:build#1": "local-cache", "app:build#2": "success", "app:build#3": "success" });
        expect(second.get("app:build#2")?.cacheDisabledByTask).toBe(true);
        await expect(new Cache({ workspaceRoot }).getByTaskId("app:build#3")).resolves.toBeUndefined();
    });
});
