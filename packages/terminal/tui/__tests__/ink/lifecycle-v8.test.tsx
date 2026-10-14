/**
 * Lifecycle regressions ported from upstream Ink: input ownership across
 * suspendTerminal(), idempotent suspend handles, non-interactive suspension,
 * unmount flushing/ended-stream handling, Static on exit, and onRender ordering.
 */
import { PassThrough, Writable } from "node:stream";
import { stripVTControlCharacters } from "node:util";

import React, { useEffect, useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Props as AppContextProps } from "../../src/components/app-context";
import { Static, Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { useInput } from "../../src/ink/hooks/use-input";
import usePaste from "../../src/ink/hooks/use-paste";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

type SuspendTerminal = AppContextProps["suspendTerminal"];

const tick = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
    });
};

const rawModeCalls = (stdin: NodeJS.ReadStream): boolean[] =>
    (stdin.setRawMode as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((args) => args[0] as boolean);

const Frame = ({ text }: { readonly text: string }): React.ReactNode => <Text>{text}</Text>;

const ExitWithStatic = (): React.ReactNode => {
    const { exit } = useApp();

    useEffect(() => {
        exit(new Error("errored"));
    }, [exit]);

    return (
        <>
            <Static items={["A", "B", "C"]}>{(item: string) => <Text key={item}>{item}</Text>}</Static>
            <Text>Dynamic</Text>
        </>
    );
};

const pasteEnableWrites = (stdout: ReturnType<typeof createStdout>, from: number): number =>
    stdout
        .getWrites()
        .slice(from)
        .filter((write) => write.includes("\u001B[?2004h"))
        .length;

describe("suspendTerminal input ownership", () => {
    it("an input hook activated while suspended does not take input until resume", async () => {
        expect.hasAssertions();

        const stdin = createStdin();
        const inputs: string[] = [];
        let app!: ReturnType<typeof useApp>;

        const Example = ({ isActive }: { readonly isActive: boolean }): React.ReactNode => {
            app = useApp();
            useInput((input) => {
                inputs.push(input);
            }, { isActive });

            return null;
        };

        const instance = render(<Example isActive={false} />, { interactive: true, patchConsole: false, stdin, stdout: createStdout() });
        const suspension = await app.suspendTerminal();
        const callCount = rawModeCalls(stdin).length;

        instance.rerender(<Example isActive />);
        await instance.waitUntilRenderFlush();

        expect(rawModeCalls(stdin).slice(callCount)).toEqual([]);
        expect(stdin.listenerCount("readable")).toBe(0);

        emitReadable(stdin, "x");

        expect(inputs).toEqual([]);

        await suspension.resume();

        expect(rawModeCalls(stdin).slice(callCount)).toEqual([true]);
        expect(stdin.listenerCount("readable")).toBe(1);

        emitReadable(stdin, "y");

        expect(inputs).toEqual(["y"]);

        instance.unmount();
    });

    it("a paste hook activated while suspended does not enable bracketed paste until resume", async () => {
        expect.hasAssertions();

        const stdin = createStdin();
        const stdout = createStdout();
        let app!: ReturnType<typeof useApp>;

        const Example = ({ isActive }: { readonly isActive: boolean }): React.ReactNode => {
            app = useApp();
            usePaste(() => {}, { isActive });

            return null;
        };

        const instance = render(<Example isActive={false} />, { interactive: true, patchConsole: false, stdin, stdout });
        const suspension = await app.suspendTerminal();
        const callCount = rawModeCalls(stdin).length;
        const writeCount = stdout.getWrites().length;

        instance.rerender(<Example isActive />);
        await instance.waitUntilRenderFlush();

        expect(pasteEnableWrites(stdout, writeCount)).toBe(0);
        expect(rawModeCalls(stdin).slice(callCount)).toEqual([]);
        expect(stdin.listenerCount("readable")).toBe(0);

        await suspension.resume();

        expect(pasteEnableWrites(stdout, writeCount)).toBe(1);
        expect(rawModeCalls(stdin).slice(callCount)).toEqual([true]);
        expect(stdin.listenerCount("readable")).toBe(1);

        instance.unmount();
    });

    for (const keepInput of [false, true]) {
        it(`resuming does not restore input released while suspended (keep input: ${String(keepInput)})`, async () => {
            expect.hasAssertions();

            const stdin = createStdin();
            const stdout = createStdout();
            let app!: ReturnType<typeof useApp>;

            const Example = ({ isActive }: { readonly isActive: boolean }): React.ReactNode => {
                app = useApp();
                useInput(() => {}, { isActive: keepInput || isActive });
                usePaste(() => {}, { isActive: keepInput || isActive });

                return null;
            };

            const instance = render(<Example isActive />, { interactive: true, patchConsole: false, stdin, stdout });
            const suspension = await app.suspendTerminal();
            const callCount = rawModeCalls(stdin).length;
            const writeCount = stdout.getWrites().length;

            instance.rerender(<Example isActive={false} />);
            await instance.waitUntilRenderFlush();
            await suspension.resume();

            expect(rawModeCalls(stdin).slice(callCount)).toEqual(keepInput ? [true] : []);
            expect(pasteEnableWrites(stdout, writeCount)).toBe(keepInput ? 1 : 0);
            expect(stdin.listenerCount("readable")).toBe(keepInput ? 1 : 0);

            instance.unmount();
        });
    }

    it("suspending in the commit that disables the last input hook releases raw mode before the callback runs", async () => {
        expect.hasAssertions();

        const stdin = createStdin();
        const log: string[] = [];

        (stdin.setRawMode as unknown as { mockImplementation: (function_: (value: boolean) => void) => void }).mockImplementation((value: boolean) => {
            log.push(`setRawMode(${String(value)})`);
        });

        let resume!: () => void;

        const Input = (): React.ReactNode => {
            useInput(() => {});

            return null;
        };

        const Example = ({ suspended }: { readonly suspended: boolean }): React.ReactNode => {
            const app = useApp();

            useEffect(() => {
                if (!suspended) {
                    return;
                }

                void app.suspendTerminal(async () => {
                    log.push("callback start");
                    await new Promise<void>((resolve) => {
                        resume = resolve;
                    });
                });
            }, [suspended, app]);

            return suspended ? null : <Input />;
        };

        const instance = render(<Example suspended={false} />, { interactive: true, patchConsole: false, stdin, stdout: createStdout() });

        log.length = 0;

        instance.rerender(<Example suspended />);
        await instance.waitUntilRenderFlush();
        await tick();

        expect(log).toEqual(["setRawMode(false)", "callback start"]);
        expect(stdin.listenerCount("readable")).toBe(0);

        resume();
        await tick();

        expect(log).toEqual(["setRawMode(false)", "callback start"]);
        expect(stdin.listenerCount("readable")).toBe(0);

        instance.unmount();
    });
});

describe("suspendTerminal handles", () => {
    for (const disposeFirst of [false, true]) {
        it(`an old suspension cannot resume a later suspension (dispose first: ${String(disposeFirst)})`, async () => {
            expect.hasAssertions();

            const stdin = createStdin();
            let suspendTerminal!: SuspendTerminal;

            const Example = (): React.ReactNode => {
                const app = useApp();

                useInput(() => {});
                useLayoutEffect(() => {
                    suspendTerminal = app.suspendTerminal;
                }, [app.suspendTerminal]);

                return <Text>hello</Text>;
            };

            const instance = render(<Example />, { interactive: true, patchConsole: false, stdin, stdout: createStdout() });

            await instance.waitUntilRenderFlush();

            const first = await suspendTerminal();

            await (disposeFirst ? first[Symbol.asyncDispose]() : first.resume());

            const second = await suspendTerminal();

            await first.resume();
            await first[Symbol.asyncDispose]();

            expect(rawModeCalls(stdin).at(-1)).toBe(false);

            await second.resume();

            expect(rawModeCalls(stdin).at(-1)).toBe(true);

            instance.unmount();
        });
    }

    for (const callback of [false, true]) {
        it(`resuming after unmount does not re-enable terminal input (callback: ${String(callback)})`, async () => {
            expect.hasAssertions();

            const stdin = createStdin();
            let suspendTerminal!: SuspendTerminal;

            const Example = (): React.ReactNode => {
                const app = useApp();

                useInput(() => {});
                useLayoutEffect(() => {
                    suspendTerminal = app.suspendTerminal;
                }, [app.suspendTerminal]);

                return <Text>hello</Text>;
            };

            const instance = render(<Example />, { interactive: true, patchConsole: false, stdin, stdout: createStdout() });

            await instance.waitUntilRenderFlush();

            if (callback) {
                await suspendTerminal(async () => {
                    instance.unmount();
                    await instance.waitUntilExit();
                });
            } else {
                const suspension = await suspendTerminal();

                instance.unmount();
                await instance.waitUntilExit();
                await suspension.resume();
            }

            expect(rawModeCalls(stdin).at(-1)).toBe(false);
            expect(stdin.listenerCount("readable")).toBe(0);
        });
    }
});

describe("non-interactive suspension", () => {
    it("keeps the latest rendered frame", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        let suspendTerminal!: SuspendTerminal;

        const Example = ({ text }: { readonly text: string }): React.ReactNode => {
            const app = useApp();

            useLayoutEffect(() => {
                suspendTerminal = app.suspendTerminal;
            }, [app.suspendTerminal]);

            return <Text>{text}</Text>;
        };

        const instance = render(<Example text="before" />, { interactive: false, patchConsole: false, stdin: createStdin(), stdout });

        await instance.waitUntilRenderFlush();

        await suspendTerminal(async () => {
            instance.rerender(<Example text="after" />);
            await instance.waitUntilRenderFlush();
        });

        instance.unmount();
        await instance.waitUntilExit();

        expect(stdout.get()).toBe("after\n");
    });

    for (const stream of ["stdout", "stderr"] as const) {
        it(`preserves ${stream} writes made during the suspension`, async () => {
            expect.hasAssertions();

            const stdout = createStdout();
            const stderr = createStdout();
            let suspendTerminal!: SuspendTerminal;

            const Example = (): React.ReactNode => {
                const app = useApp();

                useLayoutEffect(() => {
                    suspendTerminal = app.suspendTerminal;
                }, [app.suspendTerminal]);

                return <Text>frame</Text>;
            };

            const instance = render(<Example />, { interactive: false, patchConsole: false, stderr, stdin: createStdin(), stdout });

            await instance.waitUntilRenderFlush();

            await suspendTerminal(() => {
                (stream === "stdout" ? stdout : stderr).write("child result\n");
            });

            expect((stream === "stdout" ? stdout : stderr).getWrites()).toContain("child result\n");

            instance.unmount();
        });
    }
});

describe("unmount", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("forces a pending throttled render", () => {
        expect.hasAssertions();

        vi.useFakeTimers();

        const stdout = createStdout();
        const instance = render(<Frame text="Hello" />, { maxFps: 1, stdout });

        instance.rerender(<Frame text="Final" />);

        expect(stdout.getWrites().join("")).not.toContain("Final");

        instance.unmount();

        expect(stdout.getWrites().join("")).toContain("Final");
    });

    it("does not write to an ended stdout stream", async () => {
        expect.hasAssertions();

        const stdout = new PassThrough() as unknown as NodeJS.WriteStream;

        stdout.columns = 100;

        const errors: Error[] = [];

        stdout.on("error", (error) => {
            errors.push(error);
        });

        const instance = render(<Text>Hello</Text>, { stdout });
        const exitPromise = instance.waitUntilExit();

        stdout.end();
        instance.unmount();
        await exitPromise;
        await tick();

        expect(errors.some((error) => (error as NodeJS.ErrnoException).code === "ERR_STREAM_WRITE_AFTER_END")).toBe(false);
    });

    it("cancels a pending throttled render when stdout has ended", () => {
        expect.hasAssertions();

        vi.useFakeTimers();

        const endedStdout = (): NodeJS.WriteStream => {
            const stream = new PassThrough() as unknown as NodeJS.WriteStream;

            stream.columns = 100;

            return stream;
        };

        // Baseline: the same render and teardown with no pending rerender.
        const baselineStdout = endedStdout();
        const baseline = render(<Frame text="Hello" />, { maxFps: 1, stdout: baselineStdout });

        baselineStdout.end();
        baseline.unmount();

        const baselineTimers = vi.getTimerCount();

        vi.runAllTimers();

        const stdout = endedStdout();
        const instance = render(<Frame text="Hello" />, { maxFps: 1, stdout });

        instance.rerender(<Frame text="World" />);
        stdout.end();

        instance.unmount();

        expect(vi.getTimerCount()).toBe(baselineTimers);
    });

    it("resolves waitUntilExit only after the stdout write callback", async () => {
        expect.hasAssertions();

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

        const instance = render(<Text>Hello</Text>, { stdout });
        const exitPromise = instance.waitUntilExit();

        instance.unmount();
        await exitPromise;

        expect(writeCallbackFired).toBe(true);
    });

    for (const interactive of [false, true]) {
        it(`does not duplicate <Static> output on exit with an error (interactive: ${String(interactive)})`, async () => {
            expect.hasAssertions();

            const stdout = createStdout(100, interactive);
            const instance = render(<ExitWithStatic />, { interactive, patchConsole: false, stdin: createStdin(), stdout });

            await expect(instance.waitUntilExit()).rejects.toThrow("errored");

            const output = stripVTControlCharacters(stdout.getWrites().join(""));

            expect(output.split("A").length - 1).toBe(1);
        });
    }

    it("does not keep a beforeExit listener when waitUntilExit() is called after unmount", async () => {
        expect.hasAssertions();

        const before = process.listenerCount("beforeExit");
        const instance = render(<Text>Hello</Text>, { stdout: createStdout() });

        instance.unmount();
        await instance.waitUntilExit();

        expect(process.listenerCount("beforeExit")).toBe(before);
    });
});

describe("onRender", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    const modes: { readonly name: string; readonly options: Record<string, unknown> }[] = [
        { name: "normal", options: { incrementalRendering: false } },
        { name: "incremental", options: { incrementalRendering: true } },
        { name: "debug", options: { debug: true } },
        { name: "screen reader", options: { isScreenReaderEnabled: true } },
        { name: "alternate screen", options: { alternateScreen: true } },
        { name: "throttled", options: { maxFps: 1 } },
    ];

    for (const mode of modes) {
        it(`reports render metrics after the committed frame is written (${mode.name})`, async () => {
            expect.hasAssertions();

            vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setImmediate", "clearImmediate", "queueMicrotask"] });

            const stdout = createStdout();
            const events: string[] = [];
            const metrics: { renderTime: number }[] = [];
            const onRender = (metric: { renderTime: number }): void => {
                metrics.push(metric);
                events.push(`onRender:${stdout.getWrites().join("")}`);
            };

            const instance = render(<Text>first</Text>, {
                interactive: true,
                onRender,
                patchConsole: false,
                stdin: createStdin(),
                stdout,
                ...mode.options,
            });

            vi.advanceTimersByTime(1000);

            expect(metrics).toHaveLength(1);
            expect(metrics[0]!.renderTime).toBeGreaterThanOrEqual(0);
            expect(events[0]).toContain("first");

            instance.rerender(<Text>second</Text>);
            vi.advanceTimersByTime(1000);

            expect(metrics).toHaveLength(2);
            expect(events.at(-1)).toContain("second");

            instance.unmount();
        });
    }
});
