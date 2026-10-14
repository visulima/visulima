import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Cache } from "../../src/cache";
import { emptyHints } from "../../src/cache-hints";
import type { RunSummary } from "../../src/run-summary";
import { generateRunSummary } from "../../src/run-summary";
import { computeTaskHash, InProcessTaskHasher } from "../../src/task-hasher";
import { TaskOrchestrator } from "../../src/task-orchestrator";
import { TaskScheduler } from "../../src/task-scheduler";
import type { TrackedExecutionResult } from "../../src/tracked-executor";
import { TrackedTaskExecutor } from "../../src/tracked-executor";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph } from "../../src/types";

class RecordingLifeCycle implements LifeCycleInterface {
    public readonly warnings: string[] = [];

    public readonly fallbacks: string[] = [];

    public printDeclaredFallback(task: Task): void {
        this.fallbacks.push(task.id);
    }

    public printEmptyFingerprintWarning(_task: Task, reason: string): void {
        this.warnings.push(reason);
    }
}

interface RunOptions {
    /** Declare `inputs` on the target (the graph sets `declaresInputs` from this). */
    declared: boolean;
    skipCache?: boolean;
}

describe("trace-mode declared fallback", () => {
    let workspaceRoot: string;
    let lifeCycle: RecordingLifeCycle;
    let lastSummary: RunSummary | undefined;

    const successExecutor: TaskExecutor = async () => {
        return { code: 0, terminalOutput: "done" };
    };

    const makeTask = (declared: boolean): Task => {
        return {
            cache: true,
            declaresInputs: declared,
            hashMode: "trace",
            id: "app:build",
            outputs: [],
            overrides: {},
            projectRoot: "packages/app",
            target: { project: "app", target: "build" },
        };
    };

    const projectsFor = (declared: boolean) => {
        return {
            app: {
                root: "packages/app",
                targets: declared ? { build: { inputs: ["{projectRoot}/src/**/*"] } } : {},
            },
        };
    };

    /**
     * Stubs the tracker: every run observes `accesses` and reports `tracker`.
     * The predicted tracker is stubbed to the same kind, so a stored entry is
     * validated against the tracker the stubbed run records, on every host.
     */
    const stubTracker = (accesses: TrackedExecutionResult["accesses"], tracker: TrackedExecutionResult["tracker"] = "preload") => {
        vi.spyOn(TrackedTaskExecutor.prototype, "execute").mockImplementation(async () => {
            return { accesses, code: 0, hints: emptyHints(), terminalOutput: "done", tracker };
        });
        vi.spyOn(TrackedTaskExecutor.prototype, "trackerKindFor").mockReturnValue(tracker);
    };

    const run = async ({ declared, skipCache = false }: RunOptions) => {
        const task = makeTask(declared);
        const taskGraph: TaskGraph = { dependencies: { "app:build": [] }, roots: ["app:build"], tasks: { "app:build": { ...task } } };
        const projectGraph: ProjectGraph = {
            dependencies: { app: [] },
            nodes: { app: { data: { root: "packages/app" }, name: "app", type: "application" } },
        };

        const orchestrator = new TaskOrchestrator({
            cache: new Cache({ workspaceRoot }),
            lifeCycle,
            resolveCommand: () => "node build.js && true",
            scheduler: new TaskScheduler(taskGraph, projectGraph, 1),
            skipCache,
            taskExecutor: successExecutor,
            taskGraph,
            taskHasher: new InProcessTaskHasher({ projects: projectsFor(declared), workspaceRoot }),
            workspaceRoot,
        });

        const results = await orchestrator.run();

        lastSummary = generateRunSummary(results, taskGraph, Date.now());

        return results.get("app:build");
    };

    beforeEach(async () => {
        // eslint-disable-next-line sonarjs/pseudo-random
        workspaceRoot = join(tmpdir(), `trace-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 1;");

        lifeCycle = new RecordingLifeCycle();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("keys an empty trace on the declared hash and hits on the next run", async () => {
        expect.assertions(8);

        stubTracker([]);

        const first = await run({ declared: true });

        expect(first?.status).toBe("success");
        expect(first?.hashSource).toBe("declared-fallback");
        expect(first?.emptyFingerprint).toBeUndefined();
        expect(lifeCycle.warnings).toHaveLength(0);

        const declaredHash = computeTaskHash(await new InProcessTaskHasher({ projects: projectsFor(true), workspaceRoot }).hashTask(makeTask(true)));

        expect(first?.task.hash).toBe(declaredHash);

        expect(lastSummary?.tasks[0]?.hashSource).toBe("declared-fallback");

        const second = await run({ declared: true });

        expect(second?.status).toBe("local-cache");
        expect(second?.hashSource).toBe("declared-fallback");
    });

    it("announces the fallback once, on the run that stores it, and never on a hit", async () => {
        expect.assertions(3);

        stubTracker([]);

        await run({ declared: true });

        expect(lifeCycle.fallbacks).toStrictEqual(["app:build"]);

        await run({ declared: true });

        expect(lifeCycle.fallbacks).toStrictEqual(["app:build"]);

        stubTracker([{ path: join(workspaceRoot, "packages/app/src/index.ts"), type: "read" }]);

        await run({ declared: true, skipCache: true });

        expect(lifeCycle.fallbacks).toStrictEqual(["app:build"]);
    });

    it("does not announce a fallback when the target declares no inputs", async () => {
        expect.assertions(1);

        stubTracker([]);

        await run({ declared: false });

        expect(lifeCycle.fallbacks).toHaveLength(0);
    });

    it("misses and re-executes when a declared input changes after a fallback run", async () => {
        expect.assertions(4);

        stubTracker([]);

        await run({ declared: true });

        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "const x = 2;");

        const after = await run({ declared: true });

        expect(after?.status).toBe("success");
        expect(after?.hashSource).toBe("declared-fallback");
        expect(after?.cacheMissReasons).toStrictEqual([expect.objectContaining({ type: "declared-changed" })]);
        expect(lifeCycle.warnings).toHaveLength(0);
    });

    it("does not cache an empty trace when the target declares no inputs", async () => {
        expect.assertions(6);

        stubTracker([]);

        const first = await run({ declared: false });

        expect(first?.status).toBe("success");
        expect(first?.hashSource).toBeUndefined();
        expect(first?.emptyFingerprint).toBe(true);
        expect(lifeCycle.warnings).toHaveLength(1);

        const second = await run({ declared: false });

        expect(second?.status).toBe("success");
        expect(lifeCycle.warnings).toHaveLength(2);
    });

    it("does no declared hashing when the tracker observed workspace files", async () => {
        expect.assertions(4);

        const hashSpy = vi.spyOn(InProcessTaskHasher.prototype, "hashTask");

        stubTracker([{ path: join(workspaceRoot, "packages/app/src/index.ts"), type: "read" }]);

        const first = await run({ declared: true });

        expect(first?.hashSource).toBeUndefined();
        expect(first?.emptyFingerprint).toBeUndefined();
        expect(hashSpy).not.toHaveBeenCalled();

        const second = await run({ declared: true });

        expect(second?.status).toBe("local-cache");
    });

    it("keys the same observations differently when the tracker kind differs", async () => {
        expect.assertions(1);

        const observed = [{ path: join(workspaceRoot, "packages/app/src/index.ts"), type: "read" as const }];

        stubTracker(observed, "strace");

        const linux = await run({ declared: false, skipCache: true });

        stubTracker(observed, "preload");

        const node = await run({ declared: false, skipCache: true });

        expect(linux?.task.hash).not.toBe(node?.task.hash);
    });
});
