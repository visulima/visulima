import EventEmitter from "node:events";

import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmInput, render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

const createStdin = () => {
    const stdin = new EventEmitter() as unknown as NodeJS.WriteStream;

    stdin.isTTY = true;
    (stdin as Record<string, unknown>).setRawMode = () => stdin;
    (stdin as Record<string, unknown>).read = () => undefined;
    vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
    stdin.setEncoding = () => stdin;
    vi.spyOn(stdin, "read").mockImplementation();
    stdin.unref = () => stdin;
    stdin.ref = () => stdin;

    return stdin;
};

const emitReadable = (stdin: NodeJS.WriteStream, chunk: string) => {
    const read = stdin.read as ReturnType<typeof vi.fn>;

    read.mockReturnValueOnce(chunk);
    read.mockReturnValueOnce(null);
    stdin.emit("readable");
    read.mockReset();
};

describe("ConfirmInput", () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        const getOutput = () => {
            const calls = (stdout.write as ReturnType<typeof vi.fn>).mock.calls;

            return (calls.at(-1)?.[0] ?? "") as string;
        };

        return { getOutput, stdin, stdout };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render Y/n when default is confirm", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<ConfirmInput onCancel={vi.fn()} onConfirm={vi.fn()} />);

        expect(getOutput()).toContain("Y/n");
    });

    it("should render y/N when default is cancel", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<ConfirmInput defaultChoice="cancel" onCancel={vi.fn()} onConfirm={vi.fn()} />);

        expect(getOutput()).toContain("y/N");
    });

    it("should call onConfirm when Y is pressed", async () => {
        expect.assertions(1);

        const onConfirm = vi.fn();
        const { stdin } = await setup(<ConfirmInput onCancel={vi.fn()} onConfirm={onConfirm} />);

        emitReadable(stdin, "y");
        await delay(50);

        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("should call onCancel when N is pressed", async () => {
        expect.assertions(1);

        const onCancel = vi.fn();
        const { stdin } = await setup(<ConfirmInput onCancel={onCancel} onConfirm={vi.fn()} />);

        emitReadable(stdin, "n");
        await delay(50);

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it("should call onConfirm on Enter when default is confirm", async () => {
        expect.assertions(1);

        const onConfirm = vi.fn();
        const { stdin } = await setup(<ConfirmInput onCancel={vi.fn()} onConfirm={onConfirm} />);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("should call onCancel on Enter when default is cancel", async () => {
        expect.assertions(1);

        const onCancel = vi.fn();
        const { stdin } = await setup(<ConfirmInput defaultChoice="cancel" onCancel={onCancel} onConfirm={vi.fn()} />);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onCancel).toHaveBeenCalledOnce();
    });

    it("should not call callbacks on Enter when submitOnEnter is false", async () => {
        expect.assertions(2);

        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        const { stdin } = await setup(<ConfirmInput onCancel={onCancel} onConfirm={onConfirm} submitOnEnter={false} />);

        emitReadable(stdin, "\r");
        await delay(50);

        expect(onConfirm).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("should not respond when disabled", async () => {
        expect.assertions(1);

        const onConfirm = vi.fn();
        const { stdin } = await setup(<ConfirmInput isDisabled onCancel={vi.fn()} onConfirm={onConfirm} />);

        emitReadable(stdin, "y");
        await delay(50);

        expect(onConfirm).not.toHaveBeenCalled();
    });
});
