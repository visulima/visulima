/**
 * Exercise the parts of the watch loop that don't depend on
 * `node:fs.watch`: the initial cycle invocation and the lifecycle
 * teardown via SIGINT. The recursive watcher itself is covered by the
 * dedicated watch tests; here we only need to know the loop calls the
 * cycle once on entry and exits when the process is signalled.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runWatchLoop } from "../../src/lint-fmt/watch-loop";

const tick = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        setImmediate(() => {
            resolve();
        });
    });
};

describe(runWatchLoop, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-watch-loop-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("calls runCycle once with the provided initial files", async () => {
        expect.assertions(2);

        const initial = [join(workspaceRoot, "a.ts")];
        const calls: (string[] | undefined)[] = [];

        const finished = runWatchLoop({
            extensions: ["ts"],
            initialFiles: initial,
            label: "lint",
            log: () => {},
            runCycle: async (files) => {
                calls.push(files);
            },
            workspaceRoot,
        });

        // Give the loop a tick to run the initial cycle and arm the watcher,
        // then signal it to stop so the test can finish deterministically.
        await tick();

        process.emit("SIGINT");

        await finished;

        expect(calls).toHaveLength(1);
        expect(calls[0]).toBe(initial);
    });

    it("calls runCycle with undefined when no initial files are provided", async () => {
        expect.assertions(1);

        const calls: (string[] | undefined)[] = [];

        const finished = runWatchLoop({
            extensions: ["ts"],
            initialFiles: undefined,
            label: "fmt",
            log: () => {},
            runCycle: async (files) => {
                calls.push(files);
            },
            workspaceRoot,
        });

        await tick();

        process.emit("SIGINT");

        await finished;

        expect(calls[0]).toBeUndefined();
    });

    it("resolves cleanly on SIGTERM", async () => {
        expect.assertions(1);

        const finished = runWatchLoop({
            extensions: ["ts"],
            initialFiles: undefined,
            label: "lint",
            log: () => {},
            runCycle: async () => {},
            workspaceRoot,
        });

        await tick();

        process.emit("SIGTERM");

        await expect(finished).resolves.toBeUndefined();
    });
});
