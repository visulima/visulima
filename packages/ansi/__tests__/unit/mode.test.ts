import { beforeEach, describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import {
    AllowXtermMouseReporting,    // Was VT200MouseReportingMode
    AnyEventMouseTrackingMode,   // Was AnyEventMouseReportingMode
    ApplicationCursorKeysMode,
    AttributedScreenMode,        // Was DECSCNM_ScreenMode / ScreenMode
    BracketedPasteMode,
    CellMotionMouseTrackingMode, // Was ButtonEventMouseReportingMode
    createAnsiMode,
    createDecMode,
    DECCOLM_132ColumnMode,     // Was ColumnMode
    DECRPM,
    DECRQM,
    EnterAlternateScreenBuffer,  // This is DEC Mode 1047 object
    FocusTrackingMode,           // Was FocusEventReportingMode
    InsertReplaceMode,
    isModeNotRecognized,
    isModePermanentlyReset,
    isModePermanentlySet,
    isModeReset,
    isModeSet,
    KeyboardActionMode,
    ModeSetting,
    OriginMode,
    reportMode,
    requestMode,
    resetMode,
    RM,
    SaveCursorAndEnterAlternateScreenBuffer, // This is DEC Mode 1049 object
    setMode,
    SgrMouseMode,
    SM,
    TerminalModes,
    TextCursorEnableMode,
    UseAlternateScreenBuffer,    // This is DEC Mode 47 object
    WraparoundMode,              // Was DECAWM_AutoWrapMode / AutoWrapMode
    X10Mouse,
    // createAnsiMode and createDecMode are used directly, no need for separate mode objects for them if not exported
} from "../../src/mode";

describe("mode Utilities", () => {
    describe("modeSetting helpers", () => {
        it("isModeNotRecognized should work", () => {
            expect(isModeNotRecognized(ModeSetting.NotRecognized)).toBeTruthy();
            expect(isModeNotRecognized(ModeSetting.Set)).toBeFalsy();
        });

        it("isModeSet should work", () => {
            expect(isModeSet(ModeSetting.Set)).toBeTruthy();
            expect(isModeSet(ModeSetting.PermanentlySet)).toBeTruthy();
            expect(isModeSet(ModeSetting.Reset)).toBeFalsy();
        });

        it("isModeReset should work", () => {
            expect(isModeReset(ModeSetting.Reset)).toBeTruthy();
            expect(isModeReset(ModeSetting.PermanentlyReset)).toBeTruthy();
            expect(isModeReset(ModeSetting.Set)).toBeFalsy();
        });

        it("isModePermanentlySet should work", () => {
            expect(isModePermanentlySet(ModeSetting.PermanentlySet)).toBeTruthy();
            expect(isModePermanentlySet(ModeSetting.Set)).toBeFalsy();
        });

        it("isModePermanentlyReset should work", () => {
            expect(isModePermanentlyReset(ModeSetting.PermanentlyReset)).toBeTruthy();
            expect(isModePermanentlyReset(ModeSetting.Reset)).toBeFalsy();
        });
    });

    describe("mode Creation", () => {
        it("should create ANSI mode", () => {
            const mode = createAnsiMode(4);
            expect(mode.code).toBe(4);
            expect(mode.isDecMode).toBeFalsy();
        });

        it("should create DEC mode", () => {
            const mode = createDecMode(25);
            expect(mode.code).toBe(25);
            expect(mode.isDecMode).toBeTruthy();
        });
    });

    describe("setMode (SM)", () => {
        it("should set a single ANSI mode", () => {
            expect(setMode(InsertReplaceMode)).toBe(CSI + "4h");
            expect(SM(InsertReplaceMode)).toBe(CSI + "4h");
        });

        it("should set a single DEC mode", () => {
            expect(setMode(TextCursorEnableMode)).toBe(CSI + "?25h");
            expect(SM(TextCursorEnableMode)).toBe(CSI + "?25h");
        });

        it("should set multiple ANSI modes", () => {
            const irm = createAnsiMode(4);
            const kam = createAnsiMode(2);
            expect(setMode(irm, kam)).toBe(CSI + "4;2h");
        });

        it("should set multiple DEC modes", () => {
            const dec25 = createDecMode(25);
            const dec7 = createDecMode(7); // WraparoundMode
            expect(setMode(dec25, dec7)).toBe(CSI + "?25;7h");
        });

        it("should set mixed ANSI and DEC modes", () => {
            const irm = createAnsiMode(4); // InsertReplaceMode
            const dec25 = createDecMode(25); // TextCursorEnableMode
            const kam = createAnsiMode(2); // KeyboardActionMode
            const dec7 = createDecMode(7); // WraparoundMode
            const result = setMode(irm, dec25, kam, dec7);
            expect(result).toContain(CSI + "4;2h");
            expect(result).toContain(CSI + "?25;7h");
        });

        it("should return empty string for no modes", () => {
            expect(setMode()).toBe("");
        });
    });

    describe("resetMode (RM)", () => {
        it("should reset a single ANSI mode", () => {
            expect(resetMode(InsertReplaceMode)).toBe(CSI + "4l");
            expect(RM(InsertReplaceMode)).toBe(CSI + "4l");
        });

        it("should reset a single DEC mode", () => {
            expect(resetMode(TextCursorEnableMode)).toBe(CSI + "?25l");
            expect(RM(TextCursorEnableMode)).toBe(CSI + "?25l");
        });

        it("should reset multiple ANSI modes", () => {
            const irm = createAnsiMode(4);
            const kam = createAnsiMode(2);
            expect(resetMode(irm, kam)).toBe(CSI + "4;2l");
        });

        it("should reset multiple DEC modes", () => {
            const dec25 = createDecMode(25);
            const dec7 = createDecMode(7);
            expect(resetMode(dec25, dec7)).toBe(CSI + "?25;7l");
        });

        it("should reset mixed ANSI and DEC modes", () => {
            const irm = createAnsiMode(4);
            const dec25 = createDecMode(25);
            const result = resetMode(irm, dec25);
            expect(result).toContain(CSI + "4l");
            expect(result).toContain(CSI + "?25l");
        });

        it("should return empty string for no modes", () => {
            expect(resetMode()).toBe("");
        });
    });

    describe("requestMode (DECRQM)", () => {
        it("should request an ANSI mode", () => {
            expect(requestMode(InsertReplaceMode)).toBe(CSI + "4$p");
            expect(DECRQM(InsertReplaceMode)).toBe(CSI + "4$p");
        });

        it("should request a DEC mode", () => {
            expect(requestMode(TextCursorEnableMode)).toBe(CSI + "?25$p");
            expect(DECRQM(TextCursorEnableMode)).toBe(CSI + "?25$p");
        });
    });

    describe("reportMode (DECRPM)", () => {
        it("should report an ANSI mode as Set", () => {
            expect(reportMode(InsertReplaceMode, ModeSetting.Set)).toBe(CSI + "4;1$y");
            expect(DECRPM(InsertReplaceMode, ModeSetting.Set)).toBe(CSI + "4;1$y");
        });

        it("should report a DEC mode as Reset", () => {
            expect(reportMode(TextCursorEnableMode, ModeSetting.Reset)).toBe(CSI + "?25;2$y");
        });

        it("should report PermanentlySet", () => {
            expect(reportMode(TextCursorEnableMode, ModeSetting.PermanentlySet)).toBe(CSI + "?25;3$y");
        });

        it("should report PermanentlyReset", () => {
            expect(reportMode(TextCursorEnableMode, ModeSetting.PermanentlyReset)).toBe(CSI + "?25;4$y");
        });

        it("should report NotRecognized for invalid value > 4", () => {
            expect(reportMode(InsertReplaceMode, 5 as ModeSetting)).toBe(CSI + "4;0$y");
        });

        it("should report NotRecognized for ModeSetting.NotRecognized", () => {
            expect(reportMode(InsertReplaceMode, ModeSetting.NotRecognized)).toBe(CSI + "4;0$y");
        });
    });

    describe("predefined Mode Constants", () => {
        // ANSI Modes
        it("keyboardActionMode (KAM)", () => {
            expect(KeyboardActionMode.code).toBe(2);
            expect(KeyboardActionMode.isDecMode).toBeFalsy();
            expect(setMode(KeyboardActionMode)).toBe(CSI + "2h");
            expect(resetMode(KeyboardActionMode)).toBe(CSI + "2l");
            expect(requestMode(KeyboardActionMode)).toBe(CSI + "2$p");
        });

        it("insertReplaceMode (IRM)", () => {
            expect(InsertReplaceMode.code).toBe(4);
            expect(InsertReplaceMode.isDecMode).toBeFalsy();
            expect(setMode(InsertReplaceMode)).toBe(CSI + "4h");
            expect(resetMode(InsertReplaceMode)).toBe(CSI + "4l");
            expect(requestMode(InsertReplaceMode)).toBe(CSI + "4$p");
        });

        // DEC Modes
        it("textCursorEnableMode (DECTCEM)", () => {
            expect(TextCursorEnableMode.code).toBe(25);
            expect(TextCursorEnableMode.isDecMode).toBeTruthy();
            expect(setMode(TextCursorEnableMode)).toBe(CSI + "?25h");
            expect(resetMode(TextCursorEnableMode)).toBe(CSI + "?25l");
            expect(requestMode(TextCursorEnableMode)).toBe(CSI + "?25$p");
        });

        it("screenMode (DECSCREEN)", () => {
            expect(AttributedScreenMode.code).toBe(5); // Was ScreenMode, now AttributedScreenMode
            expect(AttributedScreenMode.isDecMode).toBeTruthy();
            expect(setMode(AttributedScreenMode)).toBe(CSI + "?5h"); // Reverse video
            expect(resetMode(AttributedScreenMode)).toBe(CSI + "?5l"); // Normal video
        });

        it("originMode (DECOM)", () => {
            expect(OriginMode.code).toBe(6);
            expect(OriginMode.isDecMode).toBeTruthy();
            expect(setMode(OriginMode)).toBe(CSI + "?6h");
            expect(resetMode(OriginMode)).toBe(CSI + "?6l");
        });

        it("autoWrapMode (DECAWM)", () => {
            expect(WraparoundMode.code).toBe(7); // Was AutoWrapMode, now WraparoundMode
            expect(WraparoundMode.isDecMode).toBeTruthy();
            expect(setMode(WraparoundMode)).toBe(CSI + "?7h");
            expect(resetMode(WraparoundMode)).toBe(CSI + "?7l");
        });

        it("cursorKeysMode (DECCKM)", () => {
            expect(ApplicationCursorKeysMode.code).toBe(1); // Was CursorKeysMode, now ApplicationCursorKeysMode
            expect(ApplicationCursorKeysMode.isDecMode).toBeTruthy();
            expect(setMode(ApplicationCursorKeysMode)).toBe(CSI + "?1h");
            expect(resetMode(ApplicationCursorKeysMode)).toBe(CSI + "?1l");
        });

        it("columnMode (DECCOLM)", () => { // Test for mode 3 using DECCOLM_132ColumnMode
            expect(DECCOLM_132ColumnMode.code).toBe(3);
            expect(DECCOLM_132ColumnMode.isDecMode).toBeTruthy();
            expect(setMode(DECCOLM_132ColumnMode)).toBe(CSI + "?3h");
            expect(resetMode(DECCOLM_132ColumnMode)).toBe(CSI + "?3l");
        });

        // Mouse Modes
        it("x10MouseReportingMode", () => { // Uses X10Mouse constant
            expect(X10Mouse.code).toBe(9);
            expect(X10Mouse.isDecMode).toBeTruthy();
            expect(setMode(X10Mouse)).toBe(CSI + "?9h");
            expect(resetMode(X10Mouse)).toBe(CSI + "?9l");
        });

        it("vT200MouseReportingMode", () => { // Uses AllowXtermMouseReporting
            expect(AllowXtermMouseReporting.code).toBe(1000);
            expect(AllowXtermMouseReporting.isDecMode).toBeTruthy();
            expect(setMode(AllowXtermMouseReporting)).toBe(CSI + "?1000h");
            expect(resetMode(AllowXtermMouseReporting)).toBe(CSI + "?1000l");
        });

        it("buttonEventMouseReportingMode", () => { // Uses CellMotionMouseTrackingMode
            expect(CellMotionMouseTrackingMode.code).toBe(1002);
            expect(CellMotionMouseTrackingMode.isDecMode).toBeTruthy();
            expect(setMode(CellMotionMouseTrackingMode)).toBe(CSI + "?1002h");
            expect(resetMode(CellMotionMouseTrackingMode)).toBe(CSI + "?1002l");
        });

        it("anyEventMouseReportingMode", () => { // Uses AnyEventMouseTrackingMode
            expect(AnyEventMouseTrackingMode.code).toBe(1003);
            expect(AnyEventMouseTrackingMode.isDecMode).toBeTruthy();
            expect(setMode(AnyEventMouseTrackingMode)).toBe(CSI + "?1003h");
            expect(resetMode(AnyEventMouseTrackingMode)).toBe(CSI + "?1003l");
        });

        it("focusEventReportingMode", () => { // Uses FocusTrackingMode
            expect(FocusTrackingMode.code).toBe(1004);
            expect(FocusTrackingMode.isDecMode).toBeTruthy();
            expect(setMode(FocusTrackingMode)).toBe(CSI + "?1004h");
            expect(resetMode(FocusTrackingMode)).toBe(CSI + "?1004l");
        });

        it("sGRMouseMode", () => {
            expect(SgrMouseMode.code).toBe(1006);
            expect(SgrMouseMode.isDecMode).toBeTruthy();
            expect(setMode(SgrMouseMode)).toBe(CSI + "?1006h");
            expect(resetMode(SgrMouseMode)).toBe(CSI + "?1006l");
        });

        it("alternateScrollMode", () => { // Uses createDecMode(1007)
            const mode = createDecMode(1007);
            expect(mode.code).toBe(1007);
            expect(mode.isDecMode).toBeTruthy();
            expect(setMode(mode)).toBe(CSI + "?1007h");
            expect(resetMode(mode)).toBe(CSI + "?1007l");
        });

        // Screen Buffer
        it("UseAlternateScreenBuffer (mode 47)", () => {
            expect(UseAlternateScreenBuffer.code).toBe(47);
            expect(UseAlternateScreenBuffer.isDecMode).toBeTruthy();
            expect(setMode(UseAlternateScreenBuffer)).toBe(CSI + "?47h");
            expect(resetMode(UseAlternateScreenBuffer)).toBe(CSI + "?47l");
        });

        it("EnterAlternateScreenBuffer (mode 1047)", () => {
            expect(EnterAlternateScreenBuffer.code).toBe(1047); // This is the DEC Mode 1047 object
            expect(EnterAlternateScreenBuffer.isDecMode).toBeTruthy();
            expect(setMode(EnterAlternateScreenBuffer)).toBe(CSI + "?1047h");
            expect(resetMode(EnterAlternateScreenBuffer)).toBe(CSI + "?1047l");
        });

        it("SaveCursorAndEnterAlternateScreenBuffer (mode 1049 sequences)", () => {
            expect(SaveCursorAndEnterAlternateScreenBuffer.code).toBe(1049); // This is the DEC Mode 1049 object
            expect(SaveCursorAndEnterAlternateScreenBuffer.isDecMode).toBeTruthy();
            // Check the generated sequences for mode 1049
            expect(setMode(SaveCursorAndEnterAlternateScreenBuffer)).toBe(CSI + "?1049h");
            expect(resetMode(SaveCursorAndEnterAlternateScreenBuffer)).toBe(CSI + "?1049l");
        });


        it("bracketedPasteMode", () => {
            expect(BracketedPasteMode.code).toBe(2004);
            expect(BracketedPasteMode.isDecMode).toBeTruthy();
            expect(setMode(BracketedPasteMode)).toBe(CSI + "?2004h");
            expect(resetMode(BracketedPasteMode)).toBe(CSI + "?2004l");
        });
    });

    describe("terminalModes Class", () => {
        let terminalModes: TerminalModes;

        beforeEach(() => {
            terminalModes = new TerminalModes();
        });

        it("should get NotRecognized for an unknown mode", () => {
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.NotRecognized);
        });

        it("should set and get an ANSI mode", () => {
            terminalModes.set(InsertReplaceMode);
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.Set);
            expect(terminalModes.isSet(InsertReplaceMode)).toBeTruthy();
        });

        it("should set and get a DEC mode", () => {
            terminalModes.set(TextCursorEnableMode);
            expect(terminalModes.get(TextCursorEnableMode)).toBe(ModeSetting.Set);
            expect(terminalModes.isSet(TextCursorEnableMode)).toBeTruthy();
        });

        it("should differentiate ANSI and DEC modes with the same code if they existed", () => {
            const ansiMode400 = createAnsiMode(400);
            const decMode400 = createDecMode(400);

            terminalModes.set(ansiMode400);
            expect(terminalModes.get(ansiMode400)).toBe(ModeSetting.Set);
            expect(terminalModes.get(decMode400)).toBe(ModeSetting.NotRecognized);

            terminalModes.reset(); // Clear previous before setting decMode400 to avoid interference for this specific test logic

            terminalModes.set(decMode400);
            expect(terminalModes.get(decMode400)).toBe(ModeSetting.Set);
            expect(terminalModes.get(ansiMode400)).toBe(ModeSetting.NotRecognized); // Ansi mode should be NotRecognized now
        });

        it("should permanently set a mode", () => {
            terminalModes.permanentlySet(InsertReplaceMode);
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.PermanentlySet);
            expect(terminalModes.isPermanentlySet(InsertReplaceMode)).toBeTruthy();
            expect(terminalModes.isSet(InsertReplaceMode)).toBeTruthy();
        });

        it("should reset a mode", () => {
            terminalModes.set(InsertReplaceMode);
            terminalModes.reset(InsertReplaceMode);
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.Reset);
            expect(terminalModes.isReset(InsertReplaceMode)).toBeTruthy();
        });

        it("should permanently reset a mode", () => {
            terminalModes.set(InsertReplaceMode);
            terminalModes.permanentlyReset(InsertReplaceMode);
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.PermanentlyReset);
            expect(terminalModes.isPermanentlyReset(InsertReplaceMode)).toBeTruthy();
            expect(terminalModes.isReset(InsertReplaceMode)).toBeTruthy();
        });

        it("should delete a mode", () => {
            terminalModes.set(InsertReplaceMode);
            terminalModes.delete(InsertReplaceMode);
            expect(terminalModes.get(InsertReplaceMode)).toBe(ModeSetting.NotRecognized);
        });

        it("should handle multiple modes for set, reset, etc.", () => {
            terminalModes.set(InsertReplaceMode, KeyboardActionMode);
            expect(terminalModes.isSet(InsertReplaceMode)).toBeTruthy();
            expect(terminalModes.isSet(KeyboardActionMode)).toBeTruthy();

            terminalModes.reset(InsertReplaceMode, TextCursorEnableMode); // Reset IRM, also set TextCursorEnableMode to Reset
            expect(terminalModes.isReset(InsertReplaceMode)).toBeTruthy();
            expect(terminalModes.isSet(KeyboardActionMode)).toBeTruthy();
            expect(terminalModes.isReset(TextCursorEnableMode)).toBeTruthy();
        });

        it("delete should only affect the specified mode type (conceptual)", () => {
            const ansi401 = createAnsiMode(401);
            const dec401 = createDecMode(401);
            terminalModes.set(ansi401);
            terminalModes.set(dec401);

            expect(terminalModes.isSet(ansi401)).toBeTruthy();
            expect(terminalModes.isSet(dec401)).toBeTruthy();

            terminalModes.delete(ansi401);
            expect(terminalModes.get(ansi401)).toBe(ModeSetting.NotRecognized);
            expect(terminalModes.isSet(dec401)).toBeTruthy();

            terminalModes.delete(dec401);
            expect(terminalModes.get(dec401)).toBe(ModeSetting.NotRecognized);
        });
    });
});
