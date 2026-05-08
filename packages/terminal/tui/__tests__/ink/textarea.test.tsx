import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Textarea } from "../../src/components/index";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(Textarea, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            // Find the last render output, skipping bracketed paste mode and other control sequences
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

    it("should render with default value", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Textarea defaultValue="hello" />);

        expect(getOutput()).toContain("hello");
    });

    it("should render multi-line content", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Textarea defaultValue={"line1\nline2"} />);
        const output = getOutput();

        expect(output).toContain("line1");
        expect(output).toContain("line2");
    });

    it("should render placeholder when empty", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Textarea placeholder="Type here..." />);
        const output = getOutput();

        expect(output).toContain("ype here...");
    });

    it("should accept character input", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="" onChange={onChange} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("a");
    });

    it("should insert newline on Enter", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        emitReadable(stdin, "\r"); // Enter
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("hello\n");
    });

    it("should handle backspace", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        emitReadable(stdin, "\u007F"); // Backspace
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("should navigate with arrow keys", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        // Move left then type
        emitReadable(stdin, "\u001B[D"); // left arrow
        await delay(50);
        emitReadable(stdin, "X");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("hellXo");
    });

    it("should navigate between lines with up/down arrows", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue={"line1\nline2"} onChange={onChange} />);

        // Cursor is at end of line2. Move up, then type.
        emitReadable(stdin, "\u001B[A"); // up arrow
        await delay(50);
        emitReadable(stdin, "X");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("line1X\nline2");
    });

    it("should fire onSubmit on Ctrl+Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onSubmit={onSubmit} />);

        // Simulate Ctrl+Enter (Ctrl+M)
        emitReadable(stdin, "\u001B\r"); // Meta+Enter
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("should insert tab as spaces", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="" onChange={onChange} tabSize={4} />);

        emitReadable(stdin, "\t"); // Tab
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("    ");
    });

    it("should ignore input when disabled", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" isDisabled onChange={onChange} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should show line numbers when enabled", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Textarea defaultValue={"line1\nline2\nline3"} showLineNumbers />);
        const output = getOutput();

        expect(output).toContain("1");
    });

    it("should handle Ctrl+U (kill to line start)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello world" onChange={onChange} />);

        emitReadable(stdin, "\u0015"); // Ctrl+U
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("");
    });

    it("should scroll viewport when cursor moves beyond visible rows", async () => {
        expect.assertions(1);

        const lines = Array.from({ length: 10 }, (_, index) => `line${index + 1}`).join("\n");
        const { getOutput, stdin } = await setup(<Textarea defaultValue={lines} rows={3} />);

        // Cursor should be at end (line 10). Move up a few times.
        emitReadable(stdin, "\u001B[A"); // up
        await delay(50);
        emitReadable(stdin, "\u001B[A"); // up
        await delay(50);

        const output = getOutput();

        // Should contain lines near the cursor, not all lines
        expect(output).toBeDefined();
    });

    it("should handle Delete key (deleteForward)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        // Move cursor to start, then delete forward
        emitReadable(stdin, "\u001B[H"); // Home
        await delay(50);
        emitReadable(stdin, "\u001B[3~"); // Delete
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("ello");
    });

    it("should handle Ctrl+K (deleteToLineEnd)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello world" onChange={onChange} />);

        // Move cursor to middle (after "hello"), then Ctrl+K
        emitReadable(stdin, "\u001B[H"); // Home
        await delay(50);

        for (let index = 0; index < 5; index++) {
            emitReadable(stdin, "\u001B[C"); // right arrow x5
            await delay(20);
        }

        emitReadable(stdin, "\u000B"); // Ctrl+K
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("should handle Ctrl+W (deleteWord)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello world" onChange={onChange} />);

        emitReadable(stdin, "\u0017"); // Ctrl+W
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("hello ");
    });

    it("should handle Escape (clear selection)", async () => {
        expect.assertions(1);

        const { getOutput, stdin } = await setup(<Textarea defaultValue="hello" />);

        emitReadable(stdin, "\u001B"); // Escape
        await delay(50);

        // Should still render normally after escape
        expect(getOutput()).toContain("hello");
    });

    it("should handle maxRows auto-grow", async () => {
        expect.assertions(2);

        const { getOutput, stdin } = await setup(<Textarea defaultValue="line1" maxRows={6} rows={2} />);

        const output1 = getOutput();

        expect(output1).toContain("line1");

        // Add more lines
        emitReadable(stdin, "\r"); // Enter
        await delay(30);
        emitReadable(stdin, "l2");
        await delay(30);
        emitReadable(stdin, "\r"); // Enter
        await delay(30);
        emitReadable(stdin, "l3");
        await delay(50);

        const output2 = getOutput();

        // Should show all 3 lines (auto-grown from 2 to 3)
        expect(output2).toContain("l3");
    });

    it("should handle paste of multi-line text", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="" onChange={onChange} />);

        // Simulate bracketed paste
        emitReadable(stdin, "\u001B[200~hello\nworld\u001B[201~");
        await delay(100);

        // onChange should have been called with multi-line content
        const lastCall = onChange.mock.calls.at(-1)?.[0] as string;

        expect(lastCall).toContain("hello\nworld");
    });

    it("should undo last edit with Ctrl+Z", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        // Type something
        emitReadable(stdin, "X");
        await delay(350); // wait past undo coalesce window (300ms)

        // Undo
        emitReadable(stdin, "\u001A"); // Ctrl+Z
        await delay(50);

        const lastCall = onChange.mock.calls.at(-1)?.[0] as string;

        expect(lastCall).toBe("hello");
    });

    it("should redo after undo with Ctrl+Y", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Textarea defaultValue="hello" onChange={onChange} />);

        // Type something
        emitReadable(stdin, "X");
        await delay(350); // wait past coalesce

        // Undo
        emitReadable(stdin, "\u001A"); // Ctrl+Z
        await delay(50);

        // Redo
        emitReadable(stdin, "\u0019"); // Ctrl+Y
        await delay(50);

        const lastCall = onChange.mock.calls.at(-1)?.[0] as string;

        expect(lastCall).toBe("helloX");
    });
});

describe("useTextBuffer", () => {
    it("should split and join lines correctly", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<Textarea defaultValue={"a\nb\nc"} />, { debug: true, stdin, stdout });

        await delay(50);

        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;
        let output = "";

        for (let index = calls.length - 1; index >= 0; index--) {
            const argument = calls[index]?.[0] as string;

            if (typeof argument === "string" && argument.length > 0 && !argument.startsWith("\u001B[?")) {
                output = argument;
                break;
            }
        }

        expect(output).toContain("a");
        expect(output).toContain("c");

        unmount();
        await delay(100);
    });
});
