import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultTaskRunner } from "../src/default-task-runner";
import { EmptyLifeCycle } from "../src/life-cycle";
import type { LifeCycleInterface, ProjectGraph, Task, TaskExecutor, TaskGraph, TaskRunnerContext } from "../src/types";

const execFileAsync = promisify(execFile);

/**
 * End-to-end coverage for the orchestrator that the other unit tests
 * intentionally skip: the executor actually shells out, outputs are
 * real files produced on disk, and cache hits restore those files
 * back into the workspace.
 *
 * Scope:
 *   - cold miss → warm cache hit
 *   - input change busts the cache
 *   - output tree restored from the archive on a hit
 *   - real non-zero exit propagates as a failure
 *   - dependency ordering across two tasks
 *
 * Uses `node -e ...` as the subprocess so the tests work on Linux,
 * macOS, and Windows CI runners without a POSIX shell assumption.
 */

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `e2e-runner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const makeTask = (id: string, projectRoot: string, outputs: string[] = []): Task => {
    const [project = "", target = ""] = id.split(":");

    return {
        id,
        outputs,
        overrides: {},
        projectRoot,
        target: { project, target },
    };
};

/**
 * Executor that runs a real subprocess via `node -e`. Captures stdout
 * verbatim so tests can assert on the actual process output, not a
 * synthesized string.
 */
const createNodeExecutor
    = (workspaceRoot: string, commandsByTaskId: Record<string, string>): TaskExecutor =>
        async (task) => {
            const script = commandsByTaskId[task.id];

            if (!script) {
                throw new Error(`No script registered for task ${task.id}`);
            }

            try {
                const { stdout } = await execFileAsync(process.execPath, ["-e", script], {
                    cwd: workspaceRoot,
                });

                return { code: 0, terminalOutput: stdout };
            } catch (error) {
                const err = error as NodeJS.ErrnoException & { code?: number | string; stderr?: string; stdout?: string };
                // execFile rejection carries the child's exit code on `code`
                // when the process exited non-zero.
                const code = typeof err.code === "number" ? err.code : 1;

                return { code, terminalOutput: `${err.stdout ?? ""}${err.stderr ?? ""}` };
            }
        };

const createContext = (
    workspaceRoot: string,
    tasks: Task[],
    dependencies: Record<string, string[]>,
    executor: TaskExecutor,
    lifeCycle?: LifeCycleInterface,
): TaskRunnerContext => {
    const taskGraph: TaskGraph = {
        dependencies,
        roots: tasks.map((t) => t.id),
        tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
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

    return {
        lifeCycle: lifeCycle ?? new EmptyLifeCycle(),
        projectGraph,
        taskExecutor: executor,
        taskGraph,
        workspaceRoot,
    };
};

describe("defaultTaskRunner (E2E via real subprocess)", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();

        await mkdir(join(workspaceRoot, "packages/app/src"), { recursive: true });
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "export const x = 1;\n");
        await writeFile(join(workspaceRoot, "packages/app/package.json"), JSON.stringify({ name: "app" }));
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("round-trips a real subprocess through the cache (cold miss → warm hit restores output)", async () => {
        expect.assertions(5);

        const task = makeTask("app:build", "packages/app", ["packages/app/dist"]);
        // Writes a real file into packages/app/dist. The second run
        // should restore it from cache without re-executing.
        const script = String.raw`
            const { mkdirSync, writeFileSync } = require('node:fs');
            const { join } = require('node:path');
            const distDirectory = join(process.cwd(), 'packages/app/dist');
            mkdirSync(distDirectory, { recursive: true });
            writeFileSync(join(distDirectory, 'bundle.js'), "console.log('hello');\n".repeat(50));
            process.stdout.write('built');
        `;

        const executor = createNodeExecutor(workspaceRoot, { "app:build": script });
        const context = createContext(workspaceRoot, [task], { "app:build": [] }, executor);

        // Cold miss: executes, writes dist/, archives into cache.
        const first = await defaultTaskRunner([task], {}, context);

        expect(first.get("app:build")?.status).toBe("success");

        const bundlePath = join(workspaceRoot, "packages/app/dist/bundle.js");
        const firstContent = await readFile(bundlePath, "utf8");

        expect(firstContent).toContain("hello");

        // Nuke the output tree to prove the hit restores from archive,
        // not from a stale on-disk copy.
        await rm(join(workspaceRoot, "packages/app/dist"), { force: true, recursive: true });

        const second = await defaultTaskRunner([task], {}, context);

        expect(second.get("app:build")?.status).toBe("local-cache");

        const restored = await readFile(bundlePath, "utf8");

        expect(restored).toBe(firstContent);
        expect(restored).toContain("hello");
    });

    it("invalidates the cache when an input file changes on disk", async () => {
        expect.assertions(3);

        const task = makeTask("app:build", "packages/app", []);
        const script = `process.stdout.write('build ' + Date.now());`;

        let executionCount = 0;
        const wrappedExecutor: TaskExecutor = async (t, options) => {
            executionCount += 1;

            return createNodeExecutor(workspaceRoot, { "app:build": script })(t, options);
        };

        const context = createContext(workspaceRoot, [task], { "app:build": [] }, wrappedExecutor);

        await defaultTaskRunner([task], {}, context);

        expect(executionCount).toBe(1);

        // Change a real source file — the hash must change, next run must miss.
        await writeFile(join(workspaceRoot, "packages/app/src/index.ts"), "export const x = 2;\n");

        const results = await defaultTaskRunner([task], {}, context);

        expect(results.get("app:build")?.status).toBe("success");
        expect(executionCount).toBe(2);
    });

    it("propagates a real non-zero exit as a failure", async () => {
        expect.assertions(2);

        const task = makeTask("app:build", "packages/app", []);
        const script = `process.stderr.write('boom'); process.exit(2);`;

        const executor = createNodeExecutor(workspaceRoot, { "app:build": script });
        const context = createContext(workspaceRoot, [task], { "app:build": [] }, executor);

        const results = await defaultTaskRunner([task], {}, context);
        const result = results.get("app:build");

        expect(result?.status).toBe("failure");
        expect(result?.terminalOutput).toContain("boom");
    });

    it("respects task graph ordering — dependent task sees the predecessor's output", async () => {
        expect.assertions(3);

        const compile = makeTask("app:compile", "packages/app", ["packages/app/build"]);
        const bundle = makeTask("app:bundle", "packages/app", ["packages/app/dist"]);

        const compileScript = `
            const { mkdirSync, writeFileSync } = require('node:fs');
            const { join } = require('node:path');
            const buildDir = join(process.cwd(), 'packages/app/build');
            mkdirSync(buildDir, { recursive: true });
            writeFileSync(join(buildDir, 'compiled.js'), 'compiled');
            process.stdout.write('compiled');
        `;
        const bundleScript = `
            const { readFileSync, mkdirSync, writeFileSync, existsSync } = require('node:fs');
            const { join } = require('node:path');
            // Must be able to read the predecessor's output — proves
            // the scheduler waited instead of racing.
            const compiled = readFileSync(join(process.cwd(), 'packages/app/build/compiled.js'), 'utf8');
            const distDir = join(process.cwd(), 'packages/app/dist');
            mkdirSync(distDir, { recursive: true });
            writeFileSync(join(distDir, 'bundle.js'), compiled + '-bundled');
            process.stdout.write('bundled');
        `;

        const executor = createNodeExecutor(workspaceRoot, {
            "app:bundle": bundleScript,
            "app:compile": compileScript,
        });

        const context = createContext(
            workspaceRoot,
            [compile, bundle],
            {
                "app:bundle": ["app:compile"],
                "app:compile": [],
            },
            executor,
        );

        const results = await defaultTaskRunner([compile, bundle], {}, context);

        expect(results.get("app:compile")?.status).toBe("success");
        expect(results.get("app:bundle")?.status).toBe("success");

        const bundled = await readFile(join(workspaceRoot, "packages/app/dist/bundle.js"), "utf8");

        expect(bundled).toBe("compiled-bundled");
    });
});
