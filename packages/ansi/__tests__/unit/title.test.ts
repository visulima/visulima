import { describe, expect, it } from "vitest";

import { BEL, OSC, ST } from "../../src/constants";
import {
    decsin,
    decswt,
    setIconName,
    setIconNameAndWindowTitle,
    setIconNameAndWindowTitleWithST,
    setIconNameWithST,
    setWindowTitle,
    setWindowTitleWithST,
} from "../../src/title";

describe("title and Icon Name Sequences", () => {
    const testTitle = "My Test Title";
    const testIconName = "My Icon";

    describe("using BEL terminator (like Go code)", () => {
        it("setIconNameAndWindowTitle should format correctly", () => {
            expect.assertions(1);
            expect(setIconNameAndWindowTitle(testTitle)).toBe(`${OSC}0;${testTitle}${BEL}`);
        });

        it("setIconName should format correctly", () => {
            expect.assertions(1);
            expect(setIconName(testIconName)).toBe(`${OSC}1;${testIconName}${BEL}`);
        });

        it("setWindowTitle should format correctly", () => {
            expect.assertions(1);
            expect(setWindowTitle(testTitle)).toBe(`${OSC}2;${testTitle}${BEL}`);
        });

        it("decswt should format correctly (OSC 2 ; 1;<name> BEL)", () => {
            expect.assertions(1);
            const decName = "DEC Window";
            expect(decswt(decName)).toBe(`${OSC}2;1;${decName}${BEL}`);
        });

        it("decsin should format correctly (OSC 2 ; L;<name> BEL - replicating Go behavior)", () => {
            expect.assertions(1);
            const decName = "DEC Icon";
            expect(decsin(decName)).toBe(`${OSC}2;L;${decName}${BEL}`);
        });
    });

    describe("using ST terminator", () => {
        it("setIconNameAndWindowTitleWithST should format correctly", () => {
            expect.assertions(1);
            expect(setIconNameAndWindowTitleWithST(testTitle)).toBe(`${OSC}0;${testTitle}${ST}`);
        });

        it("setIconNameWithST should format correctly", () => {
            expect.assertions(1);
            expect(setIconNameWithST(testIconName)).toBe(`${OSC}1;${testIconName}${ST}`);
        });

        it("setWindowTitleWithST should format correctly", () => {
            expect.assertions(1);
            expect(setWindowTitleWithST(testTitle)).toBe(`${OSC}2;${testTitle}${ST}`);
        });
    });

    describe("edge cases and special characters", () => {
        it("should handle empty strings", () => {
            expect.assertions(3);
            expect(setWindowTitle("")).toBe(`${OSC}2;${BEL}`);
            expect(setIconName("")).toBe(`${OSC}1;${BEL}`);
            expect(setIconNameAndWindowTitle("")).toBe(`${OSC}0;${BEL}`);
        });

        it("should handle titles with semicolons", () => {
            expect.assertions(1);
            const titleWithSemicolon = "Title;Subtitle";
            // Semicolons are part of the string parameter in OSC, not parameter separators for OSC 0, 1, 2
            expect(setWindowTitle(titleWithSemicolon)).toBe(`${OSC}2;${titleWithSemicolon}${BEL}`);
        });

        it("should handle titles with other special characters", () => {
            expect.assertions(1);
            const specialTitle = "!@#$%^&*()_+";
            expect(setWindowTitle(specialTitle)).toBe(`${OSC}2;${specialTitle}${BEL}`);
        });
    });
});
