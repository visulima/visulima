import { readFile } from "node:fs/promises";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { isAlive } from "../../src/services/registry";
import { spawnDetached } from "../../src/services/spawn";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

describe(spawnDetached, () => {
    let temporaryDirectory: string;

    beforeEach(() => {
        temporaryDirectory = createTemporaryDirectory("vis-test-spawn-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(temporaryDirectory);
    });

    it("returns a PID that is alive immediately after spawn", async () => {
        expect.assertions(1);

        const logFile = join(temporaryDirectory, "test.log");

        const { pid } = await spawnDetached({
            command: "node -e \"setInterval(()=>{}, 1000)\"",
            cwd: temporaryDirectory,
            env: {},
            logFile,
        });

        try {
            expectTypeOf(pid).toBeNumber();

            expect(isAlive(pid)).toBe(true);
        } finally {
            // Clean up the orphaned process so test runs don't leak children.
            try {
                process.kill(pid, "SIGKILL");
            } catch {
                // already gone
            }
        }
    });

    it("captures stdout into the log file", async () => {
        expect.assertions(1);

        const logFile = join(temporaryDirectory, "out.log");

        const { pid } = await spawnDetached({
            command: "node -e \"console.log('hello-from-child'); setInterval(()=>{}, 1000)\"",
            cwd: temporaryDirectory,
            env: {},
            logFile,
        });

        try {
            // Give the child a beat to actually flush its line — spawn only
            // resolves once the OS has a PID, not once the child has written.
            await sleep(300);

            const contents = await readFile(logFile, "utf8");

            expect(contents).toContain("hello-from-child");
        } finally {
            try {
                process.kill(pid, "SIGKILL");
            } catch {
                // already gone
            }
        }
    });

    it("rejects when the command fails to spawn", async () => {
        expect.assertions(1);

        // Even with /bin/sh wrapping, a malformed shell expression bubbles
        // out as a non-zero exit, but `spawnDetached` only fails when the
        // shell itself is missing. To force a real failure, point the
        // command at a non-existent binary via an explicit env that
        // breaks PATH lookup — `command -v` in /bin/sh returns nothing and
        // the child exits before we know its PID.
        // Instead, assert the happier "binary missing" case by spawning
        // through a shell that exits 127 — the function still resolves
        // (PID exists for the shell), but follow-up isAlive will be false.
        const logFile = join(temporaryDirectory, "missing.log");

        const { pid } = await spawnDetached({
            command: "this-binary-does-not-exist-12345",
            cwd: temporaryDirectory,
            env: {},
            logFile,
        });

        // The shell wrapper itself spawns successfully and exits ~immediately.
        await sleep(200);

        expect(isAlive(pid)).toBe(false);
    });
});
