import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { ProjectGraph, Task, TaskGraph, TaskResult } from "../../src/types";

// A traced task runs a real child. The child appends the value of an env var
// the caller injects, so the spawn count shows whether the traced key moved.
describe("trace-mode runs key and check the child environment", () => {
    let workspaceRoot: string;
    let logFile: string;

    const task: Task = {
        cache: true,
        fingerprintEnv: ["TR_TEST_INJECTED"],
        hashMode: "trace",
        id: "app:build",
        outputs: [],
        overrides: { command: "node record.cjs" },
        projectRoot: "packages/app",
        target: { project: "app", target: "build" },
    };

    const projectGraph: ProjectGraph = {
        dependencies: { app: [] },
        nodes: { app: { data: { root: "packages/app" }, name: "app", type: "application" } },
    };

    const spawns = async (): Promise<string[]> => {
        try {
            const content = await readFile(logFile, "utf8");

            return content.split("\n").filter(Boolean);
        } catch {
            return [];
        }
    };

    const run = async (options: { injected: string; preTraceCheck?: (task: Task, options: { cwd: string }) => string | undefined }): Promise<TaskResult | undefined> => {
        const taskGraph: TaskGraph = { dependencies: { "app:build": [] }, roots: ["app:build"], tasks: { "app:build": { ...task } } };

        const orchestrator = new TaskOrchestrator({
            cache: new Cache({ workspaceRoot }),
            lifeCycle: new EmptyLifeCycle(),
            preTraceCheck: options.preTraceCheck,
            resolveChildEnv: () => { return { env: { TR_TEST_INJECTED: options.injected, TR_TEST_LOG: logFile }, inheritEnv: true }; },
            resolveCommand: () => "node record.cjs",
            scheduler: new TaskScheduler(taskGraph, projectGraph, 1),
            taskExecutor: async () => {
                throw new Error("a traced task must not reach the declared executor");
            },
            taskGraph,
            taskHasher: new InProcessTaskHasher({ projects: { app: { root: "packages/app" } }, workspaceRoot }),
            workspaceRoot,
        });

        const results = await orchestrator.run();

        return results.get("app:build");
    };

    beforeEach(async () => {
        // The tracker reports real paths, so the workspace must be too (macOS temp dirs are symlinks).

        workspaceRoot = await realpath(await mkdtemp(join(tmpdir(), "trace-child-env-")));
        // Outside the workspace, so the tracker does not record the log as a
        // self-modified input and skip caching the task.
        // eslint-disable-next-line sonarjs/pseudo-random
        logFile = join(tmpdir(), `trace-child-env-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.log`);

        await mkdir(join(workspaceRoot, "packages/app"), { recursive: true });
        await writeFile(
            join(workspaceRoot, "packages/app/record.cjs"),
            [
                "const fs = require(\"node:fs\");",
                "fs.readFileSync(__filename);",
                String.raw`fs.appendFileSync(process.env.TR_TEST_LOG, process.env.TR_TEST_INJECTED + "\n");`,
                "",
            ].join("\n"),
        );
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
        await rm(logFile, { force: true });
    });

    it("re-runs when an injected value the task keys changes, and hits while it is unchanged", async () => {
        expect.assertions(5);

        const first = await run({ injected: "a" });

        expect(first?.status).toBe("success");

        const second = await run({ injected: "a" });

        expect(second?.status).toBe("local-cache");
        await expect(spawns()).resolves.toStrictEqual(["a"]);

        const third = await run({ injected: "b" });

        expect(third?.status).toBe("success");
        await expect(spawns()).resolves.toStrictEqual(["a", "b"]);
    });

    it("fails a traced task that the pre-run check rejects, before the child runs, and caches nothing", async () => {
        expect.assertions(4);

        const rejected = (): string => "TR_TEST_INJECTED is not allowed here";

        const first = await run({ injected: "a", preTraceCheck: rejected });

        expect(first?.status).toBe("failure");
        expect(first?.code).toBe(1);
        expect(first?.terminalOutput).toBe("TR_TEST_INJECTED is not allowed here");

        // Nothing was cached, so a later run with the check passing still spawns the child.
        await run({ injected: "a" });

        await expect(spawns()).resolves.toStrictEqual(["a"]);
    });
});
