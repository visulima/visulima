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

        it("decswt should format correctly (OSC 21;<title> ST)", () => {
            expect.assertions(1);

            const decName = "DEC Window";

            expect(decswt(decName)).toBe(`${OSC}21;${decName}${ST}`);
        });

        it("decsin should format correctly (OSC 2L;<name> ST)", () => {
            expect.assertions(1);

            const decName = "DEC Icon";

            expect(decsin(decName)).toBe(`${OSC}2L;${decName}${ST}`);
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

    // OSC payloads end at BEL (U+0007) or ESC (U+001B); leaving either byte in
    // the title would let an attacker close the OSC sequence early and inject
    // a follow-up (clipboard write, palette change, etc.).
    describe("osc payload injection", () => {
        const injected = "name]52;c;ZXZpbA==";
        const escInjected = "name]52;c;ZXZpbA==\\";
        const sanitizedInjected = "name]52;c;ZXZpbA==";
        const sanitizedEscInjected = "name]52;c;ZXZpbA==\\";

        it("setIconNameAndWindowTitle strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setIconNameAndWindowTitle(injected)).toBe(`${OSC}0;${sanitizedInjected}${BEL}`);
        });

        it("setIconName strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setIconName(injected)).toBe(`${OSC}1;${sanitizedInjected}${BEL}`);
        });

        it("setWindowTitle strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setWindowTitle(injected)).toBe(`${OSC}2;${sanitizedInjected}${BEL}`);
        });

        it("decswt strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(decswt(escInjected)).toBe(`${OSC}21;${sanitizedEscInjected}${ST}`);
        });

        it("decsin strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(decsin(escInjected)).toBe(`${OSC}2L;${sanitizedEscInjected}${ST}`);
        });

        it("setIconNameAndWindowTitleWithST strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setIconNameAndWindowTitleWithST(escInjected)).toBe(`${OSC}0;${sanitizedEscInjected}${ST}`);
        });

        it("setIconNameWithST strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setIconNameWithST(escInjected)).toBe(`${OSC}1;${sanitizedEscInjected}${ST}`);
        });

        it("setWindowTitleWithST strips BEL/ESC from the payload", () => {
            expect.assertions(1);
            expect(setWindowTitleWithST(escInjected)).toBe(`${OSC}2;${sanitizedEscInjected}${ST}`);
        });
    });
});
