import delay from "delay";
import React, { useEffect } from "react";
import type { vi } from "vitest";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { useClipboard } from "../../src/ink/hooks/use-clipboard";
import { render } from "../../src/ink/index";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(useClipboard, () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should provide copy function and isSupported flag", async () => {
        // expectTypeOf is compile-time only — only the runtime expect counts here.
        expect.assertions(1);

        let clipboardResult: { copy: (text: string) => void; isSupported: boolean } | undefined;

        const TestComponent = () => {
            clipboardResult = useClipboard();

            return (
                <Box>
                    <Text>test</Text>
                </Box>
            );
        };

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(clipboardResult).toBeDefined();

        expectTypeOf(clipboardResult!.copy).toBeFunction();
    });

    it("should write OSC 52 sequence to stdout when copying", async () => {
        expect.assertions(1);

        const TestComponent = () => {
            const { copy } = useClipboard();

            useEffect(() => {
                copy("hello");
            }, [copy]);

            return (
                <Box>
                    <Text>test</Text>
                </Box>
            );
        };

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
                const argument = call[0] as string;

                return typeof argument === "string" && argument.includes("\u001B]52;c;");
            });

            expect(osc52Call).toBeDefined();
        } finally {
            if (originalTermProgram === undefined) {
                delete process.env["TERM_PROGRAM"];
            } else {
                process.env["TERM_PROGRAM"] = originalTermProgram;
            }
        }
    });
});

describe("clipboard utilities", () => {
    it("isOsc52Supported should detect supported terminals", async () => {
        expect.assertions(1);

        const { isOsc52Supported } = await import("../../src/ink/clipboard");

        const originalTermProgram = process.env["TERM_PROGRAM"];

        process.env["TERM_PROGRAM"] = "kitty";

        expect(isOsc52Supported()).toBe(true);

        process.env["TERM_PROGRAM"] = "unknown-terminal";
        // May or may not be supported depending on other env vars
        const result = isOsc52Supported();

        expectTypeOf(result).toBeBoolean();

        if (originalTermProgram === undefined) {
            delete process.env["TERM_PROGRAM"];
        } else {
            process.env["TERM_PROGRAM"] = originalTermProgram;
        }
    });

    it("writeOsc52 should write correct escape sequence", async () => {
        expect.assertions(1);

        const { writeOsc52 } = await import("../../src/ink/clipboard");
        const { PassThrough } = await import("node:stream");

        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));

        writeOsc52(stream, "hello", "c");

        const output = Buffer.concat(chunks).toString();
        const expectedBase64 = Buffer.from("hello", "utf8").toString("base64");

        expect(output).toBe(`\u001B]52;c;${expectedBase64}\u0007`);
    });

    it("clearOsc52 should write empty payload", async () => {
        expect.assertions(1);

        const { clearOsc52 } = await import("../../src/ink/clipboard");
        const { PassThrough } = await import("node:stream");

        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => chunks.push(chunk));

        clearOsc52(stream, "c");

        const output = Buffer.concat(chunks).toString();

        expect(output).toBe("\u001B]52;c;\u0007");
    });

    it("writeOsc52 should support primary selection target", async () => {
        expect.assertions(1);

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
