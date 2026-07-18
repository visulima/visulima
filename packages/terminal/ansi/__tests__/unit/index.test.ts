import { describe, expect, it } from "vitest";

import { BEL, OSC } from "../../src/constants";
import { cursorMove as cursorMoveDirect } from "../../src/cursor";
import { eraseLine as eraseLineDirect } from "../../src/erase";
import { beep, CursorStyle, cursorMove, EraseDisplayMode, EraseLineMode, eraseLine, iTerm2, ModeSetting, strip, XTermWindowOp } from "../../src/index";

describe("index entry point", () => {
    it("beep should be the BEL control character", () => {
        expect.assertions(1);

        expect(beep).toBe("\u0007");
    });

    it("should re-export the cursor and erase builders unchanged", () => {
        expect.assertions(2);

        expect(cursorMove).toBe(cursorMoveDirect);
        expect(eraseLine).toBe(eraseLineDirect);
    });

    it("should re-export callable helpers from the barrel", () => {
        expect.assertions(2);

        expect(iTerm2({ toString: () => "Payload" })).toBe(`${OSC}1337;Payload${BEL}`);
        expect(strip("\u001B[31mred\u001B[0m")).toBe("red");
    });

    it("should re-export runtime enums as values, not type-only", () => {
        expect.assertions(5);

        // A type-only re-export would leave these `undefined` at runtime for root-import consumers.
        expect(CursorStyle.SteadyBar).toBe(6);
        expect(EraseDisplayMode.ToBeginning).toBe(1);
        expect(EraseLineMode.EntireLine).toBe(2);
        expect(ModeSetting.PermanentlyReset).toBe(4);
        expect(XTermWindowOp.MAXIMIZE_WINDOW).toBe(10);
    });
});
