import { writeFile } from "node:fs/promises";
import { createServer } from "node:net";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startService, stopService } from "../../src/services/lifecycle";
import { isAlive, readEntry } from "../../src/services/registry";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

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

describe("services/lifecycle", () => {
    let workspaceRoot: string;
    let homeOverride: string;
    let originalHome: string | undefined;
    let originalUserprofile: string | undefined;
    let toCleanup: number[];

    beforeEach(() => {
        // Per-test HOME/USERPROFILE so each registry directory lives under
        // a fresh tmp tree. On Windows `os.homedir()` reads `USERPROFILE`,
        // not `HOME` — override both for cross-platform isolation.
        workspaceRoot = createTemporaryDirectory("vis-test-lc-ws-");
        homeOverride = createTemporaryDirectory("vis-test-lc-home-");
        originalHome = process.env["HOME"];
        originalUserprofile = process.env["USERPROFILE"];
        process.env["HOME"] = homeOverride;
        process.env["USERPROFILE"] = homeOverride;
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

        if (originalUserprofile === undefined) {
            delete process.env["USERPROFILE"];
        } else {
            process.env["USERPROFILE"] = originalUserprofile;
        }

        cleanupTemporaryDirectory(workspaceRoot);
        cleanupTemporaryDirectory(homeOverride);
    });

    // TODO(windows): TCP readiness probes against `node` children spawned via
    // cmd.exe are unreliable on the GitHub Windows runners — cold-start +
    // listen() routinely blows past 60s. Skipped pending a switch to a more
    // deterministic readiness signal (pipe handshake or marker file).
    it.skipIf(process.platform === "win32")("starts a service, registers it, and stops it cleanly", { timeout: 90_000 }, async () => {
        expect.assertions(5);

        const port = await findFreePort();
        const childPath = await writeChildScript(
            workspaceRoot,
            "listener-clean.js",
            `require('net').createServer(() => {}).listen(${String(port)}, '127.0.0.1');`,
        );

        const startResult = await startService({
            command: `node ${JSON.stringify(childPath)}`,
            config: { readiness: { tcp: { port, timeoutMs: 60_000 } } },
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

    // TODO(windows): skipped for the same TCP-readiness reason as the
    // start+stop test above.
    it.skipIf(process.platform === "win32")("refuses to start a service that is already running", { timeout: 90_000 }, async () => {
        expect.assertions(1);

        const port = await findFreePort();
        const childPath = await writeChildScript(
            workspaceRoot,
            "listener-already.js",
            `require('net').createServer(() => {}).listen(${String(port)}, '127.0.0.1');`,
        );
        const idleChildPath = await writeChildScript(workspaceRoot, "idle.js", "setInterval(() => {}, 1000);");

        const startResult = await startService({
            command: `node ${JSON.stringify(childPath)}`,
            config: { readiness: { tcp: { port, timeoutMs: 60_000 } } },
            cwd: workspaceRoot,
            env: {},
            id: "fixture:db",
            workspaceRoot,
        });

        toCleanup.push(startResult.entry.pid);

        await expect(
            startService({
                command: `node ${JSON.stringify(idleChildPath)}`,
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

    // TODO(windows): even the readiness-fails branch trips the cmd.exe →
    // node cold-start path before it can decide to give up. Skipped pending
    // a more deterministic readiness signal.
    it.skipIf(process.platform === "win32")("cleans up the registry entry when readiness fails", async () => {
        expect.assertions(2);

        const port = await findFreePort();
        const idleChildPath = await writeChildScript(workspaceRoot, "idle-readiness.js", "setInterval(() => {}, 1000);");

        // Probe at port that nothing ever listens on. The spawned child is a
        // do-nothing sleep — readiness times out fast, lifecycle should
        // SIGKILL the orphan and unregister.
        await expect(
            startService({
                command: `node ${JSON.stringify(idleChildPath)}`,
                config: { readiness: { tcp: { port, timeoutMs: 300 } } },
                cwd: workspaceRoot,
                env: {},
                id: "broken:db",
                workspaceRoot,
            }),
        ).rejects.toThrow(expect.anything());

        // Entry must not be left behind.
        await expect(readEntry(workspaceRoot, "broken:db")).resolves.toBeUndefined();
    });
});
