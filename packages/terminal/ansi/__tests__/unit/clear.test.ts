import { describe, expect, it } from "vitest";

import { clearLineAndHomeCursor, clearScreenAndHomeCursor, clearScreenFromTopLeft, resetTerminal } from "../../src/clear";
import { CSI, ESC } from "../../src/constants";
import { isWindows } from "../../src/helpers";

describe("clear utilities", () => {
    describe(clearScreenFromTopLeft, () => {
        it("should be the combination of cursorTo(0,0) and eraseDisplay(ToEnd)", async () => {
            expect.assertions(1);
            expect(clearScreenFromTopLeft).toBe(`${CSI}1;1H${CSI}J`);
        });
    });

    describe(clearLineAndHomeCursor, () => {
        it("should be the combination of eraseLine(EntireLine) and cursorToColumn(0)", async () => {
            expect.assertions(1);
            expect(clearLineAndHomeCursor).toBe(`${CSI}2K${CSI}G`);
        });
    });

    describe(clearScreenAndHomeCursor, () => {
        it("should be the combination of cursorTo(0,0) and eraseDisplay(EntireScreen)", async () => {
            expect.assertions(1);
            expect(clearScreenAndHomeCursor).toBe(`${CSI}H${CSI}2J`);
        });
    });

    describe(resetTerminal, () => {
        it.runIf(!isWindows)("should produce correct sequence when isWindows is false", async () => {
            expect.assertions(1);

            expect(resetTerminal).toBe(`${CSI}2J${CSI}3J${CSI}H${ESC}c`);
        });

        it.runIf(isWindows)("should produce correct sequence when isWindows is true", async () => {
            expect.assertions(1);

            expect(resetTerminal).toBe(`${CSI}2J${CSI}0f`);
        });
    });
});
