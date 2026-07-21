import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SelectInput, SelectInputIndicator, SelectInputItem } from "../../src/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const items = [
    { label: "First", value: "first" },
    { label: "Second", value: "second" },
    { label: "Third", value: "third" },
];

describe(SelectInput, () => {
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

    describe("rendering", () => {
        it("should render a list of items with initialIndex=0", async () => {
            expect.assertions(4);

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={items} />);
            const output = getOutput();

            expect(output).toContain("First");
            expect(output).toContain("Second");
            expect(output).toContain("Third");
            expect(output).toContain("\u276F");
        });

        it("should render with no items", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput items={[]} />);

            expect(getOutput()).not.toContain("First");
        });

        it("should render with initialIndex", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput initialIndex={1} items={items} />);

            expect(getOutput()).toContain("Second");
        });

        it("should clamp initialIndex to last item when out of bounds", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput initialIndex={100} items={items} />);

            expect(getOutput()).toContain("Third");
        });
    });

    describe("no initial selection", () => {
        it("should not highlight any item when initialIndex is omitted", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput items={items} />);

            // No indicator should be shown
            expect(getOutput()).not.toContain("\u276F");
        });

        it("should highlight first item on first down arrow press", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);
        });

        it("should highlight last item on first up arrow press", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Third", value: "third" }, 2);
        });

        it("should ignore Enter when nothing is selected", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput items={items} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).not.toHaveBeenCalled();
        });

        it("should still allow number key selection when nothing is highlighted", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput items={items} onSelect={onSelect} />);

            emitReadable(stdin, "2");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Second", value: "second" });
        });

        it("should navigate normally after first keypress activates selection", async () => {
            expect.assertions(2);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput items={items} onHighlight={onHighlight} />);

            // First press activates at index 0
            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);

            // Second press navigates normally
            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenLastCalledWith({ label: "Second", value: "second" }, 1);
        });
    });

    describe("limit", () => {
        it("should limit the number of visible items", async () => {
            expect.assertions(3);

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={items} limit={2} />);
            const output = getOutput();

            expect(output).toContain("First");
            expect(output).toContain("Second");
            expect(output).not.toContain("Third");
        });

        it("should show all items when limit exceeds item count", async () => {
            expect.assertions(3);

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={items} limit={10} />);
            const output = getOutput();

            expect(output).toContain("First");
            expect(output).toContain("Second");
            expect(output).toContain("Third");
        });

        it("should auto-limit to terminal rows when no limit is specified", async () => {
            expect.assertions(3);

            const fiveItems = [
                { label: "A", value: "a" },
                { label: "B", value: "b" },
                { label: "C", value: "c" },
                { label: "D", value: "d" },
                { label: "E", value: "e" },
            ];

            // Create a stdout with only 3 rows — items should be auto-capped
            const stdout = createStdout(100, true, 3);
            const stdin = createStdin();

            const { unmount } = render(<SelectInput initialIndex={0} items={fiveItems} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            const output = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;

            expect(output).toContain("A");
            expect(output).toContain("B");
            // Only 3 rows — D and E should not be visible
            expect(output).not.toContain("D");
        });

        it("should show all items when terminal has enough rows", async () => {
            expect.assertions(3);

            // Terminal with 100 rows — 3 items should all fit
            const stdout = createStdout(100, true, 100);
            const stdin = createStdin();

            const { unmount } = render(<SelectInput initialIndex={0} items={items} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            const output = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0] as string;

            expect(output).toContain("First");
            expect(output).toContain("Second");
            expect(output).toContain("Third");
        });
    });

    describe("keyboard navigation", () => {
        it("should move selection down with arrow key", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Second", value: "second" }, 1);
        });

        it("should move selection up with arrow key", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={1} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);
        });

        it("should move selection down with j key", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "j");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Second", value: "second" }, 1);
        });

        it("should move selection up with k key", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={1} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "k");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);
        });

        it("should wrap around when pressing down at last item", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={2} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);
        });

        it("should wrap around when pressing up at first item", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Third", value: "third" }, 2);
        });

        it("should select item on Enter", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "First", value: "first" });
        });

        it("should select item by number key", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onSelect={onSelect} />);

            emitReadable(stdin, "2");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Second", value: "second" });
        });

        it("should ignore number key out of range", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} onSelect={onSelect} />);

            emitReadable(stdin, "9");
            await delay(50);

            expect(onSelect).not.toHaveBeenCalled();
        });

        it("should call item action on Enter", async () => {
            expect.assertions(2);

            const action = vi.fn();
            const onSelect = vi.fn();
            const actionItems = [
                { action, label: "First", value: "first" },
                { label: "Second", value: "second" },
            ];

            const { stdin } = await setup(<SelectInput initialIndex={0} items={actionItems} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledTimes(1);
        });

        it("should call item action on number key", async () => {
            expect.assertions(2);

            const action = vi.fn();
            const onSelect = vi.fn();
            const actionItems = [
                { label: "First", value: "first" },
                { action, label: "Second", value: "second" },
            ];

            const { stdin } = await setup(<SelectInput initialIndex={0} items={actionItems} onSelect={onSelect} />);

            emitReadable(stdin, "2");
            await delay(50);

            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledTimes(1);
        });

        it("should work without onSelect when action is defined", async () => {
            expect.assertions(1);

            const action = vi.fn();
            const actionItems = [{ action, label: "First", value: "first" }];

            const { stdin } = await setup(<SelectInput initialIndex={0} items={actionItems} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(action).toHaveBeenCalledTimes(1);
        });

        it("should not respond to input when not focused", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} isFocused={false} items={items} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).not.toHaveBeenCalled();
        });
    });

    describe("limit with keyboard navigation", () => {
        const fiveItems = [
            { label: "A", value: "a" },
            { label: "B", value: "b" },
            { label: "C", value: "c" },
            { label: "D", value: "d" },
            { label: "E", value: "e" },
        ];

        it("should scroll down through items when limit is set", async () => {
            expect.assertions(2);

            const onHighlight = vi.fn();
            const { getOutput, stdin } = await setup(<SelectInput initialIndex={0} items={fiveItems} limit={3} onHighlight={onHighlight} />);

            const initial = getOutput();

            expect(initial).toContain("A");

            emitReadable(stdin, "\u001B[B");
            await delay(50);
            emitReadable(stdin, "\u001B[B");
            await delay(50);
            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledTimes(3);
        });

        it("should scroll up through items when limit is set", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={fiveItems} limit={3} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledTimes(1);
        });
    });

    describe("items change", () => {
        it("should reset selection when items change", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const stdin = createStdin();

            const { rerender, unmount } = render(<SelectInput initialIndex={2} items={items} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            const getOutput = () => {
                const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

                return (calls.at(-1)?.[0] ?? "") as string;
            };

            expect(getOutput()).toContain("Third");

            const newItems = [
                { label: "Alpha", value: "alpha" },
                { label: "Beta", value: "beta" },
            ];

            rerender(<SelectInput initialIndex={0} items={newItems} />);
            await delay(50);

            expect(getOutput()).toContain("Alpha");
        });

        it("should not reset selection when items reference changes but values are equal", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const stdout = createStdout();
            const stdin = createStdin();

            const { rerender, unmount } = render(<SelectInput initialIndex={0} items={items} onHighlight={onHighlight} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            const sameItems = [
                { label: "First", value: "first" },
                { label: "Second", value: "second" },
                { label: "Third", value: "third" },
            ];

            rerender(<SelectInput initialIndex={0} items={sameItems} onHighlight={onHighlight} />);
            await delay(50);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenLastCalledWith({ label: "Third", value: "third" }, 2);
        });

        it("should reset to no-selection state when items change and no initialIndex", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const stdin = createStdin();

            const { rerender, unmount } = render(<SelectInput initialIndex={1} items={items} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            const getOutput = () => {
                const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

                return (calls.at(-1)?.[0] ?? "") as string;
            };

            expect(getOutput()).toContain("\u276F");

            const newItems = [
                { label: "Alpha", value: "alpha" },
                { label: "Beta", value: "beta" },
            ];

            // Re-render without initialIndex — should reset to no selection
            rerender(<SelectInput items={newItems} />);
            await delay(50);

            expect(getOutput()).not.toContain("\u276F");
        });

        it("should preserve selection when resetOnItemsChange is false", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const stdout = createStdout();
            const stdin = createStdin();

            const { rerender, unmount } = render(<SelectInput initialIndex={1} items={items} onSelect={onSelect} resetOnItemsChange={false} />, {
                debug: true,
                stdin,
                stdout,
            });

            currentUnmount = unmount;
            await delay(50);

            // Change items entirely — selection should NOT reset because resetOnItemsChange=false
            const newItems = [
                { label: "Alpha", value: "alpha" },
                { label: "Beta", value: "beta" },
                { label: "Gamma", value: "gamma" },
            ];

            rerender(<SelectInput items={newItems} onSelect={onSelect} resetOnItemsChange={false} />);
            await delay(50);

            // Press Enter — should select at the preserved index (1), which is now "Beta"
            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Beta", value: "beta" });
        });
    });

    describe("controlled index", () => {
        it("should select the item at the controlled index", async () => {
            expect.assertions(2);

            const stdout = createStdout();
            const stdin = createStdin();

            const { rerender, unmount } = render(<SelectInput index={2} items={items} />, { debug: true, stdin, stdout });

            currentUnmount = unmount;
            await delay(50);

            const getOutput = () => {
                const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

                return (calls.at(-1)?.[0] ?? "") as string;
            };

            expect(getOutput()).toContain("Third");

            rerender(<SelectInput index={0} items={items} />);
            await delay(50);

            expect(getOutput()).toContain("First");
        });

        it("should ignore initialIndex when index is provided", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput index={2} initialIndex={0} items={items} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Third", value: "third" });
        });

        it("should pass highlighted index as second argument to onHighlight", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={items} limit={2} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledExactlyOnceWith({ label: "Second", value: "second" }, 1);
        });
    });

    describe("custom components", () => {
        it("should render with a custom indicator component", async () => {
            expect.assertions(1);

            const CustomIndicator = ({ isSelected }: { isSelected?: boolean }) => (
                <Box marginRight={1}>
                    <Text>{isSelected ? ">>>" : "   "}</Text>
                </Box>
            );

            const { getOutput } = await setup(<SelectInput indicatorComponent={CustomIndicator} initialIndex={0} items={items} />);

            expect(getOutput()).toContain(">>>");
        });

        it("should render with a custom item component", async () => {
            expect.assertions(1);

            const CustomItem = ({ isSelected, label }: { isSelected?: boolean; label: string }) => <Text>{isSelected ? `[${label}]` : label}</Text>;

            const { getOutput } = await setup(<SelectInput initialIndex={0} itemComponent={CustomItem} items={items} />);

            expect(getOutput()).toContain("[First]");
        });
    });

    describe("color props", () => {
        it("should apply accentColor to selected item and indicator", async () => {
            expect.assertions(2);

            const { getOutput } = await setup(<SelectInput accentColor="red" initialIndex={0} items={items} />);
            const output = getOutput();

            expect(output).toContain("\u276F");
            expect(output).toContain("First");
        });

        it("should apply defaultColor to unselected items", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput defaultColor="gray" initialIndex={0} items={items} />);

            expect(getOutput()).toContain("Second");
        });

        it("should pass accentColor to custom indicator component", async () => {
            expect.assertions(1);

            const CustomIndicator = ({ accentColor, isSelected }: { accentColor?: string; isSelected?: boolean }) => (
                <Text>{isSelected ? `[${accentColor}]` : " "}</Text>
            );

            const { getOutput } = await setup(<SelectInput accentColor="green" indicatorComponent={CustomIndicator} initialIndex={0} items={items} />);

            expect(getOutput()).toContain("[green]");
        });

        it("should pass defaultColor and accentColor to custom item component", async () => {
            expect.assertions(2);

            const CustomItem = ({
                accentColor,
                defaultColor,
                isSelected,
                label,
            }: {
                accentColor?: string;
                defaultColor?: string;
                isSelected?: boolean;
                label: string;
            }) => <Text>{isSelected ? `${label}:${accentColor}` : `${label}:${defaultColor}`}</Text>;

            const { getOutput } = await setup(<SelectInput accentColor="red" defaultColor="gray" initialIndex={0} itemComponent={CustomItem} items={items} />);
            const output = getOutput();

            expect(output).toContain("First:red");
            expect(output).toContain("Second:gray");
        });
    });

    describe("focus dimming", () => {
        it("should dim selected indicator when unfocused", async () => {
            expect.assertions(2);

            const { getOutput } = await setup(<SelectInput initialIndex={0} isFocused={false} items={items} />);
            const output = getOutput();

            // Still renders the indicator and items
            expect(output).toContain("\u276F");
            expect(output).toContain("First");
        });

        it("should pass isFocused to custom indicator component", async () => {
            expect.assertions(1);

            const CustomIndicator = ({ isFocused, isSelected }: { isFocused?: boolean; isSelected?: boolean }) => (
                <Text>{isSelected ? (isFocused ? "FOCUSED" : "DIMMED") : " "}</Text>
            );

            const { getOutput } = await setup(<SelectInput indicatorComponent={CustomIndicator} initialIndex={0} isFocused={false} items={items} />);

            expect(getOutput()).toContain("DIMMED");
        });

        it("should pass isFocused to custom item component", async () => {
            expect.assertions(1);

            const CustomItem = ({ isFocused, isSelected, label }: { isFocused?: boolean; isSelected?: boolean; label: string }) => (
                <Text>{isSelected ? `${label}:${isFocused ? "on" : "off"}` : label}</Text>
            );

            const { getOutput } = await setup(<SelectInput initialIndex={0} isFocused={false} itemComponent={CustomItem} items={items} />);

            expect(getOutput()).toContain("First:off");
        });
    });

    describe("sub-components", () => {
        it("should render SelectInputIndicator as selected", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputIndicator isSelected />);

            expect(output).toContain("\u276F");
        });

        it("should render SelectInputIndicator as not selected", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputIndicator />);

            expect(output).not.toContain("\u276F");
        });

        it("should render SelectInputIndicator with custom accentColor", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputIndicator accentColor="red" isSelected />);

            expect(output).toContain("\u276F");
        });

        it("should render SelectInputItem as selected", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputItem isSelected label="Test" />);

            expect(output).toContain("Test");
        });

        it("should render SelectInputItem as not selected", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputItem label="Test" />);

            expect(output).toContain("Test");
        });

        it("should render SelectInputItem with custom colors", () => {
            expect.assertions(1);

            const output = renderToString(<SelectInputItem accentColor="red" defaultColor="gray" isSelected label="Test" />);

            expect(output).toContain("Test");
        });
    });

    describe("separators", () => {
        const separatorItems = [
            { label: "First", value: "first" },
            { isSeparator: true as const },
            { label: "Second", value: "second" },
            { label: "Third", value: "third" },
        ];

        it("should render separator with default label", async () => {
            expect.assertions(1);

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={separatorItems} />);

            expect(getOutput()).toContain("───");
        });

        it("should render separator with custom label", async () => {
            expect.assertions(1);

            const customSeparatorItems = [
                { label: "A", value: "a" },
                { isSeparator: true as const, label: "--- options ---" },
                { label: "B", value: "b" },
            ];

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={customSeparatorItems} />);

            expect(getOutput()).toContain("--- options ---");
        });

        it("should skip separator when navigating down", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={separatorItems} onHighlight={onHighlight} />);

            // Down from First should skip separator and land on Second
            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Second", value: "second" }, 2);
        });

        it("should skip separator when navigating up", async () => {
            expect.assertions(1);

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={2} items={separatorItems} onHighlight={onHighlight} />);

            // Up from Second should skip separator and land on First
            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "First", value: "first" }, 0);
        });

        it("should not select separator via number key", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={separatorItems} onSelect={onSelect} />);

            // Key "2" targets index 1 which is a separator
            emitReadable(stdin, "2");
            await delay(50);

            expect(onSelect).not.toHaveBeenCalled();
        });

        it("should not render indicator for separator", async () => {
            expect.assertions(2);

            const { getOutput } = await setup(<SelectInput initialIndex={0} items={separatorItems} />);
            const output = getOutput();

            // Should have indicator for First (selected), but separator should not have one
            expect(output).toContain("\u276F");
            expect(output).toContain("───");
        });

        it("should skip multiple consecutive separators", async () => {
            expect.assertions(1);

            const multiSeparatorItems = [
                { label: "A", value: "a" },
                { isSeparator: true as const },
                { isSeparator: true as const },
                { label: "B", value: "b" },
            ];

            const onHighlight = vi.fn();
            const { stdin } = await setup(<SelectInput initialIndex={0} items={multiSeparatorItems} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "B", value: "b" }, 3);
        });

        it("should skip separator when initialIndex points to one", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            // Index 1 is a separator — should resolve to index 2 (Second)
            const { stdin } = await setup(<SelectInput initialIndex={1} items={separatorItems} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Second", value: "second" });
        });

        it("should skip separator when controlled index points to one", async () => {
            expect.assertions(1);

            const onSelect = vi.fn();
            // index=1 is a separator — should resolve to nearest selectable
            const { stdin } = await setup(<SelectInput index={1} items={separatorItems} onSelect={onSelect} />);

            emitReadable(stdin, "\r");
            await delay(50);

            expect(onSelect).toHaveBeenCalledWith({ label: "Second", value: "second" });
        });

        it("should handle all-separator list without crashing", async () => {
            expect.assertions(2);

            const allSeparators = [{ isSeparator: true as const }, { isSeparator: true as const }];
            const onHighlight = vi.fn();
            const onSelect = vi.fn();

            const { stdin } = await setup(<SelectInput items={allSeparators} onHighlight={onHighlight} onSelect={onSelect} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);
            emitReadable(stdin, "\r");
            await delay(50);

            expect(onHighlight).not.toHaveBeenCalled();
            expect(onSelect).not.toHaveBeenCalled();
        });

        it("should handle single selectable item with wrap-around", async () => {
            expect.assertions(2);

            const singleItem = [{ label: "Only", value: "only" }];
            const onHighlight = vi.fn();

            const { stdin } = await setup(<SelectInput initialIndex={0} items={singleItem} onHighlight={onHighlight} />);

            emitReadable(stdin, "\u001B[B");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledWith({ label: "Only", value: "only" }, 0);

            emitReadable(stdin, "\u001B[A");
            await delay(50);

            expect(onHighlight).toHaveBeenCalledTimes(2);
        });
    });
});
