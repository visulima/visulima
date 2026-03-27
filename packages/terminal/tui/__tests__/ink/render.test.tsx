import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { Writable } from "node:stream";
import url from "node:url";

import { eraseLines, resetTerminal, strip as stripAnsi } from "@visulima/ansi";
import { boxen } from "@visulima/boxen";
import delay from "delay";
import type { ReactElement } from "react";
import { PureComponent, useEffect, useState } from "react";
import { expect, it } from "vitest";

import { Box, render, Text, useApp } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

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

const term = (fixture: string, args: string[] = []) => {
    let resolve: (value?: unknown) => void;
    let reject: (error: Error) => void;

    const exitPromise = new Promise((resolve2, reject2) => {
        resolve = resolve2;
        reject = reject2;
    });

    const env = {
        ...process.env,
        NODE_NO_WARNINGS: "1",
    };

    const ps = getSpawn()("node", ["--import=tsx", join(__dirname, `./fixtures/${fixture}.tsx`), ...args], {
        cols: 100,
        cwd: __dirname,
        env,
        name: "xterm-color",
    });

    const result = {
        output: "",
        waitForExit: async () => exitPromise,
        write(input: string) {
            ps.write(input);
        },
    };

    ps.onData((data) => {
        result.output += data.replaceAll("\u001B[?2026h", "").replaceAll("\u001B[?2026l", "");
    });

    ps.onExit(({ exitCode }) => {
        if (exitCode === 0) {
            resolve();

            return;
        }

        reject(new Error(`Process exited with non-zero exit code: ${exitCode}`));
    });

    return result;
};

const isWriteBarrierChunk = (chunk: string | Uint8Array): boolean =>
    (typeof chunk === "string" && chunk === "") || (chunk instanceof Uint8Array && chunk.length === 0);

const toRenderedChunk = (chunk: string | Uint8Array): string => stripAnsi(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());

const isCursorOrSyncEscape = (chunk: string | Uint8Array): boolean => {
    const string_ = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();

    return string_.startsWith("\u001B[?25") || string_ === "\u001B[?2026h" || string_ === "\u001B[?2026l";
};

const isRenderContent = (chunk: string | Uint8Array): boolean => !isWriteBarrierChunk(chunk) && !isCursorOrSyncEscape(chunk);

const getContentWrites = (writeSpy: any): string[] =>
    (writeSpy.mock.calls as string[][]).map((args: string[]) => args[0]!).filter((w: string) => isRenderContent(w));

it.skipIf(!ptyAvailable)("do not erase screen", async () => {
    const ps = term("erase", ["4"]);

    await ps.waitForExit();

    expect(ps.output).not.toContain(resetTerminal);

    for (const letter of ["A", "B", "C"]) {
        expect(ps.output).toContain(letter);
    }
});

it.skipIf(!ptyAvailable)("do not erase screen where <Static> is taller than viewport", async () => {
    const ps = term("erase-with-static", ["4"]);

    await ps.waitForExit();

    expect(ps.output).not.toContain(resetTerminal);

    for (const letter of ["A", "B", "C", "D", "E", "F"]) {
        expect(ps.output).toContain(letter);
    }
});

it.skipIf(!ptyAvailable)("erase screen", async () => {
    const ps = term("erase", ["3"]);

    await ps.waitForExit();

    expect(ps.output).toContain(resetTerminal);

    for (const letter of ["A", "B", "C"]) {
        expect(ps.output).toContain(letter);
    }
});

it.skipIf(!ptyAvailable)("clear output", async () => {
    const ps = term("clear");

    await ps.waitForExit();

    const secondFrame = ps.output.split(eraseLines(4))[1];

    for (const letter of ["A", "B", "C"]) {
        expect(secondFrame?.includes(letter)).toBe(false);
    }
});

it.skipIf(!ptyAvailable)("intercept console methods and display result above output", async () => {
    const ps = term("console");

    await ps.waitForExit();

    const frames = ps.output.split(eraseLines(2)).map((line) => stripAnsi(line));

    expect(frames).toEqual(["Hello World\r\n", "First log\r\nHello World\r\nSecond log\r\n"]);
});

it.skipIf(!ptyAvailable)("rerender on resize", async () => {
    const stdout = createStdout(10);

    const Test = () => (
        <Box borderStyle="round">
            <Text>Test</Text>
        </Box>
    );

    const { unmount } = render(<Test />, { stdout });

    const contentWrites = getContentWrites(stdout.write);

    expect(stripAnsi(contentWrites[0]!)).toBe(`${boxen("Test".padEnd(8), { borderStyle: "round" })}\n`);

    expect(stdout.listeners("resize")).toHaveLength(1);

    stdout.columns = 8;
    stdout.emit("resize");
    await delay(100);

    const contentWritesAfterResize = getContentWrites(stdout.write);

    expect(stripAnsi(contentWritesAfterResize.at(-1)!)).toBe(`${boxen("Test".padEnd(6), { borderStyle: "round" })}\n`);

    unmount();

    expect(stdout.listeners("resize")).toHaveLength(0);
});

it.skipIf(!ptyAvailable)("waitUntilExit resolves after stdout write callback", async () => {
    let writeCallbackFired = false;

    const stdout = new Writable({
        write(_chunk, _encoding, callback) {
            setTimeout(() => {
                writeCallbackFired = true;
                callback();
            }, 150);
        },
    }) as unknown as NodeJS.WriteStream;

    stdout.columns = 100;

    const { unmount, waitUntilExit } = render(<Text>Hello</Text>, { stdout });
    const exitPromise = waitUntilExit();

    unmount();
    await exitPromise;

    expect(writeCallbackFired).toBe(true);
});

it.skipIf(!ptyAvailable)("waitUntilRenderFlush resolves after unmount", async () => {
    const stdout = createStdout();
    const { unmount, waitUntilExit, waitUntilRenderFlush } = render(<Text>Hello</Text>, { stdout });

    unmount();
    await waitUntilRenderFlush();
    await waitUntilExit();

    expect(true).toBe(true); // No timeout
});

it.skipIf(!ptyAvailable)("waitUntilRenderFlush resolves after exit with error", async () => {
    const stdout = createStdout();

    const Test = () => {
        const { exit } = useApp();

        useEffect(() => {
            exit(new Error("Done"));
        }, [exit]);

        return <Text>Hello</Text>;
    };

    const { waitUntilExit, waitUntilRenderFlush } = render(<Test />, { stdout });

    await expect(waitUntilExit()).rejects.toThrow("Done");

    await waitUntilRenderFlush();
});

it.skipIf(!ptyAvailable)("should reject waitUntilExit when app exits during synchronous render error handling", async () => {
    class SynchronousErrorBoundary extends PureComponent<
        {
            children?: ReactElement;
            onError: (error: Error) => void;
        },
        { error?: Error }
    > {
        static override getDerivedStateFromError(error: Error) {
            return { error };
        }

        override state: { error?: Error } = {
            error: undefined,
        };

        override componentDidCatch(error: Error) {
            this.props.onError(error);
        }

        override render() {
            if (this.state.error) {
                return null;
            }

            return this.props.children;
        }
    }

    function SynchronousRenderErrorComponent() {
        throw new Error("Synchronous render error");
    }

    const ThrowingComponentWithBoundary = () => {
        const { exit } = useApp();

        return (
            <SynchronousErrorBoundary onError={exit}>
                <SynchronousRenderErrorComponent />
            </SynchronousErrorBoundary>
        );
    };

    const stdout = createStdout();
    const { waitUntilExit } = render(<ThrowingComponentWithBoundary />, {
        patchConsole: false,
        stdout,
    });

    await expect(
        Promise.race([
            waitUntilExit(),
            delay(500).then(() => {
                throw new Error("waitUntilExit did not settle");
            }),
        ]),
    ).rejects.toThrow("Synchronous render error");
});

it.skipIf(!ptyAvailable)("render only last frame when run in CI", async () => {
    const Counter = () => {
        const [count, setCount] = useState(0);
        const { exit } = useApp();

        useEffect(() => {
            if (count >= 5) {
                exit();

                return;
            }

            const timer = setTimeout(() => {
                setCount((c) => c + 1);
            }, 10);

            return () => clearTimeout(timer);
        }, [count, exit]);

        return (
            <Text>
                Counter:
                {count}
            </Text>
        );
    };

    const stdout = createStdout(100, false);
    const { waitUntilExit } = render(<Counter />, { debug: false, stdout });

    await waitUntilExit();

    const allWrites = stdout.getWrites().map((w) => stripAnsi(w));
    const allContent = allWrites.join("");

    // In non-interactive mode, only the last frame is written
    for (const number_ of [0, 1, 2, 3, 4]) {
        expect(allContent).not.toContain(`Counter: ${number_}`);
    }

    expect(allContent).toContain("Counter: 5");
});

it.skipIf(!ptyAvailable)("#725: non-TTY child process output is flushed", async () => {
    const { spawn: spawnProcess } = await import("node:child_process");

    const fixtureProcess = spawnProcess("node", ["--import=tsx", join(__dirname, "./fixtures/issue-725-child-process.tsx")], {
        env: {
            ...process.env,
            CI: "false",
            NODE_NO_WARNINGS: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";

    fixtureProcess.stdout.on("data", (data: Uint8Array | string) => {
        output += typeof data === "string" ? data : data.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
        fixtureProcess.on("error", reject);
        fixtureProcess.on("close", (code) => {
            resolve(code ?? 0);
        });
    });

    expect(exitCode).toBe(0);

    const plainOutput = stripAnsi(output);

    expect(plainOutput).toContain("ready-stdin-not-tty");
    expect(plainOutput).toContain("exited");
});
