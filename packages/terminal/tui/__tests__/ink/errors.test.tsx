import process from "node:process";

import { strip as stripAnsi } from "@visulima/ansi";
import patchConsole from "patch-console";
import { useEffect } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Text } from "../../src/components/index";
import { useStdin } from "../../src/ink/hooks/use-stdin";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

const ERROR_LOCATION_RE = /errors\.test\.tsx:\d+:\d+/u;
const ERROR_COMPONENT_RE = /Test.*errors\.test\.tsx:\d+:\d+/u;

let restore = () => {};

describe("errors", () => {
    beforeAll(() => {
        restore = patchConsole(() => {});
    });

    afterAll(() => {
        restore();
    });

    it("catch and display error", () => {
        expect.assertions(4);

        const stdout = createStdout();

        const Test = () => {
            throw new Error("Oh no");
        };

        render(<Test />, { stdout });

        const writes: string[] = (stdout.write as any).mock.calls.map((c: any) => c[0] as string).filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
        const lastContentWrite = writes.at(-1)!;

        const lines = stripAnsi(lastContentWrite).split("\n");

        expect(lines[1]).toBe("  ERROR  Oh no");
        expect(lines[3]).toMatch(ERROR_LOCATION_RE);
        expect(lines.some((l: string) => l.includes("throw new Error") && l.includes("Oh no"))).toBe(true);
        expect(lines.some((l: string) => ERROR_COMPONENT_RE.test(l))).toBe(true);
    });

    it("does not emit unhandledRejection when render exits with an error and waitUntilExit is unused", async () => {
        expect.assertions(1);

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

            expect(unhandledRejectionReasons).toHaveLength(0);
        } finally {
            process.off("unhandledRejection", onUnhandledRejection);
        }
    });

    it("errorBoundary catches and displays nested component errors", () => {
        expect.assertions(2);

        const stdout = createStdout();

        const NestedComponent = () => {
            throw new Error("Nested component error");
        };

        const Parent = () => (
            <Text>
                Before error
                <NestedComponent />
            </Text>
        );

        render(<Parent />, { stdout });

        const writes: string[] = (stdout.write as any).mock.calls.map((c: any) => c[0] as string).filter((w: string) => !w.startsWith("\u001B[?25") && !w.startsWith("\u001B[?2026"));
        const lastContentWrite = writes.at(-1)!;
        const output = stripAnsi(lastContentWrite);

        expect(output).toContain("ERROR");
        expect(output).toContain("Nested component error");
    });

    it("clean up raw mode when error is thrown", async () => {
        expect.assertions(1);

        const stdout = createStdout();

        const setRawModeCalls: boolean[] = [];

        if (!process.stdin.isTTY) {
            expect(true).toBe(true); // Skipping test - stdin is not a TTY

            return;
        }

        const originalSetRawMode = process.stdin.setRawMode.bind(process.stdin);

        process.stdin.setRawMode = (mode: boolean) => {
            setRawModeCalls.push(mode);

            return originalSetRawMode(mode);
        };

        const Test = () => {
            const { setRawMode } = useStdin();

            useEffect(() => {
                setRawMode(true);
                throw new Error("Error after raw mode enabled");
            }, [setRawMode]);

            return <Text>Test</Text>;
        };

        const app = render(<Test />, { stdout });

        await expect(app.waitUntilExit()).rejects.toThrow("Error after raw mode enabled");

        process.stdin.setRawMode = originalSetRawMode;

        expect(setRawModeCalls).toContain(true);
        expect(setRawModeCalls).toContain(false);
    });
});
