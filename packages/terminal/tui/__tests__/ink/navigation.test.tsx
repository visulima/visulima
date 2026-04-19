import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandPalette, ContentSwitcher, Menu, OptionList, render, Text, Tooltip } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";
import waitFor from "../helpers/wait-for";

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

    return { getOutput, stdin };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    await delay(30);
});

describe(Menu, () => {
    const items = [
        { hotkey: "Ctrl+N", id: "new", label: "New file" },
        { hotkey: "Ctrl+O", id: "open", label: "Open" },
        { hotkey: "Ctrl+S", id: "save", label: "Save" },
    ];

    it("should render all items and hotkeys", async () => {
        expect.assertions(4);

        const { getOutput } = await setup(<Menu autoFocus items={items} onSelect={vi.fn()} />);
        const output = getOutput();

        expect(output).toContain("New file");
        expect(output).toContain("Save");
        expect(output).toContain("Ctrl+N");
        expect(output).toContain("Ctrl+S");
    });

    it("should call onSelect with the item id on Enter", async () => {
        expect.assertions(1);

        const onSelect = vi.fn();
        const { stdin } = await setup(<Menu autoFocus items={items} onSelect={onSelect} />);

        emitReadable(stdin, "\r");
        await delay(40);

        expect(onSelect).toHaveBeenCalledWith("new");
    });

    it("should skip disabled items when navigating", async () => {
        expect.assertions(1);

        const onSelect = vi.fn();
        const { stdin } = await setup(
            <Menu
                autoFocus
                items={[
                    { id: "a", label: "A" },
                    { id: "b", isDisabled: true, label: "B" },
                    { id: "c", label: "C" },
                ]}
                onSelect={onSelect}
            />,
        );

        emitReadable(stdin, "j");
        await delay(40);
        emitReadable(stdin, "\r");
        await delay(40);

        // Jumped from 'A' over disabled 'B' to 'C'
        expect(onSelect).toHaveBeenCalledWith("c");
    });

    it("should render section headers", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(
            <Menu
                autoFocus
                onSelect={vi.fn()}
                sections={[
                    { id: "file", items: [{ id: "new", label: "New" }], title: "File" },
                    { id: "edit", items: [{ id: "cut", label: "Cut" }], title: "Edit" },
                ]}
            />,
        );
        const output = getOutput();

        expect(output).toContain("FILE");
        expect(output).toContain("EDIT");
    });
});

describe(Tooltip, () => {
    it("should render the anchor and the tooltip content", () => {
        expect.assertions(2);

        const output = renderToString(
            <Tooltip content="Helpful tip">
                <Text>Hover me</Text>
            </Tooltip>,
        );

        expect(output).toContain("Hover me");
        expect(output).toContain("Helpful tip");
    });

    it("should hide the tooltip when isVisible is false", () => {
        expect.assertions(2);

        const output = renderToString(
            <Tooltip content="Hidden tip" isVisible={false}>
                <Text>Anchor</Text>
            </Tooltip>,
        );

        expect(output).toContain("Anchor");
        expect(output).not.toContain("Hidden tip");
    });
});

describe(CommandPalette, () => {
    const commands = [
        { id: "new", keywords: ["create"], label: "File: New" },
        { id: "open", label: "File: Open" },
        { id: "format", label: "Format document" },
    ];

    it("should render all commands when no query is entered", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(<CommandPalette commands={commands} onSelect={vi.fn()} />);
        const output = getOutput();

        expect(output).toContain("File: New");
        expect(output).toContain("File: Open");
        expect(output).toContain("Format document");
    });

    it("should filter commands as the user types", async () => {
        expect.assertions(2);

        const { getOutput, stdin } = await setup(<CommandPalette commands={commands} onSelect={vi.fn()} />);

        emitReadable(stdin, "for");
        await waitFor(() => getOutput().includes("Format document") && !getOutput().includes("File: New"));

        const output = getOutput();

        expect(output).toContain("Format document");
        expect(output).not.toContain("File: New");
    });

    it("should call onSelect with the focused id", async () => {
        expect.assertions(1);

        const onSelect = vi.fn();
        const { stdin } = await setup(<CommandPalette commands={commands} onSelect={onSelect} />);

        emitReadable(stdin, "\r");
        await delay(50);

        // The initial focused command is the first entry with an empty query.
        expect(onSelect).toHaveBeenCalledWith("new", "");
    });

    it("should call onCancel on Escape", async () => {
        expect.assertions(1);

        const onCancel = vi.fn();
        const { stdin } = await setup(<CommandPalette commands={commands} onCancel={onCancel} onSelect={vi.fn()} />);

        emitReadable(stdin, "\u001B");
        await delay(50);

        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe(ContentSwitcher, () => {
    const options = [
        { content: <Text>First content</Text>, id: "one", label: "One" },
        { content: <Text>Second content</Text>, id: "two", label: "Two" },
        { content: <Text>Third content</Text>, id: "three", label: "Three" },
    ];

    it("should render all segments and the first panel by default", async () => {
        expect.assertions(4);

        const { getOutput } = await setup(<ContentSwitcher autoFocus options={options} />);
        const output = getOutput();

        expect(output).toContain("One");
        expect(output).toContain("Two");
        expect(output).toContain("Three");
        expect(output).toContain("First content");
    });

    it("should switch panels on right arrow", async () => {
        expect.assertions(2);

        const onChange = vi.fn();
        const { getOutput, stdin } = await setup(<ContentSwitcher autoFocus onChange={onChange} options={options} />);

        emitReadable(stdin, "\u001B[C");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("two");
        expect(getOutput()).toContain("Second content");
    });
});

describe(OptionList, () => {
    const options = [
        { id: "a", label: "First" },
        { description: "Second description", id: "b", label: "Second" },
        { id: "c", label: "Third" },
    ];

    it("should render all rows", () => {
        expect.assertions(3);

        const output = renderToString(<OptionList options={options} />);

        expect(output).toContain("First");
        expect(output).toContain("Second");
        expect(output).toContain("Third");
    });

    it("should highlight the currentId row", () => {
        expect.assertions(1);

        const output = renderToString(<OptionList currentId="b" options={options} />);

        expect(output).toContain("▸");
    });

    it("should render descriptions when present", () => {
        expect.assertions(1);

        const output = renderToString(<OptionList options={options} />);

        expect(output).toContain("Second description");
    });
});
