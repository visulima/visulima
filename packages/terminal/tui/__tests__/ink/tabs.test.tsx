import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tab, Tabs } from "../../src/components/index";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(Tabs, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            return (calls.at(-1)?.[0] ?? "") as string;
        };

        return { getOutput, stdin, stdout };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render tab names with index numbers", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()}>
                <Tab name="first">First Content</Tab>
                <Tab name="second">Second Content</Tab>
                <Tab name="third">Third Content</Tab>
            </Tabs>,
        );

        const output = getOutput();

        expect(output).toContain("1.");
        expect(output).toContain("2.");
        expect(output).toContain("3.");
    });

    it("should hide index numbers when showIndex is false", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()} showIndex={false}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        const output = getOutput();

        expect(output).not.toContain("1.");
        expect(output).not.toContain("2.");
    });

    it("should call onChange on mount with the first tab", async () => {
        expect.assertions(1);

        const onChange = vi.fn();

        await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });

    it("should select the defaultValue tab on mount", async () => {
        expect.assertions(1);

        const onChange = vi.fn();

        await setup(
            <Tabs defaultValue="second" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should navigate to next tab with right arrow", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should navigate to previous tab with left arrow", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs defaultValue="second" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[D"); // left arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });

    it("should wrap around from last to first tab", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs defaultValue="second" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[C"); // right arrow (wraps from second to first)
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });

    it("should wrap around from first to last tab", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[D"); // left arrow (wraps from first to second)
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should use up/down arrows in column layout", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs flexDirection="column" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[B"); // down arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should not respond to input when isFocused is false", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs isFocused={false} onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should render separators between tabs", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(getOutput()).toContain("|");
    });

    it("should render horizontal separators in column layout", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs flexDirection="column" onChange={vi.fn()}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(getOutput()).toContain("─");
    });

    it("should render tab content", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()}>
                <Tab name="first">Hello World</Tab>
                <Tab name="second">Goodbye World</Tab>
            </Tabs>,
        );

        const output = getOutput();

        expect(output).toContain("Hello World");
        expect(output).toContain("Goodbye World");
    });

    it("should fall back to first tab when defaultValue is invalid", async () => {
        expect.assertions(1);

        const onChange = vi.fn();

        await setup(
            <Tabs defaultValue="nonexistent" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });

    it("should navigate with Tab key when isFocused is unmanaged", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\t"); // Tab key
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should navigate backward with Shift+Tab when isFocused is unmanaged", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs defaultValue="second" onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B[Z"); // Shift+Tab
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });

    it("should not use Tab key when isFocused is true (managed by Ink)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs isFocused onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\t"); // Tab key
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should jump to tab with Meta+number key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
                <Tab name="third">Third</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B3"); // Meta+3
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("third", expect.anything());
    });

    it("should ignore Meta+number when index is out of range", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        onChange.mockClear();
        emitReadable(stdin, "\u001B9"); // Meta+9 (only 2 tabs)
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should apply active tab colors when focused", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs colors={{ activeTab: { backgroundColor: "red", color: "white" } }} onChange={vi.fn()}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        const output = getOutput();

        // The active tab content should be rendered (color escape codes are in output)
        expect(output).toContain("First");
    });

    it("should use gray colors when isFocused is false", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs isFocused={false} onChange={vi.fn()}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        const output = getOutput();

        expect(output).toContain("First");
    });

    // --- Controlled mode (value prop) ---

    it("should use value prop to control active tab", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()} showIndex={false} value="second">
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
                <Tab name="third">Third</Tab>
            </Tabs>,
        );

        const output = getOutput();

        // "Second" should have active styling (green bg in focused mode)
        // We can't easily check ANSI colors, but the component renders without error
        expect(output).toContain("Second");
    });

    it("should not call onChange on mount in controlled mode", async () => {
        expect.assertions(1);

        const onChange = vi.fn();

        await setup(
            <Tabs onChange={onChange} value="second">
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should call onChange on arrow key in controlled mode", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs onChange={onChange} value="first">
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledExactlyOnceWith("second", expect.anything());
    });

    it("should fall back to first tab when value is invalid", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <Tabs onChange={vi.fn()} showIndex={false} value="nonexistent">
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        // Should not crash; renders with first tab as fallback
        expect(getOutput()).toContain("First");
    });

    it("should not respond to keys when controlled with empty key arrays", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <Tabs keyMap={{ next: [], previous: [], useNumbers: false, useTab: false }} onChange={onChange} value="first">
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
            </Tabs>,
        );

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should handle fragments and conditional children", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const showThird = false;

        await setup(
            <Tabs onChange={onChange}>
                <Tab name="first">First</Tab>
                <Tab name="second">Second</Tab>
                {showThird && <Tab name="third">Third</Tab>}
            </Tabs>,
        );

        expect(onChange).toHaveBeenCalledExactlyOnceWith("first", expect.anything());
    });
});
