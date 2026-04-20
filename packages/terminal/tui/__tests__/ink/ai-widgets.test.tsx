import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    ApprovalPrompt,
    BlinkDot,
    CommandBlock,
    MessageBubble,
    ModelBadge,
    OperationTree,
    render,
    ShimmerText,
    StatusLine,
    StreamingText,
    Text,
} from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";
import waitFor from "../helpers/wait-for";

let currentUnmount: (() => void) | undefined;

const mount = async (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    currentUnmount = unmount;

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    // Wait until the component has produced output, then give useEffect
    // time to attach stdin listeners (setRawMode + useInput).
    await waitFor(() => getOutput().length > 0);
    await delay(50);

    return { getOutput, stdin };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    // Give Ink's unmount a full microtask cycle to flush stdin listeners and release
    // focus. A shorter delay lets residual focus state leak into the next test when
    // the suite is run alongside other input-driven test files.
    await delay(100);
});

describe(MessageBubble, () => {
    it("should render body content", () => {
        expect.assertions(1);

        const output = renderToString(<MessageBubble>I'll fix the bug.</MessageBubble>);

        expect(output).toContain("I'll fix the bug.");
    });

    it("should render label and meta in the header", () => {
        expect.assertions(2);

        const output = renderToString(
            <MessageBubble label="Claude" meta="10:00">
                <Text>Hello</Text>
            </MessageBubble>,
        );

        expect(output).toContain("Claude");
        expect(output).toContain("10:00");
    });

    it("should render without a border in flat mode", () => {
        expect.assertions(1);

        const output = renderToString(<MessageBubble flat>plain text</MessageBubble>);

        expect(output).toContain("plain text");
    });
});

describe(StreamingText, () => {
    it("should render only the cursor on the initial paint", () => {
        expect.assertions(2);

        const output = renderToString(<StreamingText interval={10} text="Hello" />);

        expect(output).not.toContain("Hello");
        expect(output).toContain("▊");
    });

    it("should accept a custom cursor character", () => {
        expect.assertions(1);

        const output = renderToString(<StreamingText cursor="█" interval={10} text="Hi" />);

        expect(output).toContain("█");
    });
});

describe(OperationTree, () => {
    it("should render nodes with their status icons", () => {
        expect.assertions(3);

        const output = renderToString(
            <OperationTree
                nodes={[
                    { id: "1", label: "Reading auth.ts", status: "completed" },
                    { id: "2", label: "Editing code", status: "running" },
                    { id: "3", label: "Running tests", status: "pending" },
                ]}
                showSpinner={false}
            />,
        );

        expect(output).toContain("Reading auth.ts");
        expect(output).toContain("✔");
        expect(output).toContain("○");
    });

    it("should render nested children with indentation", () => {
        expect.assertions(2);

        const output = renderToString(
            <OperationTree
                nodes={[
                    {
                        children: [
                            { id: "1a", label: "Child A", status: "completed" },
                            { id: "1b", label: "Child B", status: "completed" },
                        ],
                        id: "1",
                        label: "Parent",
                        status: "completed",
                    },
                ]}
                showSpinner={false}
            />,
        );

        expect(output).toContain("Child A");
        expect(output).toContain("├─");
    });

    it("should render durations for nodes that provide them", () => {
        expect.assertions(1);

        const output = renderToString(<OperationTree nodes={[{ durationMs: 120, id: "1", label: "Fast", status: "completed" }]} showSpinner={false} />);

        expect(output).toContain("120ms");
    });
});

describe(ApprovalPrompt, () => {
    it("should render tool, risk label, params and prompt", async () => {
        expect.assertions(4);

        const { getOutput } = await mount(<ApprovalPrompt onDecision={vi.fn()} params={{ path: "auth.ts" }} risk="medium" tool="writeFile" />);

        const output = getOutput();

        expect(output).toContain("writeFile");
        expect(output).toContain("MEDIUM RISK");
        expect(output).toContain("path=");
        expect(output).toContain("Allow?");
    });

    it("should resolve to allow-once on y or Enter", async () => {
        expect.assertions(1);

        const onDecision = vi.fn();
        const { stdin } = await mount(<ApprovalPrompt onDecision={onDecision} tool="writeFile" />);

        emitReadable(stdin, "y");
        await waitFor(() => onDecision.mock.calls.length > 0);

        expect(onDecision).toHaveBeenCalledWith("allow-once");
    });

    it("should resolve to allow-always on a", async () => {
        expect.assertions(1);

        const onDecision = vi.fn();
        const { stdin } = await mount(<ApprovalPrompt onDecision={onDecision} tool="writeFile" />);

        emitReadable(stdin, "a");
        await waitFor(() => onDecision.mock.calls.length > 0);

        expect(onDecision).toHaveBeenCalledWith("allow-always");
    });

    it("should resolve to deny on n", async () => {
        expect.assertions(1);

        const onDecision = vi.fn();
        const { stdin } = await mount(<ApprovalPrompt onDecision={onDecision} tool="writeFile" />);

        emitReadable(stdin, "n");
        await waitFor(() => onDecision.mock.calls.length > 0);

        expect(onDecision).toHaveBeenCalledWith("deny");
    });
});

describe(CommandBlock, () => {
    it("should render the command in the header", () => {
        expect.assertions(1);

        const output = renderToString(<CommandBlock command="git status" status="running" />);

        expect(output).toContain("git status");
    });

    it("should render output with success marker", () => {
        expect.assertions(2);

        const output = renderToString(<CommandBlock command="echo hi" exitCode={0} output="hi" status="success" />);

        expect(output).toContain("hi");
        expect(output).toContain("✔");
    });

    it("should render exit code in red on error", () => {
        expect.assertions(2);

        const output = renderToString(<CommandBlock command="false" exitCode={1} status="error" />);

        expect(output).toContain("exit");
        expect(output).toContain("1");
    });

    it("should truncate output beyond maxOutputRows", () => {
        expect.assertions(1);

        const lines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
        const output = renderToString(<CommandBlock command="seq 20" maxOutputRows={5} output={lines} status="success" />);

        expect(output).toContain("more line");
    });
});

describe(ShimmerText, () => {
    it("should render the text content", () => {
        expect.assertions(1);

        const output = renderToString(<ShimmerText interval={100} text="Generating" />);

        // ShimmerText emits per-character styling (each glyph gets its own color/bold
        // wrapper), so the literal substring is interrupted by ANSI escapes. Strip
        // them before the substring check.
        expect(stripAnsi(output)).toContain("Generating");
    });

    it("should render nothing extra for empty text", () => {
        expect.assertions(1);

        const output = renderToString(<ShimmerText text="" />);

        expect(output).toBe("");
    });
});

describe(ModelBadge, () => {
    it("should render the model name", () => {
        expect.assertions(1);

        const output = renderToString(<ModelBadge model="claude-opus-4" />);

        expect(output).toContain("claude-opus-4");
    });

    it("should include the provider when given", () => {
        expect.assertions(2);

        const output = renderToString(<ModelBadge model="claude-opus-4" provider="anthropic" />);

        expect(output).toContain("anthropic");
        expect(output).toContain("claude-opus-4");
    });

    it("should render outline variant with a border", () => {
        expect.assertions(2);

        const output = renderToString(<ModelBadge model="claude-opus-4" variant="outline" />);

        expect(output).toContain("claude-opus-4");
        expect(output).toMatch(/[╭╮╯╰]/);
    });
});

describe(BlinkDot, () => {
    it("should render a dot character on first paint", () => {
        expect.assertions(1);

        const output = renderToString(<BlinkDot />);

        expect(output).toContain("●");
    });

    it("should respect a custom character", () => {
        expect.assertions(1);

        const output = renderToString(<BlinkDot character="◉" isActive={false} />);

        expect(output).toContain("◉");
    });
});

describe(StatusLine, () => {
    it("should render left, center, and right slots", () => {
        expect.assertions(3);

        const output = renderToString(<StatusLine center="center-slot" left="left-slot" right="right-slot" />, { columns: 60 });

        expect(output).toContain("left-slot");
        expect(output).toContain("center-slot");
        expect(output).toContain("right-slot");
    });
});
