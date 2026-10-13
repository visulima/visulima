import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultTaskRunner } from "../../src/default-task-runner";
import { EmptyLifeCycle } from "../../src/life-cycle";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph, TaskRunnerContext, TaskRunnerOptions, TaskStatus } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `split-compound-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const projectGraph: ProjectGraph = {
    dependencies: { app: [] },
    nodes: {
        app: {
            data: { root: "packages/app" },
            name: "app",
            type: "application",
        },
    },
};

const makeBuildTask = (command: string, overrides: Partial<Task> = {}): Task => {
    return {
        id: "app:build",
        outputs: [],
        overrides: { command },
        projectRoot: "packages/app",
        splitCompound: true,
        target: { project: "app", target: "build" },
        ...overrides,
    };
};

const createContext = (workspaceRoot: string, tasks: Task[], executor: TaskExecutor, lifeCycle?: LifeCycleInterface): TaskRunnerContext => {
    const taskGraph: TaskGraph = {
        dependencies: Object.fromEntries(tasks.map((task) => [task.id, []])),
        roots: tasks.map((task) => task.id),
        tasks: Object.fromEntries(tasks.map((task) => [task.id, task])),
    };

    return {
        lifeCycle: lifeCycle ?? new EmptyLifeCycle(),
        projectGraph,
        taskExecutor: executor,
        taskGraph,
        workspaceRoot,
    };
};

/**
 * Counts every real execution by task id and runs each segment as a fake
 * command: the text `FAIL` makes the segment exit 1, anything else exits 0.
 */
const createCountingExecutor = (): { executed: string[]; executor: TaskExecutor } => {
    const executed: string[] = [];

    return {
        executed,
        executor: async (task) => {
            const command = String(task.overrides["command"]);

            executed.push(task.id);

            return command.includes("FAIL") ? { code: 1, terminalOutput: `failed ${command}` } : { code: 0, terminalOutput: `ran ${command}` };
        },
    };
};

describe("defaultTaskRunner with splitCompound", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
        await writeFile(join(workspaceRoot, "packages/app/package.json"), JSON.stringify({ name: "app" }));
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const runCommand = async (
        command: string,
        counter: ReturnType<typeof createCountingExecutor>,
        options: TaskRunnerOptions = {},
        lifeCycle?: LifeCycleInterface,
    ): Promise<Map<string, { status: TaskStatus | undefined }>> => {
        const task = makeBuildTask(command);
        const context = createContext(workspaceRoot, [task], counter.executor, lifeCycle);
        const results = await defaultTaskRunner([task], options, context);

        return new Map([...results].map(([id, result]) => [id, { status: result.status }]));
    };

    it("re-runs only the last segment when only the last segment changes", async () => {
        expect.assertions(4);

        const counter = createCountingExecutor();

        await runCommand("step-one && step-two && step-three", counter);

        expect(counter.executed).toStrictEqual(["app:build#1", "app:build#2", "app:build#3"]);

        await runCommand("step-one && step-two && step-three", counter);

        expect(counter.executed).toHaveLength(3);

        counter.executed.length = 0;

        const results = await runCommand("step-one && step-two && step-three-changed", counter);

        expect(counter.executed).toStrictEqual(["app:build#3"]);
        expect(results.get("app:build#1")?.status).toBe("local-cache");
    });

    it("re-runs every segment when the first segment changes", async () => {
        expect.assertions(2);

        const counter = createCountingExecutor();

        await runCommand("step-one && step-two && step-three", counter);
        counter.executed.length = 0;

        await runCommand("step-one-changed && step-two && step-three", counter);

        expect(counter.executed).toStrictEqual(["app:build#1", "app:build#2", "app:build#3"]);

        counter.executed.length = 0;

        // The chain stays cached per segment: a rerun of the same new command is a full hit.
        await runCommand("step-one-changed && step-two && step-three", counter);

        expect(counter.executed).toStrictEqual([]);
    });

    it("stops the chain at a failing middle segment and caches nothing after it", async () => {
        expect.assertions(5);

        const counter = createCountingExecutor();

        const failing = await runCommand("step-one && FAIL && step-three", counter);

        expect(counter.executed).toStrictEqual(["app:build#1", "app:build#2"]);
        expect(failing.get("app:build#1")?.status).toBe("success");
        expect(failing.get("app:build#2")?.status).toBe("failure");
        expect(failing.get("app:build#3")?.status).toBe("skipped");

        // Fixing the middle segment must execute segment 3, which was never cached.
        counter.executed.length = 0;
        await runCommand("step-one && step-two && step-three", counter);

        expect(counter.executed).toStrictEqual(["app:build#2", "app:build#3"]);
    });

    it("leaves a command with an unsupported construct whole and says why", async () => {
        expect.assertions(6);

        const counter = createCountingExecutor();
        const diagnostics: string[] = [];
        const options: TaskRunnerOptions = { onDiagnostic: (_id, message) => diagnostics.push(message) };

        const first = await runCommand("cd packages/app && build", counter, options);

        expect([...first.keys()]).toStrictEqual(["app:build"]);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain("`cd`");

        await runCommand("cd packages/app && build", counter);

        expect(counter.executed).toStrictEqual(["app:build"]);

        const changed = await runCommand("cd packages/app && build-changed", counter);

        expect(counter.executed).toStrictEqual(["app:build", "app:build"]);
        expect([...changed.keys()]).toStrictEqual(["app:build"]);
    });

    it("warns and does not split when hashMode is trace", async () => {
        expect.assertions(3);

        const diagnostics: string[] = [];
        const task = makeBuildTask("step-one && step-two", { hashMode: "trace" });
        const context = createContext(workspaceRoot, [task], createCountingExecutor().executor);

        const results = await defaultTaskRunner([task], { dryRun: true, onDiagnostic: (_id, message) => diagnostics.push(message) }, context);

        expect([...results.keys()]).toStrictEqual(["app:build"]);
        expect(diagnostics).toHaveLength(1);
        expect(diagnostics[0]).toContain("traced hashing");
    });

    it("replays segment output in order on a full cache hit", async () => {
        expect.assertions(2);

        const counter = createCountingExecutor();

        await runCommand("step-one && step-two && step-three", counter);

        const replayed: { id: string; output: string | undefined }[] = [];
        const lifeCycle: LifeCycleInterface = {
            printTaskTerminalOutput: (task, _status, terminalOutput) => {
                replayed.push({ id: task.id, output: terminalOutput });
            },
        };

        const results = await runCommand("step-one && step-two && step-three", counter, {}, lifeCycle);

        expect([...results.values()].map((result) => result.status)).toStrictEqual(["local-cache", "local-cache", "local-cache"]);
        expect(replayed.map((entry) => entry.id)).toStrictEqual(["app:build#1", "app:build#2", "app:build#3"]);
    });
});
