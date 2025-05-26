import { describe, expect, it } from "vitest";

import { DCS, ESC, ST } from "../../src/constants";
import { screenPassthrough, tmuxPassthrough } from "../../src/passthrough";

describe(screenPassthrough, () => {
    it("should wrap a simple sequence without limits", () => {
        expect.assertions(1);

        const seq = "Hello";

        expect(screenPassthrough(seq)).toBe(`${DCS}Hello${ST}`);
    });

    it("should wrap a sequence with a limit that doesn't cause chunking", () => {
        expect.assertions(1);

        const seq = "World";

        expect(screenPassthrough(seq, 10)).toBe(`${DCS}World${ST}`);
    });

    it("should wrap and chunk a sequence into two parts", () => {
        expect.assertions(1);

        const seq = "TestSequence"; // length 12
        const limit = 7;
        const expected = `${DCS}TestSeq${ST}${DCS}uence${ST}`;

        expect(screenPassthrough(seq, limit)).toBe(expected);
    });

    it("should wrap and chunk a sequence into multiple parts", () => {
        expect.assertions(1);

        const seq = "abcdefghijklmno"; // length 15
        const limit = 4;
        const expected = `${DCS}abcd${ST}${DCS}efgh${ST}${DCS}ijkl${ST}${DCS}mno${ST}`;

        expect(screenPassthrough(seq, limit)).toBe(expected);
    });

    it("should handle limit exactly matching sequence length", () => {
        expect.assertions(1);

        const seq = "ExactFit";
        const limit = 8;

        expect(screenPassthrough(seq, limit)).toBe(`${DCS}ExactFit${ST}`);
    });

    it("should handle an empty sequence", () => {
        expect.assertions(1);
        expect(screenPassthrough("")).toBe(DCS + ST);
    });

    it("should handle limit of 0 or less as no chunking", () => {
        expect.assertions(2);

        const seq = "NoChunkPlease";

        expect(screenPassthrough(seq, 0)).toBe(`${DCS}NoChunkPlease${ST}`);
        expect(screenPassthrough(seq, -5)).toBe(`${DCS}NoChunkPlease${ST}`);
    });
});

describe(tmuxPassthrough, () => {
    it("should wrap a simple sequence with no ESC characters", () => {
        expect.assertions(1);

        const seq = "HelloTmux";

        expect(tmuxPassthrough(seq)).toBe(`${DCS}tmux;` + `HelloTmux${ST}`);
    });

    it("should wrap and escape a sequence with one ESC character", () => {
        expect.assertions(1);

        const seq = `Before${ESC}After`;
        const expected = `${DCS}tmux;` + `Before${ESC}${ESC}After${ST}`;

        expect(tmuxPassthrough(seq)).toBe(expected);
    });

    it("should wrap and escape a sequence with multiple ESC characters", () => {
        expect.assertions(1);

        const seq = `${ESC}Mid${ESC}End`;
        const expected = `${DCS}tmux;${ESC}${ESC}Mid${ESC}${ESC}End${ST}`;

        expect(tmuxPassthrough(seq)).toBe(expected);
    });

    it("should handle ESC at the beginning of the sequence", () => {
        expect.assertions(1);

        const seq = `${ESC}Start`;
        const expected = `${DCS}tmux;${ESC}${ESC}Start${ST}`;

        expect(tmuxPassthrough(seq)).toBe(expected);
    });

    it("should handle ESC at the end of the sequence", () => {
        expect.assertions(1);

        const seq = `End${ESC}`;
        const expected = `${DCS}tmux;` + `End${ESC}${ESC}${ST}`;

        expect(tmuxPassthrough(seq)).toBe(expected);
    });

    it("should handle an empty sequence", () => {
        expect.assertions(1);
        expect(tmuxPassthrough("")).toBe(`${DCS}tmux;${ST}`);
    });

    it("should handle a sequence with only ESC characters", () => {
        expect.assertions(1);

        const seq = ESC + ESC + ESC;
        const expected = `${DCS}tmux;${ESC}${ESC}${ESC}${ESC}${ESC}${ESC}${ST}`;

        expect(tmuxPassthrough(seq)).toBe(expected);
    });
});
