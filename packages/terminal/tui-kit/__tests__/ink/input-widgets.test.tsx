import { strip as stripAnsi } from "@visulima/ansi";
import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaskedInput, SearchInput } from "../../src/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

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

describe(SearchInput, () => {
    it("should render the icon, placeholder, and border", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(<SearchInput placeholder="Find..." />);
        const output = getOutput();

        // The placeholder's first character renders with an inverse attribute to indicate
        // the cursor position, so strip ANSI before substring-matching the literal text.
        expect(output).toContain("⌕");
        expect(stripAnsi(output)).toContain("Find...");
        expect(output).toMatch(/[╭╮╯╰]/);
    });

    it("should use custom icon when provided", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<SearchInput icon="🔍" placeholder="Go" />);

        expect(getOutput()).toContain("🔍");
    });
});

describe(MaskedInput, () => {
    it("should render the mask with placeholders", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<MaskedInput mask="##/##" />);

        // First mask character renders with an inverse attribute (cursor indicator), so
        // strip ANSI before matching the literal underscores.
        expect(stripAnsi(getOutput())).toContain("__/__");
    });

    it("should accept digit input and preserve the mask separators", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MaskedInput mask="##/##" onChange={onChange} />);

        emitReadable(stdin, "1");
        await delay(50);
        emitReadable(stdin, "2");
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith("12");
    });

    it("should submit the raw value on Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<MaskedInput defaultValue="42" mask="##/##" onSubmit={onSubmit} />);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith("42");
    });

    it("should support cursor navigation and mid-string editing", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MaskedInput defaultValue="abc" mask="####" onChange={onChange} />);

        // Cursor starts at end (position 3 between 'c' and slot).
        // One left -> cursor 2 (between 'b' and 'c'). Backspace removes 'b'.
        emitReadable(stdin, "\u001B[D");
        await delay(30);
        emitReadable(stdin, "\u007F"); // Backspace
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith("ac");
    });

    it("should insert characters at the current cursor position", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MaskedInput defaultValue="ab" mask="####" onChange={onChange} />);

        // Move cursor to the beginning and insert "Z" -> "Zab".
        emitReadable(stdin, "\u001B[H"); // Home
        await delay(30);
        emitReadable(stdin, "Z");
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith("Zab");
    });
});
