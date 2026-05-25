import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import url from "node:url";

import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { ptyAvailable, run } from "../helpers/ink-run";

const ptyRequire = createRequire(import.meta.url);

let cachedSpawn: (typeof import("node-pty"))["spawn"] | undefined;
const getSpawn = () => {
    if (!cachedSpawn) {
        try {
            cachedSpawn = (ptyRequire("node-pty") as typeof import("node-pty")).spawn;
        } catch {
            throw new Error("node-pty not available on this platform");
        }
    }

    return cachedSpawn;
};

const currentDirectory = url.fileURLToPath(new URL(".", import.meta.url));

describe("exit", () => {
    it.skipIf(!ptyAvailable)("exit normally without unmount() or exit()", async () => {
        expect.assertions(1);

        const output = await run("exit-normally");

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit on unmount()", async () => {
        expect.assertions(1);

        const output = await run("exit-on-unmount");

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit when app finishes execution", async () => {
        expect.assertions(1);

        const ps = run("exit-on-finish");

        await expect(ps).resolves.not.toThrow();
    });

    it.skipIf(!ptyAvailable)("exit on exit()", async () => {
        expect.assertions(1);

        const output = await run("exit-on-exit");

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with error", async () => {
        expect.assertions(1);

        const output = await run("exit-on-exit-with-error");

        expect(output).toContain("errored");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with error with value property", async () => {
        expect.assertions(1);

        const output = await run("exit-on-exit-with-error-value-property");

        expect(output).toContain("errored");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with result value", async () => {
        expect.assertions(1);

        const output = await run("exit-on-exit-with-result");

        expect(output).toContain("result:hello from ink");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with object result", async () => {
        expect.assertions(1);

        const output = await run("exit-on-exit-with-value-object");

        expect(output).toContain("result:hello from ink object");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with raw mode", async () => {
        expect.assertions(1);

        const output = await run("exit-raw-on-exit");

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with raw mode with error", async () => {
        expect.assertions(1);

        const output = await run("exit-raw-on-exit-with-error");

        expect(output).toContain("errored");
    });

    it.skipIf(!ptyAvailable)("exit on unmount() with raw mode", async () => {
        expect.assertions(1);

        const output = await run("exit-raw-on-unmount");

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit with thrown error", async () => {
        expect.assertions(1);

        const output = await run("exit-with-thrown-error");

        expect(output).toContain("errored");
    });

    it.skipIf(!ptyAvailable)("don't exit while raw mode is active", async () => {
        expect.assertions(2);

        await new Promise<void>((resolve, reject) => {
            const env: Record<string, string> = {
                ...process.env,
                NODE_NO_WARNINGS: "1",
            };

            const term = getSpawn()("node", ["--import=tsx", join(currentDirectory, "./fixtures/exit-double-raw-mode.tsx")], {
                cols: 100,
                cwd: currentDirectory,
                env,
                name: "xterm-color",
            });

            let output = "";
            let isExited = false;

            term.onData((data) => {
                if (data === "s") {
                    setTimeout(() => {
                        expect(isExited).toBe(false);

                        term.write("q");
                    }, 500);

                    setTimeout(() => {
                        term.kill();
                        reject(new Error("Test timed out - process did not exit in time"));
                    }, 2000);
                } else {
                    output += data;
                }
            });

            term.onExit(({ exitCode }) => {
                isExited = true;

                if (exitCode === 0) {
                    expect(output).toContain("exited");

                    resolve();

                    return;
                }

                reject(new Error(`Process exited with code ${String(exitCode)}`));
            });
        });
    });

    it.skipIf(!ptyAvailable)("exit when DEV is set", async () => {
        expect.assertions(1);

        const output = await run("exit-normally", {
            env: {
                DEV: "true",
            },
        });

        expect(output).toContain("exited");
    });

    it.skipIf(!ptyAvailable)("exit on exit() with error and static output", async () => {
        expect.assertions(5);

        const output = await run("exit-with-static");

        expect(output).toContain("errored");
        expect(output).toContain("A");
        expect(output).toContain("B");
        expect(output).toContain("C");

        const cleaned = stripAnsi(output);

        expect(cleaned.split("A").length - 1).toBe(1);
    });
});
