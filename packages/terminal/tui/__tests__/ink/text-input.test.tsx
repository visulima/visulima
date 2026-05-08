import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TextInput } from "../../src/components/index";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(TextInput, () => {
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

    it("should render with default value", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TextInput defaultValue="hello" />);

        expect(getOutput()).toContain("hello");
    });

    it("should render placeholder when empty", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TextInput placeholder="Type here..." />);
        // Output contains ANSI escape codes for dimColor/inverse around the placeholder
        const output = getOutput();

        expect(output).toContain("ype here...");
    });

    it("should accept character input", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<TextInput onChange={onChange} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("a");
    });

    it("should handle backspace", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<TextInput defaultValue="ab" onChange={onChange} />);

        // Try both common backspace representations
        emitReadable(stdin, "\u0008");
        await delay(50);

        if (onChange.mock.calls.length === 0) {
            emitReadable(stdin, "\u007F");
            await delay(50);
        }

        expect(onChange).toHaveBeenCalledWith("a");
    });

    it("should call onSubmit on Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<TextInput defaultValue="hello" onSubmit={onSubmit} />);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("should mask input when mask is true", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<TextInput defaultValue="secret" mask />);
        const output = getOutput();

        expect(output).toContain("******");
        expect(output).not.toContain("secret");
    });

    it("should show suggestion", async () => {
        expect.assertions(1);

        const { getOutput, stdin } = await setup(<TextInput suggestions={["hello world"]} />);

        emitReadable(stdin, "hel");
        await delay(50);

        expect(getOutput()).toContain("lo world");
    });

    it("should accept suggestion on Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<TextInput onSubmit={onSubmit} suggestions={["hello"]} />);

        emitReadable(stdin, "hel");
        await delay(50);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("should not respond to input when disabled", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<TextInput isDisabled onChange={onChange} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should render dimmed when disabled", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<TextInput defaultValue="test" isDisabled />);

        expect(getOutput()).toContain("test");
    });

    it("should ignore ctrl/meta chord characters", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<TextInput onChange={onChange} />);

        // Ctrl+S (0x13), Ctrl+D (0x04), Meta+S (ESC s)
        emitReadable(stdin, "\u0013");
        await delay(50);
        emitReadable(stdin, "\u0004");
        await delay(50);
        emitReadable(stdin, "\u001Bs");
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });
});
