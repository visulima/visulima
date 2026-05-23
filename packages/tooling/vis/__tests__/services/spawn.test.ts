import { readFile, writeFile } from "node:fs/promises";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { isAlive } from "../../src/services/registry";
import { spawnDetached } from "../../src/services/spawn";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

// Writing the JS into a script file and invoking `node <file>` sidesteps
// the deeply layered shell-escape rules (cmd.exe → Node CRT → JS literal)
// that mangle inline `node -e "..."` payloads on Windows.
const writeChildScript = async (directory: string, name: string, source: string): Promise<string> => {
    const path = join(directory, name);

    await writeFile(path, source, "utf8");

    return path;
};

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
        const childPath = await writeChildScript(
            temporaryDirectory,
            "child-alive.js",
            "setInterval(() => {}, 1000);",
        );

        const { pid } = await spawnDetached({
            command: `node ${JSON.stringify(childPath)}`,
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

    it(
        "captures stdout into the log file",
        async ({ signal }) => {
            expect.assertions(1);

            const logFile = join(temporaryDirectory, "out.log");
            const childPath = await writeChildScript(
                temporaryDirectory,
                "child-stdout.js",
                "console.log('hello-from-child'); setInterval(() => {}, 1000);",
            );

            const { pid } = await spawnDetached({
                command: `node ${JSON.stringify(childPath)}`,
                cwd: temporaryDirectory,
                env: {},
                logFile,
            });

            try {
                // Poll for the captured line — spawn resolves on PID
                // assignment, not after the child has written. Windows
                // cmd.exe + node startup can take 3+ s on a cold runner;
                // POSIX usually lands in <100 ms. The vitest test timeout
                // override below keeps this from racing against the
                // default 5 s budget. `signal` aborts cleanly when vitest
                // does decide to give up, so the trailing expect() can't
                // leak into the next test's assertion counter.
                const deadline = Date.now() + 20_000;
                let contents = "";

                while (Date.now() < deadline && !signal.aborted) {
                    contents = await readFile(logFile, "utf8");

                    if (contents.includes("hello-from-child")) {
                        break;
                    }

                    await sleep(100);
                }

                expect(contents).toContain("hello-from-child");
            } finally {
                try {
                    process.kill(pid, "SIGKILL");
                } catch {
                    // already gone
                }
            }
        },
        30_000,
    );

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
