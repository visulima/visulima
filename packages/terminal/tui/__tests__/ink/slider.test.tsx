import delay from "delay";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Slider } from "../../src/components/index";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(Slider, () => {
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

        const { getOutput } = await setup(<Slider defaultValue={50} width={10} />);
        const output = getOutput();

        // Should contain filled and empty characters
        expect(output).toContain("\u25CF"); // thumb character
    });

    it("should render filled and empty portions", async () => {
        expect.assertions(2);

        const { getOutput } = await setup(<Slider defaultValue={0} max={100} min={0} width={10} />);
        const output = getOutput();

        expect(output).toContain("\u25CF"); // thumb at position 0
        expect(output).toContain("\u2591"); // empty character
    });

    it("should respond to right arrow key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(51);
    });

    it("should respond to left arrow key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} />);

        emitReadable(stdin, "\u001B[D"); // left arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(49);
    });

    it("should clamp at min value", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={0} max={100} min={0} onChange={onChange} />);

        emitReadable(stdin, "\u001B[D"); // left arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(0);
    });

    it("should clamp at max value", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={100} max={100} min={0} onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(100);
    });

    it("should jump to min on Home key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} />);

        emitReadable(stdin, "\u001B[H"); // Home
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(0);
    });

    it("should jump to max on End key", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} />);

        emitReadable(stdin, "\u001B[F"); // End
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(100);
    });

    it("should respect custom step", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} step={5} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(55);
    });

    it("should jump to percentage on number keys", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={0} max={100} min={0} onChange={onChange} />);

        emitReadable(stdin, "5"); // 50%
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(50);
    });

    it("should ignore input when disabled", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} isDisabled onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should ignore input when not focused", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} isFocused={false} onChange={onChange} />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).not.toHaveBeenCalled();
    });

    it("should work as controlled component", async () => {
        expect.assertions(1);

        const onChange = vi.fn();

        const Controlled = () => {
            const [value, setValue] = useState(50);

            return (
                <Slider
                    max={100}
                    min={0}
                    onChange={(v) => {
                        setValue(v);
                        onChange(v);
                    }}
                    value={value}
                    width={10}
                />
            );
        };

        const { stdin } = await setup(<Controlled />);

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(51);
    });

    it("should render vertical orientation", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<Slider defaultValue={50} orientation="vertical" width={5} />);
        const output = getOutput();

        expect(output).toContain("\u25CF"); // thumb
    });

    it("should use up/down arrows in vertical mode", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} orientation="vertical" />);

        emitReadable(stdin, "\u001B[A"); // up arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(51);
    });

    it("should handle pageUp (large step forward)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} step={2} />);

        emitReadable(stdin, "\u001B[5~"); // Page Up
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(70); // 50 + 2*10
    });

    it("should handle pageDown (large step backward)", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={50} onChange={onChange} step={2} />);

        emitReadable(stdin, "\u001B[6~"); // Page Down
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(30); // 50 - 2*10
    });

    it("should handle min === max (degenerate range)", async () => {
        expect.assertions(2);

        const onChange = vi.fn();
        const { getOutput, stdin } = await setup(<Slider defaultValue={5} max={5} min={5} onChange={onChange} />);

        expect(getOutput()).toContain("\u25CF"); // still renders

        emitReadable(stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(5); // clamped to 5
    });

    it("should handle min > max gracefully", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const { stdin } = await setup(<Slider defaultValue={5} max={0} min={10} onChange={onChange} />);

        emitReadable(stdin, "\u001B[F"); // End key
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(10); // safeMax = max(0,10) = 10
    });
});
