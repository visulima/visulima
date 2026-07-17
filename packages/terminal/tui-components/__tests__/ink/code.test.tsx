import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import type { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { Code } from "../../src/code";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(Code, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element, waitMs = 500) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(waitMs);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            for (let index = calls.length - 1; index >= 0; index--) {
                const argument = calls[index]?.[0] as string;

                if (typeof argument === "string" && argument.length > 0 && !argument.startsWith("\u001B[?")) {
                    return argument;
                }
            }

            return "";
        };

        return { getOutput, stdin, stdout };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render plain code without language", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Code code="const x = 42;" />);

        expect(getOutput()).toContain("const x = 42;");
    });

    it("should render code with line numbers", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Code code={"line1\nline2\nline3"} showLineNumbers />);
        const output = getOutput();

        expect(output).toContain("1");
        expect(output).toContain("line1");
    });

    it("should respect startLine offset", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Code code={"hello\nworld"} showLineNumbers startLine={10} />);
        const output = getOutput();

        expect(output).toContain("10");
    });

    it("should render with syntax highlighting for known languages", async () => {
        expect.assertions(1);

        // Wait longer for Shiki to load
        const { getOutput } = await setup(<Code code='const x = "hello";' language="javascript" />, 2000);
        const output = getOutput();

        // Should contain the code text regardless of highlighting
        expect(output).toContain("const");
    });

    it("should fall back to plain text for unknown languages", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Code code="some code" language="nonexistent-lang-xyz" />);

        expect(getOutput()).toContain("some code");
    });

    it("should handle empty code", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Code code="" />);

        expect(getOutput()).toBeDefined();
    });

    it("should handle multi-line code", async () => {
        expect.assertions(2);

        const code = "function hello() {\n  return 'world';\n}";
        const { getOutput } = await setup(<Code code={code} />);
        const output = getOutput();

        expect(output).toContain("function");
        expect(output).toContain("return");
    });
});
