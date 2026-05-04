import { createServer } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startService, stopService } from "../../src/services/lifecycle";
import { isAlive, readEntry } from "../../src/services/registry";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

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

describe("services/lifecycle", () => {
    let workspaceRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;
    let toCleanup: number[] = [];

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-test-lc-ws-");
        homeOverride = createTemporaryDirectory("vis-test-lc-home-");
        originalHome = process.env["HOME"];
        process.env["HOME"] = homeOverride;
        toCleanup = [];
    });

    afterEach(() => {
        for (const pid of toCleanup) {
            try {
                process.kill(pid, "SIGKILL");
            } catch {
                // already gone
            }
        }

        if (originalHome === undefined) {
            delete process.env["HOME"];
        } else {
            process.env["HOME"] = originalHome;
        }

        cleanupTemporaryDirectory(workspaceRoot);
        cleanupTemporaryDirectory(homeOverride);
    });

    it("starts a service, registers it, and stops it cleanly", async () => {
        expect.assertions(5);

        const port = await findFreePort();

        const startResult = await startService({
            command: `node -e "require('net').createServer(()=>{}).listen(${String(port)}, '127.0.0.1')"`,
            config: { readiness: { tcp: { port, timeoutMs: 5000 } } },
            cwd: workspaceRoot,
            env: {},
            id: "fixture:db",
            workspaceRoot,
        });

        toCleanup.push(startResult.entry.pid);

        expect(startResult.entry.id).toBe("fixture:db");
        expect(isAlive(startResult.entry.pid)).toBe(true);
        await expect(readEntry(workspaceRoot, "fixture:db")).resolves.toBeDefined();

        const stopResult = await stopService({
            graceMs: 1000,
            id: "fixture:db",
            workspaceRoot,
        });

        expect(stopResult.stopped).toBe(true);

        // Give the kernel a moment to reap.
        await sleep(150);

        await expect(readEntry(workspaceRoot, "fixture:db")).resolves.toBeUndefined();
    });

    it("refuses to start a service that is already running", async () => {
        expect.assertions(1);

        const port = await findFreePort();

        const startResult = await startService({
            command: `node -e "require('net').createServer(()=>{}).listen(${String(port)}, '127.0.0.1')"`,
            config: { readiness: { tcp: { port, timeoutMs: 5000 } } },
            cwd: workspaceRoot,
            env: {},
            id: "fixture:db",
            workspaceRoot,
        });

        toCleanup.push(startResult.entry.pid);

        await expect(
            startService({
                command: 'node -e "setInterval(()=>{},1000)"',
                config: {},
                cwd: workspaceRoot,
                env: {},
                id: "fixture:db",
                workspaceRoot,
            }),
        ).rejects.toThrow(/already running/);

        await stopService({ graceMs: 1000, id: "fixture:db", workspaceRoot });
    });

    it("returns stopped:false for an unknown service", async () => {
        expect.assertions(1);

        const result = await stopService({ id: "missing:svc", workspaceRoot });

        expect(result.stopped).toBe(false);
    });

    it("cleans up the registry entry when readiness fails", async () => {
        expect.assertions(2);

        const port = await findFreePort();

        // Probe at port that nothing ever listens on. The spawned child is a
        // do-nothing sleep — readiness times out fast, lifecycle should
        // SIGKILL the orphan and unregister.
        await expect(
            startService({
                command: 'node -e "setInterval(()=>{},1000)"',
                config: { readiness: { tcp: { port, timeoutMs: 300 } } },
                cwd: workspaceRoot,
                env: {},
                id: "broken:db",
                workspaceRoot,
            }),
        ).rejects.toThrow();

        // Entry must not be left behind.
        await expect(readEntry(workspaceRoot, "broken:db")).resolves.toBeUndefined();
    });
});
