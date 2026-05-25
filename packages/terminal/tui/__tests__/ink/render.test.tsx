import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { Writable } from "node:stream";
import url from "node:url";

import { clearScreenAndHomeCursor, eraseLines, eraseScreenAndScrollback, resetTerminal, strip as stripAnsi } from "@visulima/ansi";
import { boxen } from "@visulima/boxen";
import delay from "delay";
import type { ReactElement } from "react";
import { PureComponent, useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import { ptyAvailable, run } from "../helpers/ink-run";
import waitFor from "../helpers/wait-for";

const require = createRequire(import.meta.url);

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
    let resolveExit: (value?: unknown) => void;
    let rejectExit: (error: Error) => void;

    const exitPromise = new Promise((resolve2, reject2) => {
        resolveExit = resolve2;
        rejectExit = reject2;
    });

    const env = {
        ...process.env,
        CI: "false",
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
            resolveExit();

            return;
        }

        rejectExit(new Error(`Process exited with non-zero exit code: ${String(exitCode)}`));
    });

    return result;
};

const isWriteBarrierChunk = (chunk: string | Uint8Array): boolean =>
    (typeof chunk === "string" && chunk === "") || (chunk instanceof Uint8Array && chunk.length === 0);

const isCursorOrSyncEscape = (chunk: string | Uint8Array): boolean => {
    const chunkString = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();

    return chunkString.startsWith("\u001B[?25") || chunkString === "\u001B[?2026h" || chunkString === "\u001B[?2026l";
};

const isRenderContent = (chunk: string | Uint8Array): boolean => !isWriteBarrierChunk(chunk) && !isCursorOrSyncEscape(chunk);

const getContentWrites = (writeSpy: any): string[] =>
    (writeSpy.mock.calls as string[][]).map((args: string[]) => args[0]!).filter((w: string) => isRenderContent(w));

// eslint-disable-next-line vitest/prefer-describe-function-title -- String title is conventional for test describe blocks
describe("render", () => {
    it.skipIf(!ptyAvailable)("do not erase screen", async () => {
        expect.assertions(5);

        const ps = term("erase", ["4"]);

        await ps.waitForExit();

        expect(ps.output).not.toContain(resetTerminal);
        // Regression guard for vadimdemedes/ink#935: no scrollback wipe on rerender.
        expect(ps.output).not.toContain(eraseScreenAndScrollback);

        ["A", "B", "C"].forEach((letter) => {
            expect(ps.output).toContain(letter);
        });
    });

    it.skipIf(!ptyAvailable)("do not erase screen where <Static> is taller than viewport", async () => {
        expect.assertions(8);

        const ps = term("erase-with-static", ["4"]);

        await ps.waitForExit();

        expect(ps.output).not.toContain(resetTerminal);
        // Regression guard for vadimdemedes/ink#935: no scrollback wipe on rerender.
        expect(ps.output).not.toContain(eraseScreenAndScrollback);

        ["A", "B", "C", "D", "E", "F"].forEach((letter) => {
            expect(ps.output).toContain(letter);
        });
    });

    it.skipIf(!ptyAvailable)("erase screen", async () => {
        expect.assertions(6);

        const ps = term("erase", ["3"]);

        await ps.waitForExit();
        await waitFor(() => ps.output.includes(clearScreenAndHomeCursor) && ps.output.includes("C"));

        // Fullscreen rerenders must clear the viewport so the next frame starts at the top.
        expect(ps.output).toContain(clearScreenAndHomeCursor);

        // Regression guard for vadimdemedes/ink#935: the render loop must never emit
        // the scrollback-erase sequence (CSI 3J) or RIS (ESC c) — doing so wipes the
        // user's terminal history in VT-compliant terminals (tmux, xterm.js, Alacritty, …).
        expect(ps.output).not.toContain(eraseScreenAndScrollback);
        expect(ps.output).not.toContain(resetTerminal);

        ["A", "B", "C"].forEach((letter) => {
            expect(ps.output).toContain(letter);
        });
    });

    it.skipIf(!ptyAvailable)("clear output", async () => {
        expect.assertions(3);

        const ps = term("clear");

        await ps.waitForExit();
        await waitFor(() => ps.output.includes(eraseLines(4)));

        const secondFrame = ps.output.split(eraseLines(4))[1];

        for (const letter of ["A", "B", "C"]) {
            expect(secondFrame?.includes(letter)).toBe(false);
        }
    });

    it.skipIf(!ptyAvailable)("intercept console methods and display result above output", async () => {
        expect.assertions(1);

        const ps = term("console");

        await ps.waitForExit();
        await waitFor(() => ps.output.includes("Second log"));

        const frames = ps.output.split(eraseLines(2)).map((line) => stripAnsi(line));

        expect(frames).toStrictEqual(["Hello World\r\n", "First log\r\nHello World\r\nSecond log\r\n"]);
    });

    it.skipIf(!ptyAvailable)("rerender on resize", async () => {
        expect.assertions(4);

        const stdout = createStdout(10);

        const Test = () => (
            <Box borderStyle="round">
                <Text>Test</Text>
            </Box>
        );

        const { unmount } = render(<Test />, { interactive: true, stdout });

        const contentWrites = getContentWrites(stdout.write);

        expect(stripAnsi(contentWrites[0]!)).toBe(`${boxen("Test".padEnd(8), { borderStyle: "round" })}\n`);

        expect(stdout.listeners("resize")).toHaveLength(1);

        stdout.columns = 8;
        stdout.emit("resize");
        await waitFor(() => {
            const writes = getContentWrites(stdout.write);

            return stripAnsi(writes.at(-1) ?? "") !== stripAnsi(contentWrites[0]!);
        });

        const contentWritesAfterResize = getContentWrites(stdout.write);

        expect(stripAnsi(contentWritesAfterResize.at(-1)!)).toBe(`${boxen("Test".padEnd(6), { borderStyle: "round" })}\n`);

        unmount();

        expect(stdout.listeners("resize")).toHaveLength(0);
    });

    it.skipIf(!ptyAvailable)("waitUntilExit resolves after stdout write callback", async () => {
        expect.assertions(1);

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
        expect.assertions(1);

        const stdout = createStdout();
        const { unmount, waitUntilExit, waitUntilRenderFlush } = render(<Text>Hello</Text>, { stdout });

        unmount();
        await waitUntilRenderFlush();
        await waitUntilExit();

        expect(true).toBe(true); // No timeout
    });

    it.skipIf(!ptyAvailable)("waitUntilRenderFlush resolves after exit with error", async () => {
        expect.assertions(1);

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
        expect.assertions(1);

        class SynchronousErrorBoundary extends PureComponent<
            {
                children?: ReactElement;
                onError: (error: Error) => void;
            },
            { error?: Error }
        > {
            public static override getDerivedStateFromError(error: Error) {
                return { error };
            }

            public override state: { error?: Error } = {
                error: undefined,
            };

            public override componentDidCatch(error: Error) {
                const { onError } = this.props;

                onError(error);
            }

            public override render() {
                const { error } = this.state;

                if (error) {
                    return null;
                }

                const { children } = this.props;

                return children;
            }
        }

        const SynchronousRenderErrorComponent = () => {
            throw new Error("Synchronous render error");
        };

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
        expect.assertions(6);

        const Counter = () => {
            const [count, setCount] = useState(0);
            const { exit } = useApp();

            useEffect(() => {
                if (count >= 5) {
                    exit();

                    return undefined;
                }

                const increment = () => {
                    setCount((c) => c + 1);
                };
                const timer = setTimeout(increment, 10);

                return () => {
                    clearTimeout(timer);
                };
            }, [count, exit]);

            return <Text>Counter: {count}</Text>;
        };

        const stdout = createStdout(100, false);
        const { waitUntilExit } = render(<Counter />, { debug: false, stdout });

        await waitUntilExit();

        const allWrites = stdout.getWrites().map((w) => stripAnsi(w));
        const allContent = allWrites.join("");

        // In non-interactive mode, only the last frame is written
        [0, 1, 2, 3, 4].forEach((counter) => {
            expect(allContent).not.toContain(`Counter: ${String(counter)}`);
        });

        expect(allContent).toContain("Counter: 5");
    });

    it.skipIf(!ptyAvailable)("#725: non-TTY child process output is flushed", async () => {
        expect.assertions(3);

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

    it.skipIf(!ptyAvailable)(
        "#450: incremental rendering should not clearTerminal for fullscreen rerenders",
        async () => {
            expect.assertions(3);

            const rows = 6;
            const output = await run("issue-450-incremental-fullscreen-rerender", { args: [String(rows)], rows });

            // resetTerminal contains ESC c (RIS) — incremental mode should never emit it
            expect(output).not.toContain(resetTerminal);

            const stripped = stripAnsi(output);

            expect(stripped).toContain("#450 top");
            expect(stripped).toContain("#450 bottom");
        },
        10_000,
    );

    it.skipIf(!ptyAvailable)("#450: incremental rendering should still emit Static output when shrinking from fullscreen", async () => {
        expect.assertions(3);

        const rows = 6;
        const output = await run("issue-450-incremental-static-shrink-rerender", { args: [String(rows)], rows });

        const stripped = stripAnsi(output);

        // Static content must not be dropped by the incremental early-return path
        expect(stripped).toContain("#450 static line");
        expect(stripped).toContain("#450 top");
        expect(stripped).toContain("#450 bottom");
    });
});
