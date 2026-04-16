import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MaskedInput, SearchInput, render } from "../../src/ink/index";
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

        const { getOutput } = await setup(
            <SearchInput placeholder="Find..." />,
        );
        const output = getOutput();

        expect(output).toContain("⌕");
        expect(output).toContain("Find...");
        expect(output).toMatch(/[╭╮╯╰]/);
    });

    it("should use custom icon when provided", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(
            <SearchInput icon="🔍" placeholder="Go" />,
        );

        expect(getOutput()).toContain("🔍");
    });
});

describe(MaskedInput, () => {
    it("should render the mask with placeholders", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<MaskedInput mask="##/##" />);

        expect(getOutput()).toContain("__/__");
    });

    it("should accept digit input and preserve the mask separators", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(
            <MaskedInput mask="##/##" onChange={onChange} />,
        );

        emitReadable(stdin, "1");
        await delay(50);
        emitReadable(stdin, "2");
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith("12");
    });

    it("should submit the raw value on Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(
            <MaskedInput defaultValue="42" mask="##/##" onSubmit={onSubmit} />,
        );

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith("42");
    });
});
