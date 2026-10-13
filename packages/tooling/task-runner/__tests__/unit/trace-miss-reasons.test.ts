import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Cache } from "../../src/cache";
import { EmptyLifeCycle } from "../../src/life-cycle";
import { InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { ProjectGraph, Task, TaskExecutor, TaskGraph } from "../../src/types";

describe("trace-mode cache miss reasons", () => {
    let workspaceRoot: string;

    const task: Task = {
        cache: true,
        hashMode: "trace",
        id: "app:build",
        outputs: [],
        overrides: {},
        projectRoot: "packages/app",
        target: { project: "app", target: "build" },
    };

    const successExecutor: TaskExecutor = async () => { return { code: 0, terminalOutput: "done" }; };

    const run = async () => {
        const taskGraph: TaskGraph = { dependencies: { "app:build": [] }, roots: ["app:build"], tasks: { "app:build": { ...task } } };
        const projectGraph: ProjectGraph = {
            dependencies: { app: [] },
            nodes: { app: { data: { root: "packages/app" }, name: "app", type: "application" } },
        };

        const orchestrator = new TaskOrchestrator({
            cache: new Cache({ workspaceRoot }),
            lifeCycle: new EmptyLifeCycle(),
            scheduler: new TaskScheduler(taskGraph, projectGraph, 1),
            taskExecutor: successExecutor,
            taskGraph,
            taskHasher: new InProcessTaskHasher({ projects: { app: { root: "packages/app" } }, workspaceRoot }),
            workspaceRoot,
        });

        const results = await orchestrator.run();

        return results.get("app:build");
    };

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `trace-miss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("records no-fingerprint on the first run, nothing on a hit, and file-changed after an edit", async () => {
        expect.assertions(5);

        const first = await run();

        expect(first?.cacheMissReasons).toStrictEqual([{ detail: "no previous fingerprint", type: "no-fingerprint" }]);

        const second = await run();

        expect(second?.status).toBe("local-cache");
        expect(second?.cacheMissReasons).toBeUndefined();

        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 2;");

        const third = await run();

        expect(third?.status).toBe("success");
        expect(third?.cacheMissReasons).toStrictEqual([expect.objectContaining({ detail: "packages/app/src/index.ts", type: "file-changed" })]);
    });
});
