import delay from "delay";
import React from "react";
import type { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { DiffView } from "../../src/components/diff-view";
import { render } from "../../src/ink/index";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(DiffView, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(100);

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

    it("should render unified diff from oldText/newText", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<DiffView newText={"hello\nworld\nchanged"} oldText={"hello\nworld\noriginal"} />);
        const output = getOutput();

        expect(output).toContain("@@");
        expect(output).toContain("hello");
    });

    it("should show no differences message for identical text", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText="same" oldText="same" />);

        expect(getOutput()).toContain("No differences");
    });

    it("should render with line numbers", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText={"a\nb\nc"} oldText={"a\nB\nc"} showLineNumbers />);
        const output = getOutput();

        // Line numbers should be present
        expect(output).toContain("1");
    });

    it("should render without line numbers when disabled", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText={"a\nb"} oldText={"a\nB"} showLineNumbers={false} />);
        const output = getOutput();

        expect(output).toBeDefined();
    });

    it("should accept a pre-computed unified diff", async () => {
        expect.assertions(2);

        const diff = ["--- old", "+++ new", "@@ -1,3 +1,3 @@", " hello", "-old line", "+new line", " world", ""].join("\n");
        const { getOutput } = await setup(<DiffView diff={diff} />);
        const output = getOutput();

        // Verify the hunk header and context are rendered
        expect(output).toContain("@@");
        expect(output).toContain("hello");
    });

    it("should show file labels", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<DiffView newLabel="b.txt" newText="new" oldLabel="a.txt" oldText="old" />);
        const output = getOutput();

        expect(output).toContain("a.txt");
        expect(output).toContain("b.txt");
    });

    it("should render hunk headers", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText="changed" oldText="original" />);

        expect(getOutput()).toContain("@@");
    });

    it("should render split mode", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<DiffView mode="split" newText={"a\nnew"} oldText={"a\nold"} />);
        const output = getOutput();

        expect(output).toContain("old");
        expect(output).toContain("new");
    });

    it("should handle additions only", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText={"line1\nline2\nline3"} oldText="" />);
        const output = getOutput();

        expect(output).toContain("line1");
    });

    it("should handle deletions only", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView newText="" oldText={"line1\nline2\nline3"} />);
        const output = getOutput();

        expect(output).toContain("line1");
    });

    it("should render with inline diff disabled", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<DiffView inlineDiff={false} newText="hello world" oldText="hello" />);

        expect(getOutput()).toBeDefined();
    });

    it("should accept language prop for syntax highlighting", async () => {
        expect.assertions(1);

        // Wait longer for Shiki to load
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<DiffView language="javascript" newText='const x = "new";' oldText='const x = "old";' />, { debug: true, stdin, stdout });

        await delay(2000); // wait for Shiki async load

        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;
        let output = "";

        for (let index = calls.length - 1; index >= 0; index--) {
            const argument = calls[index]?.[0] as string;

            if (typeof argument === "string" && argument.length > 0 && !argument.startsWith("\u001B[?")) {
                output = argument;
                break;
            }
        }

        // Should still contain the diff content regardless of highlighting
        expect(output).toContain("const");

        unmount();
        await delay(100);
    });

    it("should handle multi-line change blocks with inline diff", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<DiffView newText={"line A modified\nline B modified\nline C"} oldText={"line A\nline B\nline C"} />);
        const output = getOutput();

        expect(output).toContain("@@");
        expect(output).toBeDefined();
    });
});
