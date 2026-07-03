import EventEmitter from "node:events";

import isInCi from "is-in-ci";
import { describe, expect, it } from "vitest";

import { bsu, esu, shouldSynchronize } from "../../src/ink/write-synchronized";

const createStream = ({ tty = false } = {}) => {
    const stream = new EventEmitter() as unknown as NodeJS.WriteStream;

    if (tty) {
        stream.isTTY = true;
    }

    return stream;
};

describe("write-synchronized", () => {
    it.each([
        ["bsu", bsu, "\u001B[?2026h"],
        ["esu", esu, "\u001B[?2026l"],
    ] as const)("%s is the expected synchronized update sequence", (_, sequence, expected) => {
        expect.assertions(1);

        expect(sequence).toBe(expected);
    });

    it("shouldSynchronize returns true for interactive TTY stream", () => {
        expect.assertions(1);

        const stream = createStream({ tty: true });

        expect(shouldSynchronize(stream, true)).toBe(true);
    });

    it("shouldSynchronize returns false for non-interactive TTY stream", () => {
        expect.assertions(1);

        const stream = createStream({ tty: true });

        expect(shouldSynchronize(stream, false)).toBe(false);
    });

    it("shouldSynchronize returns false for non-TTY stream", () => {
        expect.assertions(1);

        const stream = createStream({ tty: false });

        expect(shouldSynchronize(stream, true)).toBe(false);
    });

    it("shouldSynchronize uses CI detection when interactive is not specified", () => {
        expect.assertions(1);

        const ttyStream = createStream({ tty: true });

        if (isInCi) {
            expect(shouldSynchronize(ttyStream)).toBe(false);
        } else {
            expect(shouldSynchronize(ttyStream)).toBe(true);
        }
    });

    it("shouldSynchronize returns false for non-TTY stream when interactive is not specified", () => {
        expect.assertions(1);

        const stream = createStream({ tty: false });

        expect(shouldSynchronize(stream)).toBe(false);
    });
});
