import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckboxGroup, NumberInput, PieChart, ProgressCircle, TimePicker } from "../../src/index";
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

describe(NumberInput, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders its default value", async () => {
        expect.assertions(1);

        const s = await setup(<NumberInput defaultValue={42} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("42");
    });

    it("steps up on the up arrow and fires onChange", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<NumberInput autoFocus defaultValue={5} onChange={onChange} step={2} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "[A"); // up arrow
        await waitFor(() => onChange.mock.calls.some((call) => call[0] === 7));

        expect(onChange).toHaveBeenCalledWith(7);
    });

    it("clamps to max", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<NumberInput autoFocus defaultValue={99} max={100} onChange={onChange} step={5} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "[A");
        await waitFor(() => onChange.mock.calls.some((call) => call[0] === 100));

        expect(onChange).toHaveBeenCalledWith(100);
    });
});

describe(TimePicker, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders hours and minutes zero-padded", async () => {
        expect.assertions(2);

        const s = await setup(<TimePicker defaultValue={{ hours: 9, minutes: 5 }} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("09");
        expect(s.getOutput()).toContain("05");
    });

    it("increments the focused hour segment on up arrow", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<TimePicker autoFocus defaultValue={{ hours: 9, minutes: 0 }} onChange={onChange} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "[A");
        await waitFor(() => onChange.mock.calls.some((call) => call[0]?.hours === 10));

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hours: 10 }));
    });
});

describe(CheckboxGroup, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders checked and unchecked marks", async () => {
        expect.assertions(2);

        const s = await setup(
            <CheckboxGroup
                defaultValue={["a"]}
                options={[
                    { label: "Alpha", value: "a" },
                    { label: "Beta", value: "b" },
                ]}
            />,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("◉"); // checked
        expect(s.getOutput()).toContain("◯"); // unchecked
    });

    it("toggles the focused option on space", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(
            <CheckboxGroup
                autoFocus
                onChange={onChange}
                options={[
                    { label: "Alpha", value: "a" },
                    { label: "Beta", value: "b" },
                ]}
            />,
        );

        unmount = s.unmount;
        emitReadable(s.stdin, " ");
        await waitFor(() => onChange.mock.calls.some((call) => call[0]?.[0] === "a" && call[0]?.length === 1));

        expect(onChange).toHaveBeenCalledWith(["a"]);
    });
});

describe(PieChart, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders a legend with percentages", async () => {
        expect.assertions(1);

        const s = await setup(
            <PieChart
                data={[
                    { label: "x", value: 3 },
                    { label: "y", value: 1 },
                ]}
                size={6}
            />,
        );

        unmount = s.unmount;

        expect(s.getOutput()).toContain("75%");
    });

    it("renders nothing catastrophic for empty data", async () => {
        expect.assertions(1);

        const s = await setup(<PieChart data={[]} size={6} />);

        unmount = s.unmount;

        expect(s.getOutput()).toBeTypeOf("string");
    });
});

describe(ProgressCircle, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders the percentage readout", async () => {
        expect.assertions(1);

        const s = await setup(<ProgressCircle size={6} value={67} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("67%");
    });
});
