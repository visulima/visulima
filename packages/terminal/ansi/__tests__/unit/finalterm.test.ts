import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { finalTerm, finalTermCmdExecuted, finalTermCmdFinished, finalTermCmdStart, finalTermPrompt } from "../../src/finalterm";

describe("finalTerm shell integration (OSC 133)", () => {
    it("should join parameters with semicolons", () => {
        expect.assertions(1);
        expect(finalTerm("A", "foo")).toBe(`${OSC}133;A;foo${BEL}`);
    });

    it("should emit the prompt start marker", () => {
        expect.assertions(1);
        expect(finalTermPrompt()).toBe(`${OSC}133;A${BEL}`);
    });

    it("should emit the command start marker", () => {
        expect.assertions(1);
        expect(finalTermCmdStart()).toBe(`${OSC}133;B${BEL}`);
    });

    it("should emit the command executed marker", () => {
        expect.assertions(1);
        expect(finalTermCmdExecuted()).toBe(`${OSC}133;C${BEL}`);
    });

    it("should emit the command finished marker with an exit code", () => {
        expect.assertions(1);
        expect(finalTermCmdFinished("0")).toBe(`${OSC}133;D;0${BEL}`);
    });

    it("should strip escape-sequence terminators from parameters", () => {
        expect.assertions(1);
        expect(finalTerm("A", "x\u001By\u0007z")).toBe(`${OSC}133;A;xyz${BEL}`);
    });
});
