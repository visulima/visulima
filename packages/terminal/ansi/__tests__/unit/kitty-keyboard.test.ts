import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import { KittyKeyboardFlag, popKittyKeyboard, pushKittyKeyboard, queryKittyKeyboard, setKittyKeyboard } from "../../src/xterm";

describe("kitty keyboard protocol", () => {
    describe(pushKittyKeyboard, () => {
        it("should default to DisambiguateEscapeCodes (1)", () => {
            expect.assertions(1);

            expect(pushKittyKeyboard()).toBe(`${CSI}>1u`);
        });

        it("should emit combined flags", () => {
            expect.assertions(1);

            // eslint-disable-next-line no-bitwise
            const flags = KittyKeyboardFlag.DisambiguateEscapeCodes | KittyKeyboardFlag.ReportEventTypes;

            expect(pushKittyKeyboard(flags)).toBe(`${CSI}>3u`);
        });

        it("should clamp invalid flags to 0", () => {
            expect.assertions(2);

            expect(pushKittyKeyboard(-1)).toBe(`${CSI}>0u`);
            expect(pushKittyKeyboard(1.5)).toBe(`${CSI}>0u`);
        });
    });

    describe(popKittyKeyboard, () => {
        it("should default to popping one entry", () => {
            expect.assertions(1);

            expect(popKittyKeyboard()).toBe(`${CSI}<1u`);
        });

        it("should pop a given count", () => {
            expect.assertions(1);

            expect(popKittyKeyboard(3)).toBe(`${CSI}<3u`);
        });

        it("should fall back to 1 on invalid counts", () => {
            expect.assertions(2);

            expect(popKittyKeyboard(0)).toBe(`${CSI}<1u`);
            expect(popKittyKeyboard(-2)).toBe(`${CSI}<1u`);
        });
    });

    describe(setKittyKeyboard, () => {
        it("should set flags in place with mode 1", () => {
            expect.assertions(2);

            expect(setKittyKeyboard()).toBe(`${CSI}=1;1u`);
            expect(setKittyKeyboard(KittyKeyboardFlag.ReportAllKeysAsEscapeCodes)).toBe(`${CSI}=16;1u`);
        });
    });

    it("should expose a static query sequence", () => {
        expect.assertions(1);

        expect(queryKittyKeyboard).toBe(`${CSI}?u`);
    });
});
