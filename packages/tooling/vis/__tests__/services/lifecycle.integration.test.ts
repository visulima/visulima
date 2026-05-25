import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";

import { join } from "@visulima/path";
import type { Task, TaskGraph } from "@visulima/task-runner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyServiceRegistry } from "../../src/commands/run/apply-service-registry";
import { startService, stopService } from "../../src/services/lifecycle";
import { runReadiness } from "../../src/services/readiness";
import { isAlive, readAllEntries, readEntry } from "../../src/services/registry";
import type { VisTargetOptions } from "../../src/task/target-options";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const killTree = (pid: number): void => {
    if (process.platform === "win32") {
        // No POSIX process groups on Windows — `process.kill(-pid)`
        // throws ESRCH and the shell wrapper survives, keeping a handle
        // on the workspace tempdir and causing rmSync EBUSY in the next
        // afterEach. `taskkill /T` walks the spawn tree via the Windows
        // job-object chain instead.
        try {
            execFileSync("taskkill", ["/F", "/T", "/PID", String(pid)], { stdio: "ignore" });
        } catch {
            // already gone
        }

        return;
    }

    try {
        process.kill(-pid, "SIGKILL");
    } catch {
        // already gone
    }
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

// Inline `node -e "..."` payloads get shredded by cmd.exe's argument
// parser on Windows once nested quotes enter the picture. Writing the
// child source to a file and invoking `node <file>` sidesteps the entire
// escape chain.
const writeChildScript = async (directory: string, name: string, source: string): Promise<string> => {
    const path = join(directory, name);

    await writeFile(path, source, "utf8");

    return path;
};

const findFreePort = async (): Promise<number> =>
    new Promise((resolve, reject) => {
        const server = createServer();

        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();

            if (typeof address === "object" && address !== null) {
                const { port } = address;

                server.close(() => {
                    resolve(port);
                });

                return;
            }

            reject(new Error("Could not bind"));
        });
    });

const buildTask = (id: string, options?: VisTargetOptions): Task => {
    return {
        cache: false,
        id,
        outputs: [],
        overrides: {
            command: `echo ${id}`,
            ...(options ? { visOptions: options } : {}),
        },
        target: { project: id.split(":")[0]!, target: id.split(":")[1]! },
    };
};

/**
 * Integration test: drive the full service-registry chain that `vis service`
 * + `vis run` exercise in production, without forking the CLI binary.
 *
 *     start  → registry write + readiness probe
 *     list   → readAllEntries
 *     attach → applyServiceRegistry with the same probe wiring run/handler
 *              uses, end-to-end against a live TCP server
 *     stop   → SIGTERM, registry delete
 *     re-attach with no entry → diagnostic
 *
 * This catches packaging/wiring regressions that the per-module unit
 * tests can miss — e.g. a probe failure path that's correct in isolation
 * but never invoked from the run handler, or a readiness-config schema
 * change that flows through types but not through the registry round-trip.
 */
describe("services/lifecycle — end-to-end", () => {
    let workspaceRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;
    let originalUserprofile: string | undefined;
    let toCleanup: number[];

    beforeEach(() => {
        // On Windows `os.homedir()` reads `USERPROFILE`, not `HOME` —
        // override both so the registry directory lives in our fixture
        // on every platform.
        workspaceRoot = createTemporaryDirectory("vis-int-lc-ws-");
        homeOverride = createTemporaryDirectory("vis-int-lc-home-");
        originalHome = process.env["HOME"];
        originalUserprofile = process.env["USERPROFILE"];
        process.env["HOME"] = homeOverride;
        process.env["USERPROFILE"] = homeOverride;
        toCleanup = [];
    });

    afterEach(async () => {
        for (const pid of toCleanup) {
            killTree(pid);
        }

        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        if (originalUserprofile === undefined) {
            delete process.env["USERPROFILE"];
        } else {
            process.env["USERPROFILE"] = originalUserprofile;
        }

        // Give the kernel a tick so reaped PIDs don't bleed into the
        // next test's `isAlive` check.
        await sleep(50);
        cleanupTemporaryDirectory(workspaceRoot);
        cleanupTemporaryDirectory(homeOverride);
    });

    // TODO(windows): TCP readiness probes against `node` children spawned via
    // cmd.exe are unreliable on the GitHub Windows runners — cold-start +
    // listen() routinely blows past 60s. Skipped pending a switch to a more
    // deterministic readiness signal (pipe handshake or marker file).
    it.skipIf(process.platform === "win32")("walks the full lifecycle: start → list → attach → stop → re-attach diagnostics", { timeout: 90_000 }, async () => {
        expect.assertions(14);

        const port = await findFreePort();
        const dbId = "@app/api:db";
        const testId = "@app/api:test";

        // 1) start — boot a real TCP listener as the "service" and
        //    register it. Also stamps env that should reach dependents.
        const childPath = await writeChildScript(
            workspaceRoot,
            "listener-e2e.js",
            `require('net').createServer(() => {}).listen(${String(port)}, '127.0.0.1');`,
        );
        const startResult = await startService({
            command: `node ${JSON.stringify(childPath)}`,
            config: {
                env: { DB_URL: `postgres://127.0.0.1:${String(port)}/app` },
                readiness: { tcp: { port, timeoutMs: 60_000 } },
            },
            cwd: workspaceRoot,
            env: { DB_URL: `postgres://127.0.0.1:${String(port)}/app` },
            id: dbId,
            workspaceRoot,
        });

        toCleanup.push(startResult.entry.pid);

        expect(startResult.entry.id).toBe(dbId);
        expect(isAlive(startResult.entry.pid)).toBe(true);

        // 2) list — the freshly-started entry shows up in the registry
        //    listing that `vis service list` consumes.
        const allEntries = await readAllEntries(workspaceRoot);

        expect(allEntries).toHaveLength(1);
        expect(allEntries[0]?.id).toBe(dbId);

        // 3) attach — simulate `vis run @app/api:test` against a graph
        //    where the test task depends on the db service. The probe
        //    is the *exact* one wired in src/commands/run/handler.ts.
        const dbTask = buildTask(dbId, {
            service: { port, readiness: { tcp: { port, timeoutMs: 60_000 } } },
        });
        const testTask = buildTask(testId);
        const taskGraph: TaskGraph = {
            dependencies: { [dbId]: [], [testId]: [dbId] },
            roots: [testId],
            tasks: { [dbId]: dbTask, [testId]: testTask },
        };

        const attachResult = await applyServiceRegistry({
            initialTasks: [testTask],
            probe: async (entry) => {
                try {
                    await runReadiness(entry.config, { timeoutMs: 2000 });

                    return true;
                } catch {
                    return false;
                }
            },
            registeredEntries: allEntries,
            taskGraph,
            visVersion: startResult.entry.visVersion,
        });

        // The db service is pruned out of the graph; the test target
        // remains and inherits db's env via the precomputed map. This
        // is the contract `runConcurrentTasks` relies on.
        expect(attachResult.diagnostics).toStrictEqual([]);
        expect(attachResult.taskGraph.tasks[dbId]).toBeUndefined();
        expect(attachResult.taskGraph.tasks[testId]).toBeDefined();
        expect(attachResult.serviceEnvByTaskId.get(testId)).toStrictEqual({
            DB_URL: `postgres://127.0.0.1:${String(port)}/app`,
        });

        // 4) stop — SIGTERM the service; entry must be unregistered.
        const stopResult = await stopService({ graceMs: 1000, id: dbId, workspaceRoot });

        expect(stopResult.stopped).toBe(true);

        await sleep(150);

        await expect(readEntry(workspaceRoot, dbId)).resolves.toBeUndefined();
        await expect(readAllEntries(workspaceRoot)).resolves.toStrictEqual([]);

        // 5) re-attach with the service gone — the same graph now
        //    surfaces an actionable diagnostic instead of attaching.
        //    This is the path that turns a silent half-run into an
        //    explicit "start the service first" message.
        const reAttach = await applyServiceRegistry({
            initialTasks: [testTask],
            registeredEntries: [],
            taskGraph,
            visVersion: startResult.entry.visVersion,
        });

        expect(reAttach.diagnostics).toHaveLength(1);
        expect(reAttach.diagnostics[0]?.targetId).toBe(dbId);
        expect(reAttach.diagnostics[0]?.message).toMatch(/vis service start/);
    });

    // TODO(windows): skipped for the same TCP-readiness reason as the
    // full-lifecycle test above.
    it.skipIf(process.platform === "win32")("demotes a registered service whose port is unreachable to the restart-service path", { timeout: 90_000 }, async () => {
        expect.assertions(4);

        // Start the service successfully, then immediately kill the
        // child while *leaving the registry entry in place*. This is
        // the "wrapper PID alive but server crashed" scenario that the
        // probe-on-attach guard exists to catch.
        const port = await findFreePort();
        const dbId = "@app/api:db";

        const startResult = await startService({
            command: `node -e "require('net').createServer(()=>{}).listen(${String(port)}, '127.0.0.1')"`,
            config: {
                env: { DB_URL: `postgres://127.0.0.1:${String(port)}/app` },
                readiness: { tcp: { port, timeoutMs: 60_000 } },
            },
            cwd: workspaceRoot,
            env: { DB_URL: `postgres://127.0.0.1:${String(port)}/app` },
            id: dbId,
            workspaceRoot,
        });

        toCleanup.push(startResult.entry.pid);

        // Kill the listener but DON'T call stopService — we want the
        // registry entry to outlive the actual server, simulating a
        // crash mid-session. `killTree` handles the POSIX/Windows split.
        killTree(startResult.entry.pid);

        await sleep(200);

        // Force-recreate the registry entry as if the wrapper were
        // still alive — point it at *this* test process so isAlive()
        // reports true. Without this, the dead-PID branch would prune
        // the entry before the probe ever runs.
        const allEntries = await readAllEntries(workspaceRoot);
        const stillRegistered = allEntries.find((e) => e.id === dbId);

        expect(stillRegistered).toBeDefined();

        const fakedAlive = stillRegistered ? { ...stillRegistered, pid: process.pid } : undefined;

        const testTask = buildTask("@app/api:test");
        const dbTask = buildTask(dbId, {
            service: { port, readiness: { tcp: { port, timeoutMs: 500 } } },
        });
        const taskGraph: TaskGraph = {
            dependencies: { "@app/api:test": [dbId], [dbId]: [] },
            roots: ["@app/api:test"],
            tasks: { "@app/api:test": testTask, [dbId]: dbTask },
        };

        const attachResult = await applyServiceRegistry({
            initialTasks: [testTask],
            probe: async (entry) => {
                try {
                    await runReadiness(entry.config, { timeoutMs: 500 });

                    return true;
                } catch {
                    return false;
                }
            },
            registeredEntries: fakedAlive ? [fakedAlive] : [],
            taskGraph,
            visVersion: startResult.entry.visVersion,
        });

        // PID looks alive, port doesn't — probe rejects → diagnostic
        // distinct from the missing-entry path: we tell the operator to
        // *restart* (the wrapper is alive but the server is gone), not
        // to *start*.
        expect(attachResult.diagnostics).toHaveLength(1);
        expect(attachResult.diagnostics[0]?.message).toMatch(/vis service restart/);
        expect(attachResult.satisfiedServices).toStrictEqual([]);
    });
});
