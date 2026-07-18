import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ColorPicker, PathInput, TagInput, TreeSelect } from "../../src/index";
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

describe(TagInput, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders existing tags as chips", async () => {
        expect.assertions(1);

        const s = await setup(<TagInput defaultValue={["alpha", "beta"]} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("alpha");
    });

    it("commits a tag on Enter", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<TagInput autoFocus onChange={onChange} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "hi");
        await delay(30);
        emitReadable(s.stdin, "\r");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith(["hi"]);
    });
});

describe(ColorPicker, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders the highlighted color name", async () => {
        expect.assertions(1);

        const s = await setup(<ColorPicker defaultValue="green" />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("green");
    });

    it("moves the highlight on the right arrow", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<ColorPicker autoFocus defaultValue="black" onChange={onChange} palette={["black", "red", "green"]} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "\u001B[C"); // right arrow
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("red");
    });
});

describe(PathInput, () => {
    let unmount: (() => void) | undefined;

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders its placeholder when empty", async () => {
        expect.assertions(1);

        const s = await setup(<PathInput getCompletions={() => []} placeholder="pick a path" />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("pick a path");
    });

    it("completes on Tab using the provided completer", async () => {
        expect.assertions(1);

        const onChange = vi.fn();
        const s = await setup(<PathInput autoFocus defaultValue="s" getCompletions={() => ["src/"]} onChange={onChange} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "\t");
        await delay(50);

        expect(onChange).toHaveBeenCalledWith("src/");
    });
});

describe(TreeSelect, () => {
    let unmount: (() => void) | undefined;

    const tree = [
        { children: [{ label: "Child A", value: "a" }, { label: "Child B", value: "b" }], label: "Root", value: "root" },
    ];

    afterEach(async () => {
        unmount?.();
        unmount = undefined;
        await delay(50);
    });

    it("renders top-level nodes collapsed", async () => {
        expect.assertions(2);

        const s = await setup(<TreeSelect nodes={tree} />);

        unmount = s.unmount;

        expect(s.getOutput()).toContain("Root");
        expect(s.getOutput()).not.toContain("Child A");
    });

    it("expands a branch on the right arrow", async () => {
        expect.assertions(1);

        const s = await setup(<TreeSelect autoFocus nodes={tree} />);

        unmount = s.unmount;
        emitReadable(s.stdin, "\u001B[C"); // right arrow expands
        await delay(50);

        expect(s.getOutput()).toContain("Child A");
    });
});
