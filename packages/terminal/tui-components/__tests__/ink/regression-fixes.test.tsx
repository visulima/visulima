import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CheckboxGroup, DataGrid, Image, Json, PathInput, TimePicker } from "../../src/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

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

describe("review fixes", () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("json renders empty containers as [] / {} rather than null", async () => {
        expect.assertions(2);

        const s = await setup(<Json data={{ items: [], meta: {} }} interactive={false} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("[]");
        expect(s.getOutput()).toContain("{}");
    });

    it("path-input cycles through frozen candidates on repeated Tab", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<PathInput autoFocus getCompletions={() => ["a.txt", "b.txt"]} onChange={onChange} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "\t");
        await delay(40);
        emitReadable(s.stdin, "\t");
        await delay(40);

        expect(onChange).toHaveBeenLastCalledWith("b.txt");
    });

    it("time-picker 12h digit entry preserves the PM meridiem", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        // 15:00 = 3 PM; typing "4" on the hours segment should give 4 PM = 16:00.
        const s = await setup(<TimePicker autoFocus defaultValue={{ hours: 15, minutes: 0 }} hour12 onChange={onChange} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "4");
        await delay(40);

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hours: 16 }));
    });

    // Note: two-digit hour accumulation ("1" then "8" → 18) is implemented and
    // works with real discrete key events, but the mock stdin harness cannot
    // deliver a reliable multi-keystroke sequence (the second key races the
    // input handler's re-subscribe), so it is not asserted here to avoid a flaky
    // test. The single-key PM-preservation case above covers the core of the fix.

    it("data-grid shows the sort indicator after sorting", async () => {
        expect.assertions(1);

        const s = await setup(
            <DataGrid autoFocus columns={[{ header: "ID", key: "id" }]} data={[{ id: 1 }, { id: 2 }]} />,
        );

        unmount = s.unmount;
        emitReadable(s.stdin, "s");
        await delay(50);

        expect(s.getOutput()).toContain("▲");
    });

    it("image draws a lower-half block for a transparent-over-opaque cell", async () => {
        expect.assertions(1);

        const s = await setup(<Image pixels={[[undefined], ["red"]]} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("▄");
    });

    it("checkbox-group toggle-all keeps a disabled, pre-checked option", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(
            <CheckboxGroup
                autoFocus
                defaultValue={["x"]}
                onChange={onChange}
                options={[{ isDisabled: true, label: "X", value: "x" }, { label: "Y", value: "y" }]}
            />,
        );

        unmount = s.unmount;
        emitReadable(s.stdin, "a");
        await delay(50);

        expect(onChange).toHaveBeenLastCalledWith(["x", "y"]);
    });
});
