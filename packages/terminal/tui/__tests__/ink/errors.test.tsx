import process from "node:process";
import { useEffect } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import patchConsole from "patch-console";
import { strip as stripAnsi } from "@visulima/ansi";
import { render, useStdin, Text } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

let restore = () => {};

beforeAll(() => {
    restore = patchConsole(() => {});
});

afterAll(() => {
    restore();
});

it("catch and display error", () => {
    const stdout = createStdout();

    const Test = () => {
        throw new Error("Oh no");
    };

    render(<Test />, { stdout });

    const writes: string[] = (stdout.write as any).mock.calls
        .map((c: any) => c[0] as string)
        .filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
    const lastContentWrite = writes.at(-1)!;

    const lines = stripAnsi(lastContentWrite).split("\n");
    expect(lines[1]).toBe("  ERROR  Oh no");
    expect(lines[3]).toMatch(/errors\.test\.tsx:\d+:\d+/);
    expect(lines.some((l: string) => l.includes("throw new Error") && l.includes("Oh no"))).toBe(true);
    expect(lines.some((l: string) => l.match(/Test.*errors\.test\.tsx:\d+:\d+/))).toBe(true);
});

it("does not emit unhandledRejection when render exits with an error and waitUntilExit is unused", async () => {
    const stdout = createStdout();
    const unhandledRejectionReasons: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
        unhandledRejectionReasons.push(reason);
    };

    process.on("unhandledRejection", onUnhandledRejection);

    try {
        const Test = () => {
            throw new Error("Oh no");
        };

        render(<Test />, { stdout });

        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });
        await new Promise<void>((resolve) => {
            setImmediate(resolve);
        });

        expect(unhandledRejectionReasons.length).toBe(0);
    } finally {
        process.off("unhandledRejection", onUnhandledRejection);
    }
});

it("ErrorBoundary catches and displays nested component errors", () => {
    const stdout = createStdout();

    const NestedComponent = () => {
        throw new Error("Nested component error");
    };

    function Parent() {
        return (
            <Text>
                Before error
                <NestedComponent />
            </Text>
        );
    }

    render(<Parent />, { stdout });

    const writes: string[] = (stdout.write as any).mock.calls
        .map((c: any) => c[0] as string)
        .filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
    const lastContentWrite = writes.at(-1)!;
    const output = stripAnsi(lastContentWrite);
    expect(output.includes("ERROR")).toBe(true);
    expect(output.includes("Nested component error")).toBe(true);
});

it("clean up raw mode when error is thrown", async () => {
    const stdout = createStdout();

    const setRawModeCalls: boolean[] = [];
    const originalSetRawMode = process.stdin.setRawMode?.bind(process.stdin);

    if (!process.stdin.isTTY) {
        expect(true).toBe(true); // Skipping test - stdin is not a TTY
        return;
    }

    process.stdin.setRawMode = (mode: boolean) => {
        setRawModeCalls.push(mode);
        return originalSetRawMode?.(mode) ?? process.stdin;
    };

    function Test() {
        const { setRawMode } = useStdin();

        useEffect(() => {
            setRawMode(true);
            throw new Error("Error after raw mode enabled");
        }, [setRawMode]);

        return <Text>Test</Text>;
    }

    const app = render(<Test />, { stdout });

    await expect(app.waitUntilExit()).rejects.toThrow();

    if (originalSetRawMode) {
        process.stdin.setRawMode = originalSetRawMode;
    }

    expect(setRawModeCalls.includes(true)).toBe(true);
    expect(setRawModeCalls.includes(false)).toBe(true);
});
