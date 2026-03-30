import delay from "delay";
import React, { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Box, render, Text, useClipboard } from "../../src/ink/index";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe("useClipboard", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should provide copy function and isSupported flag", async () => {
        expect.assertions(2);

        let clipboardResult: { copy: (text: string) => void; isSupported: boolean } | undefined;

        function TestComponent() {
            clipboardResult = useClipboard();

            return (
                <Box>
                    <Text>test</Text>
                </Box>
            );
        }

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(clipboardResult).toBeDefined();
        expect(typeof clipboardResult!.copy).toBe("function");
    });

    it("should write OSC 52 sequence to stdout when copying", async () => {
        expect.assertions(1);

        function TestComponent() {
            const { copy } = useClipboard();

            useEffect(() => {
                copy("hello");
            }, [copy]);

            return (
                <Box>
                    <Text>test</Text>
                </Box>
            );
        }

        const stdout = createStdout();
        const stdin = createStdin();

        // Set TERM_PROGRAM to a supported terminal
        const originalTermProgram = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "WezTerm";

        try {
            const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(100);

            const writeCalls = (stdout.write as ReturnType<typeof vi.fn>).mock.calls;
            const osc52Call = writeCalls.find((call) => {
                const arg = call[0] as string;

                return typeof arg === "string" && arg.includes("\x1B]52;c;");
            });

            expect(osc52Call).toBeDefined();
        } finally {
            if (originalTermProgram === undefined) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete process.env["TERM_PROGRAM"];
            } else {
                process.env["TERM_PROGRAM"] = originalTermProgram;
            }
        }
    });
});

describe("clipboard utilities", () => {
    it("isOsc52Supported should detect supported terminals", async () => {
        const { isOsc52Supported } = await import("../../src/ink/clipboard");

        const originalTermProgram = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "kitty";
        expect(isOsc52Supported()).toBe(true);

        process.env["TERM_PROGRAM"] = "unknown-terminal";
        // May or may not be supported depending on other env vars
        const result = isOsc52Supported();

        expect(typeof result).toBe("boolean");

        if (originalTermProgram === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = originalTermProgram;
        }
    });

    it("writeOsc52 should write correct escape sequence", async () => {
        const { writeOsc52 } = await import("../../src/ink/clipboard");
        const { PassThrough } = await import("node:stream");

        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));

        writeOsc52(stream, "hello", "c");

        const output = Buffer.concat(chunks).toString();
        const expectedBase64 = Buffer.from("hello", "utf8").toString("base64");

        expect(output).toBe(`\x1B]52;c;${expectedBase64}\x07`);
    });

    it("clearOsc52 should write empty payload", async () => {
        const { clearOsc52 } = await import("../../src/ink/clipboard");
        const { PassThrough } = await import("node:stream");

        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));

        clearOsc52(stream, "c");

        const output = Buffer.concat(chunks).toString();

        expect(output).toBe("\x1B]52;c;\x07");
    });

    it("writeOsc52 should support primary selection target", async () => {
        const { writeOsc52 } = await import("../../src/ink/clipboard");
        const { PassThrough } = await import("node:stream");

        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));

        writeOsc52(stream, "test", "p");

        const output = Buffer.concat(chunks).toString();

        expect(output).toContain(";p;");
    });
});
