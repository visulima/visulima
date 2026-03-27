import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import url from "node:url";

import { strip as stripAnsi } from "@visulima/ansi";
import { expect, it } from "vitest";

import { run } from "../helpers/ink-run.js";

const require = createRequire(import.meta.url);

const _request = createRequire(import.meta.url);
const ptyAvailable = (() => {
    try {
        _request("node-pty");

        return true;
    } catch {
        return false;
    }
})();

let _spawn: (typeof import("node-pty"))["spawn"] | undefined;
const getSpawn = () => {
    if (!_spawn) {
        try {
            _spawn = (require("node-pty") as typeof import("node-pty")).spawn;
        } catch {
            throw new Error("node-pty not available on this platform");
        }
    }

    return _spawn;
};

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

it.skipIf(!ptyAvailable)("exit normally without unmount() or exit()", async () => {
    const output = await run("exit-normally");

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit on unmount()", async () => {
    const output = await run("exit-on-unmount");

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit when app finishes execution", async () => {
    const ps = run("exit-on-finish");

    await expect(ps).resolves.not.toThrow();
});

it.skipIf(!ptyAvailable)("exit on exit()", async () => {
    const output = await run("exit-on-exit");

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit on exit() with error", async () => {
    const output = await run("exit-on-exit-with-error");

    expect(output).toContain("errored");
});

it.skipIf(!ptyAvailable)("exit on exit() with error with value property", async () => {
    const output = await run("exit-on-exit-with-error-value-property");

    expect(output).toContain("errored");
});

it.skipIf(!ptyAvailable)("exit on exit() with result value", async () => {
    const output = await run("exit-on-exit-with-result");

    expect(output).toContain("result:hello from ink");
});

it.skipIf(!ptyAvailable)("exit on exit() with object result", async () => {
    const output = await run("exit-on-exit-with-value-object");

    expect(output).toContain("result:hello from ink object");
});

it.skipIf(!ptyAvailable)("exit on exit() with raw mode", async () => {
    const output = await run("exit-raw-on-exit");

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit on exit() with raw mode with error", async () => {
    const output = await run("exit-raw-on-exit-with-error");

    expect(output).toContain("errored");
});

it.skipIf(!ptyAvailable)("exit on unmount() with raw mode", async () => {
    const output = await run("exit-raw-on-unmount");

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit with thrown error", async () => {
    const output = await run("exit-with-thrown-error");

    expect(output).toContain("errored");
});

it.skipIf(!ptyAvailable)("don't exit while raw mode is active", async () => {
    await new Promise<void>((resolve, reject) => {
        const env: Record<string, string> = {
            ...process.env,
            NODE_NO_WARNINGS: "1",
        };

        const term = getSpawn()("node", ["--import=tsx", join(__dirname, "./fixtures/exit-double-raw-mode.tsx")], {
            cols: 100,
            cwd: __dirname,
            env,
            name: "xterm-color",
        });

        let output = "";

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

        let isExited = false;

        term.onExit(({ exitCode }) => {
            isExited = true;

            if (exitCode === 0) {
                expect(output).toContain("exited");

                resolve();

                return;
            }

            reject(new Error(`Process exited with code ${exitCode}`));
        });
    });
});

it.skipIf(!ptyAvailable)("exit when DEV is set", async () => {
    const output = await run("exit-normally", {
        env: {
            DEV: "true",
        },
    });

    expect(output).toContain("exited");
});

it.skipIf(!ptyAvailable)("exit on exit() with error and static output", async () => {
    const output = await run("exit-with-static");

    expect(output).toContain("errored");
    expect(output).toContain("A");
    expect(output).toContain("B");
    expect(output).toContain("C");

    const cleaned = stripAnsi(output);

    expect(cleaned.split("A").length - 1).toBe(1);
});
