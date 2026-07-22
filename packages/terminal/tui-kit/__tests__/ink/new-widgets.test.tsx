import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Drawer, Grid, ModelSelector, MultiProgress, NotificationBadge, Popover, Sidebar, ThinkingBlock, TokenUsage, ToolCall } from "../../src/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

const setup = async (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { unmount } = render(jsx, { debug: true, stdin, stdout });

    await delay(50);

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    return { getOutput, stdin, unmount };
};

describe("batch 4 widgets", () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("notification-badge renders a count and abbreviates above max", async () => {
        expect.assertions(1);

        const s = await setup(<NotificationBadge count={150} max={99} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("99+");
    });

    it("notification-badge hides a zero count", async () => {
        expect.assertions(1);

        const s = await setup(<NotificationBadge count={0} />);

        unmount = s.unmount;

        expect(s.getOutput().trim()).toBe("");
    });

    it("token-usage renders input/output split", async () => {
        expect.assertions(1);

        const s = await setup(<TokenUsage input={1200} output={300} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("1.2k");
    });

    it("token-usage renders a context-window percentage", async () => {
        expect.assertions(1);

        const s = await setup(<TokenUsage contextLimit={1000} input={500} output={250} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("75%");
    });

    it("multi-progress renders labels and percentages", async () => {
        expect.assertions(2);

        const s = await setup(
            <MultiProgress
                items={[
                    { label: "build", value: 0.5 },
                    { label: "test", value: 1 },
                ]}
            />,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("build");
        expect(s.getOutput()).toContain("50%");
    });

    it("tool-call renders name, args and status", async () => {
        expect.assertions(2);

        const s = await setup(<ToolCall args={{ path: "src/x.ts" }} name="read_file" status="success" />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("read_file");
        expect(s.getOutput()).toContain("path=src/x.ts");
    });

    it("thinking-block toggles on space", async () => {
        expect.assertions(1);

        const onToggle = vi.fn();
        const s = await setup(
            <ThinkingBlock autoFocus onToggle={onToggle}>
                reasoning here
            </ThinkingBlock>,
        );

        unmount = s.unmount;
        emitReadable(s.stdin, " ");
        await waitFor(() => onToggle.mock.calls.some((call) => call[0] === false));

        expect(onToggle).toHaveBeenCalledWith(false);
    });

    it("model-selector selects the highlighted model on Enter", async () => {
        expect.assertions(1);

        const onSelect = vi.fn();
        const models = [
            { id: "a", name: "Model A" },
            { id: "b", name: "Model B" },
        ];
        const s = await setup(<ModelSelector autoFocus models={models} onSelect={onSelect} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "[B"); // down arrow
        const beforeDown = s.getOutput();

        await waitFor(() => s.getOutput() !== beforeDown);
        emitReadable(s.stdin, "\r");
        await waitFor(() => onSelect.mock.calls.some((call) => call[0] === models[1]));

        expect(onSelect).toHaveBeenCalledWith(models[1]);
    });

    it("grid arranges children into rows", async () => {
        expect.assertions(1);

        const s = await setup(
            <Grid columns={2}>
                <ToolCall name="one" />
                <ToolCall name="two" />
                <ToolCall name="three" />
            </Grid>,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("three");
    });

    it("sidebar renders both panes", async () => {
        expect.assertions(2);

        const s = await setup(
            <Sidebar sidebar={<ToolCall name="nav" />}>
                <ToolCall name="content" />
            </Sidebar>,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("nav");
        expect(s.getOutput()).toContain("content");
    });

    it("drawer renders nothing while closed and its title while open", async () => {
        expect.assertions(2);

        const closed = await setup(
            <Drawer isOpen={false} title="Settings">
                <ToolCall name="x" />
            </Drawer>,
        );

        expect(closed.getOutput().trim()).toBe("");

        closed.unmount();
        await delay(30);

        const open = await setup(
            <Drawer isOpen title="Settings">
                <ToolCall name="x" />
            </Drawer>,
        );

        unmount = open.unmount;

        expect(open.getOutput()).toContain("Settings");
    });

    it("drawer closes on Escape", async () => {
        expect.assertions(1);

        const onClose = vi.fn();
        const s = await setup(
            <Drawer isOpen onClose={onClose} title="Settings">
                <ToolCall name="x" />
            </Drawer>,
        );

        unmount = s.unmount;
        emitReadable(s.stdin, "");
        await delay(50);

        expect(onClose).toHaveBeenCalledWith();
    });

    it("popover shows the anchor always and content when open", async () => {
        expect.assertions(2);

        const s = await setup(
            <Popover anchor={<ToolCall name="trigger" />} isOpen>
                <ToolCall name="floating" />
            </Popover>,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("trigger");
        expect(s.getOutput()).toContain("floating");
    });
});
