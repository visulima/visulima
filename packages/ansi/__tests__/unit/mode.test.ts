import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import {
    AltScreenMode,
    AltScreenSaveCursorMode,
    AnyEventMouseMode,
    AutoWrapMode,
    BackarrowKeyMode,
    BDSM,
    BiDirectionalSupportMode,
    BracketedPasteMode,
    ButtonEventMouseMode,
    // Core functions and types
    createAnsiMode,
    createDecMode,
    // DEC Modes
    CursorKeysMode,
    DECAWM,
    DECBKM,
    DECCKM,
    DECLRMM,
    DECNKM,
    DECOM,
    DECRPM,
    DECRQM,
    DECTCEM,
    FocusEventMode,
    GraphemeClusteringMode,
    HideCursor,
    HighlightMouseMode,
    InsertReplaceMode,
    IRM,
    isModeNotRecognized,
    isModePermanentlyReset,
    isModePermanentlySet,
    isModeReset,
    isModeSet,
    KAM,
    // ANSI Modes
    KeyboardActionMode,
    LeftRightMarginMode,
    LineFeedNewLineMode,
    LNM,
    LocalEchoMode,
    ModeSetting,
    NormalMouseMode,
    NumericKeypadMode,
    OriginMode,
    reportMode,
    RequestAltScreenMode,
    RequestAltScreenSaveCursorMode,
    RequestAnyEventMouseMode,
    RequestAutoWrapMode,
    RequestBackarrowKeyMode,
    RequestBiDirectionalSupportMode,
    RequestBracketedPasteMode,
    RequestButtonEventMouseMode,
    RequestCursorKeysMode,
    RequestFocusEventMode,
    RequestGraphemeClusteringMode,
    RequestHighlightMouseMode,
    RequestInsertReplaceMode,
    RequestKeyboardActionMode,
    RequestLeftRightMarginMode,
    RequestLineFeedNewLineMode,
    RequestLocalEchoMode,
    requestMode,
    RequestNormalMouseMode,
    RequestNumericKeypadMode,
    RequestOriginMode,
    RequestSaveCursorMode,
    RequestSendReceiveMode,
    RequestSgrExtMouseMode,
    RequestSgrPixelExtMouseMode,
    RequestSynchronizedOutputMode,
    RequestTextCursorEnableMode,
    RequestUrxvtExtMouseMode,
    RequestUtf8ExtMouseMode,
    RequestWin32InputMode,
    RequestX10MouseMode,
    ResetAltScreenMode,
    ResetAltScreenSaveCursorMode,
    ResetAnyEventMouseMode,
    ResetAutoWrapMode,
    ResetBackarrowKeyMode,
    ResetBiDirectionalSupportMode,
    ResetBracketedPasteMode,
    ResetButtonEventMouseMode,
    ResetCursorKeysMode,
    ResetFocusEventMode,
    ResetGraphemeClusteringMode,
    ResetHighlightMouseMode,
    ResetInsertReplaceMode,
    ResetKeyboardActionMode,
    ResetLeftRightMarginMode,
    ResetLineFeedNewLineMode,
    ResetLocalEchoMode,
    resetMode,
    ResetNormalMouseMode,
    ResetNumericKeypadMode,
    ResetOriginMode,
    ResetSaveCursorMode,
    ResetSendReceiveMode,
    ResetSgrExtMouseMode,
    ResetSgrPixelExtMouseMode,
    ResetSynchronizedOutputMode,
    ResetTextCursorEnableMode,
    ResetUrxvtExtMouseMode,
    ResetUtf8ExtMouseMode,
    ResetWin32InputMode,
    ResetX10MouseMode,
    RM,
    SaveCursorMode,
    SendReceiveMode,
    SetAltScreenMode,
    SetAltScreenSaveCursorMode,
    SetAnyEventMouseMode,
    SetAutoWrapMode,
    SetBackarrowKeyMode,
    SetBiDirectionalSupportMode,
    SetBracketedPasteMode,
    SetButtonEventMouseMode,
    SetCursorKeysMode,
    SetFocusEventMode,
    SetGraphemeClusteringMode,
    SetHighlightMouseMode,
    SetInsertReplaceMode,
    SetKeyboardActionMode,
    SetLeftRightMarginMode,
    SetLineFeedNewLineMode,
    SetLocalEchoMode,
    setMode,
    SetNormalMouseMode,
    SetNumericKeypadMode,
    SetOriginMode,
    SetSaveCursorMode,
    SetSendReceiveMode,
    SetSgrExtMouseMode,
    SetSgrPixelExtMouseMode,
    SetSynchronizedOutputMode,
    SetTextCursorEnableMode,
    SetUrxvtExtMouseMode,
    SetUtf8ExtMouseMode,
    SetWin32InputMode,
    SetX10MouseMode,
    SgrExtMouseMode,
    SgrPixelExtMouseMode,
    ShowCursor,
    SM,
    SRM,
    SynchronizedOutputMode,
    TextCursorEnableMode,
    UrxvtExtMouseMode,
    Utf8ExtMouseMode,
    Win32InputMode,
    X10MouseMode,
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
            const dec7 = createDecMode(7); // AutoWrapMode
            expect(setMode(dec25, dec7)).toBe(CSI + "?25;7h");
        });

        it("should set mixed ANSI and DEC modes", () => {
            const irm = createAnsiMode(4); // InsertReplaceMode
            const dec25 = createDecMode(25); // TextCursorEnableMode
            const kam = createAnsiMode(2); // KeyboardActionMode
            const dec7 = createDecMode(7); // AutoWrapMode
            const result = setMode(irm, dec25, kam, dec7);
            // The order of ANSI vs DEC groups is not strictly guaranteed by the implementation if both exist.
            // The current implementation outputs ANSI first, then DEC.
            expect(result).toBe(CSI + "4;2h" + CSI + "?25;7h");
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
            // The order of ANSI vs DEC groups is not strictly guaranteed.
            // The current implementation outputs ANSI first, then DEC.
            expect(result).toBe(CSI + "4l" + CSI + "?25l");
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

    describe("predefined Mode Object Constants and String Constants", () => {
        // ANSI Modes
        it("KeyboardActionMode (KAM) - ANSI Mode 2", () => {
            expect(KeyboardActionMode.code).toBe(2);
            expect(KeyboardActionMode.isDecMode).toBeFalsy();
            expect(KAM.code).toBe(2);
            expect(setMode(KeyboardActionMode)).toBe(SetKeyboardActionMode);
            expect(resetMode(KeyboardActionMode)).toBe(ResetKeyboardActionMode);
            expect(requestMode(KeyboardActionMode)).toBe(RequestKeyboardActionMode);
            expect(SetKeyboardActionMode).toBe(CSI + "2h");
            expect(ResetKeyboardActionMode).toBe(CSI + "2l");
            expect(RequestKeyboardActionMode).toBe(CSI + "2$p");
        });

        it("InsertReplaceMode (IRM) - ANSI Mode 4", () => {
            expect(InsertReplaceMode.code).toBe(4);
            expect(InsertReplaceMode.isDecMode).toBeFalsy();
            expect(IRM.code).toBe(4);
            expect(setMode(InsertReplaceMode)).toBe(SetInsertReplaceMode);
            expect(resetMode(InsertReplaceMode)).toBe(ResetInsertReplaceMode);
            expect(requestMode(InsertReplaceMode)).toBe(RequestInsertReplaceMode);
            expect(SetInsertReplaceMode).toBe(CSI + "4h");
            expect(ResetInsertReplaceMode).toBe(CSI + "4l");
            expect(RequestInsertReplaceMode).toBe(CSI + "4$p");
        });

        it("BiDirectionalSupportMode (BDSM) - ANSI Mode 8", () => {
            expect(BiDirectionalSupportMode.code).toBe(8);
            expect(BiDirectionalSupportMode.isDecMode).toBeFalsy();
            expect(BDSM.code).toBe(8);
            expect(setMode(BiDirectionalSupportMode)).toBe(SetBiDirectionalSupportMode);
            expect(resetMode(BiDirectionalSupportMode)).toBe(ResetBiDirectionalSupportMode);
            expect(requestMode(BiDirectionalSupportMode)).toBe(RequestBiDirectionalSupportMode);
            expect(SetBiDirectionalSupportMode).toBe(CSI + "8h");
            expect(ResetBiDirectionalSupportMode).toBe(CSI + "8l");
            expect(RequestBiDirectionalSupportMode).toBe(CSI + "8$p");
        });

        it("SendReceiveMode (SRM/LocalEchoMode) - ANSI Mode 12", () => {
            expect(SendReceiveMode.code).toBe(12);
            expect(SendReceiveMode.isDecMode).toBeFalsy();
            expect(SRM.code).toBe(12);
            expect(LocalEchoMode.code).toBe(12);
            expect(setMode(SendReceiveMode)).toBe(SetSendReceiveMode);
            expect(resetMode(SendReceiveMode)).toBe(ResetSendReceiveMode);
            expect(requestMode(SendReceiveMode)).toBe(RequestSendReceiveMode);
            expect(SetSendReceiveMode).toBe(CSI + "12h");
            expect(ResetSendReceiveMode).toBe(CSI + "12l");
            expect(RequestSendReceiveMode).toBe(CSI + "12$p");
            expect(SetLocalEchoMode).toBe(SetSendReceiveMode);
            expect(ResetLocalEchoMode).toBe(ResetSendReceiveMode);
            expect(RequestLocalEchoMode).toBe(RequestSendReceiveMode);
        });

        it("LineFeedNewLineMode (LNM) - ANSI Mode 20", () => {
            expect(LineFeedNewLineMode.code).toBe(20);
            expect(LineFeedNewLineMode.isDecMode).toBeFalsy();
            expect(LNM.code).toBe(20);
            expect(setMode(LineFeedNewLineMode)).toBe(SetLineFeedNewLineMode);
            expect(resetMode(LineFeedNewLineMode)).toBe(ResetLineFeedNewLineMode);
            expect(requestMode(LineFeedNewLineMode)).toBe(RequestLineFeedNewLineMode);
            expect(SetLineFeedNewLineMode).toBe(CSI + "20h");
            expect(ResetLineFeedNewLineMode).toBe(CSI + "20l");
            expect(RequestLineFeedNewLineMode).toBe(CSI + "20$p");
        });

        // DEC Modes
        it("CursorKeysMode (DECCKM) - DEC Mode 1", () => {
            expect(CursorKeysMode.code).toBe(1);
            expect(CursorKeysMode.isDecMode).toBeTruthy();
            expect(DECCKM.code).toBe(1);
            expect(setMode(CursorKeysMode)).toBe(SetCursorKeysMode);
            expect(resetMode(CursorKeysMode)).toBe(ResetCursorKeysMode);
            expect(requestMode(CursorKeysMode)).toBe(RequestCursorKeysMode);
            expect(SetCursorKeysMode).toBe(CSI + "?1h");
            expect(ResetCursorKeysMode).toBe(CSI + "?1l");
            expect(RequestCursorKeysMode).toBe(CSI + "?1$p");
        });

        it("OriginMode (DECOM) - DEC Mode 6", () => {
            expect(OriginMode.code).toBe(6);
            expect(OriginMode.isDecMode).toBeTruthy();
            expect(DECOM.code).toBe(6);
            expect(setMode(OriginMode)).toBe(SetOriginMode);
            expect(resetMode(OriginMode)).toBe(ResetOriginMode);
            expect(requestMode(OriginMode)).toBe(RequestOriginMode);
            expect(SetOriginMode).toBe(CSI + "?6h");
            expect(ResetOriginMode).toBe(CSI + "?6l");
            expect(RequestOriginMode).toBe(CSI + "?6$p");
        });

        it("AutoWrapMode (DECAWM) - DEC Mode 7", () => {
            expect(AutoWrapMode.code).toBe(7);
            expect(AutoWrapMode.isDecMode).toBeTruthy();
            expect(DECAWM.code).toBe(7);
            expect(setMode(AutoWrapMode)).toBe(SetAutoWrapMode);
            expect(resetMode(AutoWrapMode)).toBe(ResetAutoWrapMode);
            expect(requestMode(AutoWrapMode)).toBe(RequestAutoWrapMode);
            expect(SetAutoWrapMode).toBe(CSI + "?7h");
            expect(ResetAutoWrapMode).toBe(CSI + "?7l");
            expect(RequestAutoWrapMode).toBe(CSI + "?7$p");
        });

        it("X10MouseMode - DEC Mode 9", () => {
            expect(X10MouseMode.code).toBe(9);
            expect(X10MouseMode.isDecMode).toBeTruthy();
            expect(setMode(X10MouseMode)).toBe(SetX10MouseMode);
            expect(resetMode(X10MouseMode)).toBe(ResetX10MouseMode);
            expect(requestMode(X10MouseMode)).toBe(RequestX10MouseMode);
            expect(SetX10MouseMode).toBe(CSI + "?9h");
            expect(ResetX10MouseMode).toBe(CSI + "?9l");
            expect(RequestX10MouseMode).toBe(CSI + "?9$p");
        });

        it("TextCursorEnableMode (DECTCEM) - DEC Mode 25", () => {
            expect(TextCursorEnableMode.code).toBe(25);
            expect(TextCursorEnableMode.isDecMode).toBeTruthy();
            expect(DECTCEM.code).toBe(25);
            expect(setMode(TextCursorEnableMode)).toBe(SetTextCursorEnableMode);
            expect(resetMode(TextCursorEnableMode)).toBe(ResetTextCursorEnableMode);
            expect(requestMode(TextCursorEnableMode)).toBe(RequestTextCursorEnableMode);
            expect(SetTextCursorEnableMode).toBe(CSI + "?25h");
            expect(ResetTextCursorEnableMode).toBe(CSI + "?25l");
            expect(RequestTextCursorEnableMode).toBe(CSI + "?25$p");
            expect(ShowCursor).toBe(SetTextCursorEnableMode);
            expect(HideCursor).toBe(ResetTextCursorEnableMode);
        });

        it("NumericKeypadMode (DECNKM) - DEC Mode 66", () => {
            expect(NumericKeypadMode.code).toBe(66);
            expect(NumericKeypadMode.isDecMode).toBeTruthy();
            expect(DECNKM.code).toBe(66);
            expect(setMode(NumericKeypadMode)).toBe(SetNumericKeypadMode);
            expect(resetMode(NumericKeypadMode)).toBe(ResetNumericKeypadMode);
            expect(requestMode(NumericKeypadMode)).toBe(RequestNumericKeypadMode);
            expect(SetNumericKeypadMode).toBe(CSI + "?66h");
            expect(ResetNumericKeypadMode).toBe(CSI + "?66l");
            expect(RequestNumericKeypadMode).toBe(CSI + "?66$p");
        });

        it("BackarrowKeyMode (DECBKM) - DEC Mode 67", () => {
            expect(BackarrowKeyMode.code).toBe(67);
            expect(BackarrowKeyMode.isDecMode).toBeTruthy();
            expect(DECBKM.code).toBe(67);
            expect(setMode(BackarrowKeyMode)).toBe(SetBackarrowKeyMode);
            expect(resetMode(BackarrowKeyMode)).toBe(ResetBackarrowKeyMode);
            expect(requestMode(BackarrowKeyMode)).toBe(RequestBackarrowKeyMode);
            expect(SetBackarrowKeyMode).toBe(CSI + "?67h");
            expect(ResetBackarrowKeyMode).toBe(CSI + "?67l");
            expect(RequestBackarrowKeyMode).toBe(CSI + "?67$p");
        });

        it("LeftRightMarginMode (DECLRMM) - DEC Mode 69", () => {
            expect(LeftRightMarginMode.code).toBe(69);
            expect(LeftRightMarginMode.isDecMode).toBeTruthy();
            expect(DECLRMM.code).toBe(69);
            expect(setMode(LeftRightMarginMode)).toBe(SetLeftRightMarginMode);
            expect(resetMode(LeftRightMarginMode)).toBe(ResetLeftRightMarginMode);
            expect(requestMode(LeftRightMarginMode)).toBe(RequestLeftRightMarginMode);
            expect(SetLeftRightMarginMode).toBe(CSI + "?69h");
            expect(ResetLeftRightMarginMode).toBe(CSI + "?69l");
            expect(RequestLeftRightMarginMode).toBe(CSI + "?69$p");
        });

        it("NormalMouseMode - DEC Mode 1000", () => {
            expect(NormalMouseMode.code).toBe(1000);
            expect(NormalMouseMode.isDecMode).toBeTruthy();
            expect(setMode(NormalMouseMode)).toBe(SetNormalMouseMode);
            expect(resetMode(NormalMouseMode)).toBe(ResetNormalMouseMode);
            expect(requestMode(NormalMouseMode)).toBe(RequestNormalMouseMode);
            expect(SetNormalMouseMode).toBe(CSI + "?1000h");
            expect(ResetNormalMouseMode).toBe(CSI + "?1000l");
            expect(RequestNormalMouseMode).toBe(CSI + "?1000$p");
        });

        it("HighlightMouseMode - DEC Mode 1001", () => {
            expect(HighlightMouseMode.code).toBe(1001);
            expect(HighlightMouseMode.isDecMode).toBeTruthy();
            expect(setMode(HighlightMouseMode)).toBe(SetHighlightMouseMode);
            expect(resetMode(HighlightMouseMode)).toBe(ResetHighlightMouseMode);
            expect(requestMode(HighlightMouseMode)).toBe(RequestHighlightMouseMode);
            expect(SetHighlightMouseMode).toBe(CSI + "?1001h");
            expect(ResetHighlightMouseMode).toBe(CSI + "?1001l");
            expect(RequestHighlightMouseMode).toBe(CSI + "?1001$p");
        });

        it("ButtonEventMouseMode - DEC Mode 1002", () => {
            expect(ButtonEventMouseMode.code).toBe(1002);
            expect(ButtonEventMouseMode.isDecMode).toBeTruthy();
            expect(setMode(ButtonEventMouseMode)).toBe(SetButtonEventMouseMode);
            expect(resetMode(ButtonEventMouseMode)).toBe(ResetButtonEventMouseMode);
            expect(requestMode(ButtonEventMouseMode)).toBe(RequestButtonEventMouseMode);
            expect(SetButtonEventMouseMode).toBe(CSI + "?1002h");
            expect(ResetButtonEventMouseMode).toBe(CSI + "?1002l");
            expect(RequestButtonEventMouseMode).toBe(CSI + "?1002$p");
        });

        it("AnyEventMouseMode - DEC Mode 1003", () => {
            expect(AnyEventMouseMode.code).toBe(1003);
            expect(AnyEventMouseMode.isDecMode).toBeTruthy();
            expect(setMode(AnyEventMouseMode)).toBe(SetAnyEventMouseMode);
            expect(resetMode(AnyEventMouseMode)).toBe(ResetAnyEventMouseMode);
            expect(requestMode(AnyEventMouseMode)).toBe(RequestAnyEventMouseMode);
            expect(SetAnyEventMouseMode).toBe(CSI + "?1003h");
            expect(ResetAnyEventMouseMode).toBe(CSI + "?1003l");
            expect(RequestAnyEventMouseMode).toBe(CSI + "?1003$p");
        });

        it("FocusEventMode - DEC Mode 1004", () => {
            expect(FocusEventMode.code).toBe(1004);
            expect(FocusEventMode.isDecMode).toBeTruthy();
            expect(setMode(FocusEventMode)).toBe(SetFocusEventMode);
            expect(resetMode(FocusEventMode)).toBe(ResetFocusEventMode);
            expect(requestMode(FocusEventMode)).toBe(RequestFocusEventMode);
            expect(SetFocusEventMode).toBe(CSI + "?1004h");
            expect(ResetFocusEventMode).toBe(CSI + "?1004l");
            expect(RequestFocusEventMode).toBe(CSI + "?1004$p");
        });

        it("Utf8ExtMouseMode - DEC Mode 1005", () => {
            expect(Utf8ExtMouseMode.code).toBe(1005);
            expect(Utf8ExtMouseMode.isDecMode).toBeTruthy();
            expect(setMode(Utf8ExtMouseMode)).toBe(SetUtf8ExtMouseMode);
            expect(resetMode(Utf8ExtMouseMode)).toBe(ResetUtf8ExtMouseMode);
            expect(requestMode(Utf8ExtMouseMode)).toBe(RequestUtf8ExtMouseMode);
            expect(SetUtf8ExtMouseMode).toBe(CSI + "?1005h");
            expect(ResetUtf8ExtMouseMode).toBe(CSI + "?1005l");
            expect(RequestUtf8ExtMouseMode).toBe(CSI + "?1005$p");
        });

        it("SgrExtMouseMode - DEC Mode 1006", () => {
            expect(SgrExtMouseMode.code).toBe(1006);
            expect(SgrExtMouseMode.isDecMode).toBeTruthy();
            expect(setMode(SgrExtMouseMode)).toBe(SetSgrExtMouseMode);
            expect(resetMode(SgrExtMouseMode)).toBe(ResetSgrExtMouseMode);
            expect(requestMode(SgrExtMouseMode)).toBe(RequestSgrExtMouseMode);
            expect(SetSgrExtMouseMode).toBe(CSI + "?1006h");
            expect(ResetSgrExtMouseMode).toBe(CSI + "?1006l");
            expect(RequestSgrExtMouseMode).toBe(CSI + "?1006$p");
        });

        it("UrxvtExtMouseMode - DEC Mode 1015", () => {
            expect(UrxvtExtMouseMode.code).toBe(1015);
            expect(UrxvtExtMouseMode.isDecMode).toBeTruthy();
            expect(setMode(UrxvtExtMouseMode)).toBe(SetUrxvtExtMouseMode);
            expect(resetMode(UrxvtExtMouseMode)).toBe(ResetUrxvtExtMouseMode);
            expect(requestMode(UrxvtExtMouseMode)).toBe(RequestUrxvtExtMouseMode);
            expect(SetUrxvtExtMouseMode).toBe(CSI + "?1015h");
            expect(ResetUrxvtExtMouseMode).toBe(CSI + "?1015l");
            expect(RequestUrxvtExtMouseMode).toBe(CSI + "?1015$p");
        });

        it("SgrPixelExtMouseMode - DEC Mode 1016", () => {
            expect(SgrPixelExtMouseMode.code).toBe(1016);
            expect(SgrPixelExtMouseMode.isDecMode).toBeTruthy();
            expect(setMode(SgrPixelExtMouseMode)).toBe(SetSgrPixelExtMouseMode);
            expect(resetMode(SgrPixelExtMouseMode)).toBe(ResetSgrPixelExtMouseMode);
            expect(requestMode(SgrPixelExtMouseMode)).toBe(RequestSgrPixelExtMouseMode);
            expect(SetSgrPixelExtMouseMode).toBe(CSI + "?1016h");
            expect(ResetSgrPixelExtMouseMode).toBe(CSI + "?1016l");
            expect(RequestSgrPixelExtMouseMode).toBe(CSI + "?1016$p");
        });

        it("AltScreenMode - DEC Mode 1047", () => {
            expect(AltScreenMode.code).toBe(1047);
            expect(AltScreenMode.isDecMode).toBeTruthy();
            expect(setMode(AltScreenMode)).toBe(SetAltScreenMode);
            expect(resetMode(AltScreenMode)).toBe(ResetAltScreenMode);
            expect(requestMode(AltScreenMode)).toBe(RequestAltScreenMode);
            expect(SetAltScreenMode).toBe(CSI + "?1047h");
            expect(ResetAltScreenMode).toBe(CSI + "?1047l");
            expect(RequestAltScreenMode).toBe(CSI + "?1047$p");
        });

        it("SaveCursorMode - DEC Mode 1048", () => {
            expect(SaveCursorMode.code).toBe(1048);
            expect(SaveCursorMode.isDecMode).toBeTruthy();
            expect(setMode(SaveCursorMode)).toBe(SetSaveCursorMode);
            expect(resetMode(SaveCursorMode)).toBe(ResetSaveCursorMode);
            expect(requestMode(SaveCursorMode)).toBe(RequestSaveCursorMode);
            expect(SetSaveCursorMode).toBe(CSI + "?1048h");
            expect(ResetSaveCursorMode).toBe(CSI + "?1048l");
            expect(RequestSaveCursorMode).toBe(CSI + "?1048$p");
        });

        it("AltScreenSaveCursorMode - DEC Mode 1049", () => {
            expect(AltScreenSaveCursorMode.code).toBe(1049);
            expect(AltScreenSaveCursorMode.isDecMode).toBeTruthy();
            expect(setMode(AltScreenSaveCursorMode)).toBe(SetAltScreenSaveCursorMode);
            expect(resetMode(AltScreenSaveCursorMode)).toBe(ResetAltScreenSaveCursorMode);
            expect(requestMode(AltScreenSaveCursorMode)).toBe(RequestAltScreenSaveCursorMode);
            expect(SetAltScreenSaveCursorMode).toBe(CSI + "?1049h");
            expect(ResetAltScreenSaveCursorMode).toBe(CSI + "?1049l");
            expect(RequestAltScreenSaveCursorMode).toBe(CSI + "?1049$p");
        });

        it("BracketedPasteMode - DEC Mode 2004", () => {
            expect(BracketedPasteMode.code).toBe(2004);
            expect(BracketedPasteMode.isDecMode).toBeTruthy();
            expect(setMode(BracketedPasteMode)).toBe(SetBracketedPasteMode);
            expect(resetMode(BracketedPasteMode)).toBe(ResetBracketedPasteMode);
            expect(requestMode(BracketedPasteMode)).toBe(RequestBracketedPasteMode);
            expect(SetBracketedPasteMode).toBe(CSI + "?2004h");
            expect(ResetBracketedPasteMode).toBe(CSI + "?2004l");
            expect(RequestBracketedPasteMode).toBe(CSI + "?2004$p");
        });

        it("SynchronizedOutputMode - DEC Mode 2026", () => {
            expect(SynchronizedOutputMode.code).toBe(2026);
            expect(SynchronizedOutputMode.isDecMode).toBeTruthy();
            expect(setMode(SynchronizedOutputMode)).toBe(SetSynchronizedOutputMode);
            expect(resetMode(SynchronizedOutputMode)).toBe(ResetSynchronizedOutputMode);
            expect(requestMode(SynchronizedOutputMode)).toBe(RequestSynchronizedOutputMode);
            expect(SetSynchronizedOutputMode).toBe(CSI + "?2026h");
            expect(ResetSynchronizedOutputMode).toBe(CSI + "?2026l");
            expect(RequestSynchronizedOutputMode).toBe(CSI + "?2026$p");
        });

        it("GraphemeClusteringMode - DEC Mode 2027", () => {
            expect(GraphemeClusteringMode.code).toBe(2027);
            expect(GraphemeClusteringMode.isDecMode).toBeTruthy();
            expect(setMode(GraphemeClusteringMode)).toBe(SetGraphemeClusteringMode);
            expect(resetMode(GraphemeClusteringMode)).toBe(ResetGraphemeClusteringMode);
            expect(requestMode(GraphemeClusteringMode)).toBe(RequestGraphemeClusteringMode);
            expect(SetGraphemeClusteringMode).toBe(CSI + "?2027h");
            expect(ResetGraphemeClusteringMode).toBe(CSI + "?2027l");
            expect(RequestGraphemeClusteringMode).toBe(CSI + "?2027$p");
        });

        it("Win32InputMode - DEC Mode 9001", () => {
            expect(Win32InputMode.code).toBe(9001);
            expect(Win32InputMode.isDecMode).toBeTruthy();
            expect(setMode(Win32InputMode)).toBe(SetWin32InputMode);
            expect(resetMode(Win32InputMode)).toBe(ResetWin32InputMode);
            expect(requestMode(Win32InputMode)).toBe(RequestWin32InputMode);
            expect(SetWin32InputMode).toBe(CSI + "?9001h");
            expect(ResetWin32InputMode).toBe(CSI + "?9001l");
            expect(RequestWin32InputMode).toBe(CSI + "?9001$p");
        });
    });

    // Remove tests for TerminalModes class as it's no longer exported/used
});
