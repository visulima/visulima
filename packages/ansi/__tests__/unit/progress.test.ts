import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { resetProgressBar, setErrorProgressBar, setIndeterminateProgressBar, setProgressBar, setWarningProgressBar } from "../../src/progress";

describe("progress bar sequences", () => {
    describe(resetProgressBar, () => {
        it("should be the correct sequence", () => {
            expect.assertions(1);
            expect(resetProgressBar).toBe(`${OSC}9;4;0${BEL}`);
        });
    });

    describe(setProgressBar, () => {
        it("should generate correct sequence for valid percentage", () => {
            expect.assertions(1);
            expect(setProgressBar(50)).toBe(`${OSC}9;4;1;50${BEL}`);
        });

        it("should clamp negative values to 0", () => {
            expect.assertions(1);
            expect(setProgressBar(-5)).toBe(`${OSC}9;4;1;0${BEL}`);
        });

        it("should clamp values above 100 to 100", () => {
            expect.assertions(1);
            expect(setProgressBar(150)).toBe(`${OSC}9;4;1;100${BEL}`);
        });

        it("should handle edge cases", () => {
            expect.assertions(2);
            expect(setProgressBar(0)).toBe(`${OSC}9;4;1;0${BEL}`);
            expect(setProgressBar(100)).toBe(`${OSC}9;4;1;100${BEL}`);
        });
    });

    describe(setErrorProgressBar, () => {
        it("should generate correct sequence for valid percentage", () => {
            expect.assertions(1);
            expect(setErrorProgressBar(75)).toBe(`${OSC}9;4;2;75${BEL}`);
        });

        it("should clamp negative values to 0", () => {
            expect.assertions(1);
            expect(setErrorProgressBar(-10)).toBe(`${OSC}9;4;2;0${BEL}`);
        });

        it("should clamp values above 100 to 100", () => {
            expect.assertions(1);
            expect(setErrorProgressBar(200)).toBe(`${OSC}9;4;2;100${BEL}`);
        });
    });

    describe(setIndeterminateProgressBar, () => {
        it("should be the correct sequence", () => {
            expect.assertions(1);
            expect(setIndeterminateProgressBar).toBe(`${OSC}9;4;3${BEL}`);
        });
    });

    describe(setWarningProgressBar, () => {
        it("should generate correct sequence for valid percentage", () => {
            expect.assertions(1);
            expect(setWarningProgressBar(25)).toBe(`${OSC}9;4;4;25${BEL}`);
        });

        it("should clamp negative values to 0", () => {
            expect.assertions(1);
            expect(setWarningProgressBar(-1)).toBe(`${OSC}9;4;4;0${BEL}`);
        });

        it("should clamp values above 100 to 100", () => {
            expect.assertions(1);
            expect(setWarningProgressBar(120)).toBe(`${OSC}9;4;4;100${BEL}`);
        });
    });
});
