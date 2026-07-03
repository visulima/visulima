import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MultiSelect } from "../../src/components/index";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

const options = [
    { label: "TypeScript", value: "ts" },
    { label: "JavaScript", value: "js" },
    { label: "Python", value: "py" },
];

describe(MultiSelect, () => {
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

    it("should render all options", async () => {
        expect.assertions(3);

        const { getOutput } = await setup(<MultiSelect options={options} />);
        const output = getOutput();

        expect(output).toContain("TypeScript");
        expect(output).toContain("JavaScript");
        expect(output).toContain("Python");
    });

    it("should show focus indicator on first item", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<MultiSelect options={options} />);

        expect(getOutput()).toContain("▸");
    });

    it("should toggle selection with space", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect onChange={onChange} options={options} />);

        emitReadable(stdin, " ");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(["ts"]);
    });

    it("should deselect on second space press", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect onChange={onChange} options={options} />);

        emitReadable(stdin, " ");
        await delay(50);
        emitReadable(stdin, " ");
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("should navigate down with arrow key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect onChange={onChange} options={options} />);

        // Move to second option and select
        emitReadable(stdin, "\u001B[B");
        await delay(50);
        emitReadable(stdin, " ");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(["js"]);
    });

    it("should navigate up with arrow key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect onChange={onChange} options={options} />);

        // Move down then back up and select
        emitReadable(stdin, "\u001B[B");
        await delay(50);
        emitReadable(stdin, "\u001B[A");
        await delay(50);
        emitReadable(stdin, " ");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(["ts"]);
    });

    it("should submit with Enter", async () => {
        expect.assertions(1);

        const onSubmit = vi.fn();
        const { stdin } = await setup(<MultiSelect onSubmit={onSubmit} options={options} />);

        emitReadable(stdin, " ");
        await delay(50);
        emitReadable(stdin, "\r");
        await delay(50);

        expect(onSubmit).toHaveBeenCalledWith(["ts"]);
    });

    it("should render with default values selected", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<MultiSelect defaultValue={["ts", "py"]} options={options} />);

        expect(getOutput()).toContain("✓");
    });

    it("should toggle all with 'a' key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect onChange={onChange} options={options} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(["ts", "js", "py"]);
    });

    it("should deselect all when all are selected", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect defaultValue={["ts", "js", "py"]} onChange={onChange} options={options} />);

        emitReadable(stdin, "a");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith([]);
    });

    it("should not respond when disabled", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<MultiSelect isDisabled onChange={onChange} options={options} />);

        emitReadable(stdin, " ");
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should limit visible options", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<MultiSelect limit={2} options={options} />);
        const output = getOutput();

        expect(output).toContain("TypeScript");
        expect(output).not.toContain("Python");
    });
});
