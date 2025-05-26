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
    RequestSgrExtMouseMode as RequestSgrExtensionMouseMode,
    RequestSgrPixelExtMouseMode as RequestSgrPixelExtensionMouseMode,
    RequestSynchronizedOutputMode,
    RequestTextCursorEnableMode,
    RequestUrxvtExtMouseMode as RequestUrxvtExtensionMouseMode,
    RequestUtf8ExtMouseMode as RequestUtf8ExtensionMouseMode,
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
    ResetSgrExtMouseMode as ResetSgrExtensionMouseMode,
    ResetSgrPixelExtMouseMode as ResetSgrPixelExtensionMouseMode,
    ResetSynchronizedOutputMode,
    ResetTextCursorEnableMode,
    ResetUrxvtExtMouseMode as ResetUrxvtExtensionMouseMode,
    ResetUtf8ExtMouseMode as ResetUtf8ExtensionMouseMode,
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
    SetSgrExtMouseMode as SetSgrExtensionMouseMode,
    SetSgrPixelExtMouseMode as SetSgrPixelExtensionMouseMode,
    SetSynchronizedOutputMode,
    SetTextCursorEnableMode,
    SetUrxvtExtMouseMode as SetUrxvtExtensionMouseMode,
    SetUtf8ExtMouseMode as SetUtf8ExtensionMouseMode,
    SetWin32InputMode,
    SetX10MouseMode,
    SgrExtMouseMode as SgrExtensionMouseMode,
    SgrPixelExtMouseMode as SgrPixelExtensionMouseMode,
    ShowCursor,
    SM,
    SRM,
    SynchronizedOutputMode,
    TextCursorEnableMode,
    UrxvtExtMouseMode as UrxvtExtensionMouseMode,
    Utf8ExtMouseMode as Utf8ExtensionMouseMode,
    Win32InputMode,
    X10MouseMode,
} from "../../src/mode";

describe("mode Utilities", () => {
    describe("modeSetting helpers", () => {
        it("isModeNotRecognized should work", () => {
            expect.assertions(2);
            
            expect(isModeNotRecognized(ModeSetting.NotRecognized)).toBe(true);
            expect(isModeNotRecognized(ModeSetting.Set)).toBe(false);
        });

        it("isModeSet should work", () => {
            expect.assertions(3);
            
            expect(isModeSet(ModeSetting.Set)).toBe(true);
            expect(isModeSet(ModeSetting.PermanentlySet)).toBe(true);
            expect(isModeSet(ModeSetting.Reset)).toBe(false);
        });

        it("isModeReset should work", () => {
            expect.assertions(3);
            
            expect(isModeReset(ModeSetting.Reset)).toBe(true);
            expect(isModeReset(ModeSetting.PermanentlyReset)).toBe(true);
            expect(isModeReset(ModeSetting.Set)).toBe(false);
        });

        it("isModePermanentlySet should work", () => {
            expect.assertions(2);
            
            expect(isModePermanentlySet(ModeSetting.PermanentlySet)).toBe(true);
            expect(isModePermanentlySet(ModeSetting.Set)).toBe(false);
        });

        it("isModePermanentlyReset should work", () => {
            expect.assertions(2);
            
            expect(isModePermanentlyReset(ModeSetting.PermanentlyReset)).toBe(true);
            expect(isModePermanentlyReset(ModeSetting.Reset)).toBe(false);
        });
    });

    describe("mode Creation", () => {
        it("should create ANSI mode", () => {
            expect.assertions(2);

            
            const mode = createAnsiMode(4);

            expect(mode.code).toBe(4);
            expect(mode.isDecMode).toBe(false);
        });

        it("should create DEC mode", () => {
            expect.assertions(2);

            
            const mode = createDecMode(25);

            expect(mode.code).toBe(25);
            expect(mode.isDecMode).toBe(true);
        });
    });

    describe("setMode (SM)", () => {
        it("should set a single ANSI mode", () => {
            expect.assertions(2);
            
            expect(setMode(InsertReplaceMode)).toBe(`${CSI}4h`);
            expect(SM(InsertReplaceMode)).toBe(`${CSI}4h`);
        });

        it("should set a single DEC mode", () => {
            expect.assertions(2);
            
            expect(setMode(TextCursorEnableMode)).toBe(`${CSI}?25h`);
            expect(SM(TextCursorEnableMode)).toBe(`${CSI}?25h`);
        });

        it("should set multiple ANSI modes", () => {
            expect.assertions(1);

            
            const irm = createAnsiMode(4);
            const kam = createAnsiMode(2);

            expect(setMode(irm, kam)).toBe(`${CSI}4;2h`);
        });

        it("should set multiple DEC modes", () => {
            expect.assertions(1);

            
            const dec25 = createDecMode(25);
            const dec7 = createDecMode(7); // AutoWrapMode

            expect(setMode(dec25, dec7)).toBe(`${CSI}?25;7h`);
        });

        it("should set mixed ANSI and DEC modes", () => {
            expect.assertions(1);

            
            const irm = createAnsiMode(4); // InsertReplaceMode
            const dec25 = createDecMode(25); // TextCursorEnableMode
            const kam = createAnsiMode(2); // KeyboardActionMode
            const dec7 = createDecMode(7); // AutoWrapMode
            const result = setMode(irm, dec25, kam, dec7);

            // The order of ANSI vs DEC groups is not strictly guaranteed by the implementation if both exist.
            // The current implementation outputs ANSI first, then DEC.
            expect(result).toBe(`${CSI}4;2h${CSI}?25;7h`);
        });

        it("should return empty string for no modes", () => {
            expect.assertions(1);
            
            expect(setMode()).toBe("");
        });
    });

    describe("resetMode (RM)", () => {
        it("should reset a single ANSI mode", () => {
            expect.assertions(2);
            
            expect(resetMode(InsertReplaceMode)).toBe(`${CSI}4l`);
            expect(RM(InsertReplaceMode)).toBe(`${CSI}4l`);
        });

        it("should reset a single DEC mode", () => {
            expect.assertions(2);
            
            expect(resetMode(TextCursorEnableMode)).toBe(`${CSI}?25l`);
            expect(RM(TextCursorEnableMode)).toBe(`${CSI}?25l`);
        });

        it("should reset multiple ANSI modes", () => {
            expect.assertions(1);

            
            const irm = createAnsiMode(4);
            const kam = createAnsiMode(2);

            expect(resetMode(irm, kam)).toBe(`${CSI}4;2l`);
        });

        it("should reset multiple DEC modes", () => {
            expect.assertions(1);

            
            const dec25 = createDecMode(25);
            const dec7 = createDecMode(7);

            expect(resetMode(dec25, dec7)).toBe(`${CSI}?25;7l`);
        });

        it("should reset mixed ANSI and DEC modes", () => {
            expect.assertions(1);

            
            const irm = createAnsiMode(4);
            const dec25 = createDecMode(25);
            const result = resetMode(irm, dec25);

            // The order of ANSI vs DEC groups is not strictly guaranteed.
            // The current implementation outputs ANSI first, then DEC.
            expect(result).toBe(`${CSI}4l${CSI}?25l`);
        });

        it("should return empty string for no modes", () => {
            expect.assertions(1);
            
            expect(resetMode()).toBe("");
        });
    });

    describe("requestMode (DECRQM)", () => {
        it("should request an ANSI mode", () => {
            expect.assertions(2);
            
            expect(requestMode(InsertReplaceMode)).toBe(`${CSI}4$p`);
            expect(DECRQM(InsertReplaceMode)).toBe(`${CSI}4$p`);
        });

        it("should request a DEC mode", () => {
            expect.assertions(2);
            
            expect(requestMode(TextCursorEnableMode)).toBe(`${CSI}?25$p`);
            expect(DECRQM(TextCursorEnableMode)).toBe(`${CSI}?25$p`);
        });
    });

    describe("reportMode (DECRPM)", () => {
        it("should report an ANSI mode as Set", () => {
            expect.assertions(2);
            
            expect(reportMode(InsertReplaceMode, ModeSetting.Set)).toBe(`${CSI}4;1$y`);
            expect(DECRPM(InsertReplaceMode, ModeSetting.Set)).toBe(`${CSI}4;1$y`);
        });

        it("should report a DEC mode as Reset", () => {
            expect.assertions(1);
            
            expect(reportMode(TextCursorEnableMode, ModeSetting.Reset)).toBe(`${CSI}?25;2$y`);
        });

        it("should report PermanentlySet", () => {
            expect.assertions(1);
            
            expect(reportMode(TextCursorEnableMode, ModeSetting.PermanentlySet)).toBe(`${CSI}?25;3$y`);
        });

        it("should report PermanentlyReset", () => {
            expect.assertions(1);
            
            expect(reportMode(TextCursorEnableMode, ModeSetting.PermanentlyReset)).toBe(`${CSI}?25;4$y`);
        });

        it("should report NotRecognized for invalid value > 4", () => {
            expect.assertions(1);
            
            expect(reportMode(InsertReplaceMode, 5 as ModeSetting)).toBe(`${CSI}4;0$y`);
        });

        it("should report NotRecognized for ModeSetting.NotRecognized", () => {
            expect.assertions(1);
            
            expect(reportMode(InsertReplaceMode, ModeSetting.NotRecognized)).toBe(`${CSI}4;0$y`);
        });
    });

    describe("predefined Mode Object Constants and String Constants", () => {
        // ANSI Modes
        it("keyboardActionMode (KAM) - ANSI Mode 2", () => {
            expect.assertions(9);
            
            expect(KeyboardActionMode.code).toBe(2);
            expect(KeyboardActionMode.isDecMode).toBe(false);
            expect(KAM.code).toBe(2);
            expect(setMode(KeyboardActionMode)).toBe(SetKeyboardActionMode);
            expect(resetMode(KeyboardActionMode)).toBe(ResetKeyboardActionMode);
            expect(requestMode(KeyboardActionMode)).toBe(RequestKeyboardActionMode);
            expect(SetKeyboardActionMode).toBe(`${CSI}2h`);
            expect(ResetKeyboardActionMode).toBe(`${CSI}2l`);
            expect(RequestKeyboardActionMode).toBe(`${CSI}2$p`);
        });

        it("insertReplaceMode (IRM) - ANSI Mode 4", () => {
            expect.assertions(9);
            
            expect(InsertReplaceMode.code).toBe(4);
            expect(InsertReplaceMode.isDecMode).toBe(false);
            expect(IRM.code).toBe(4);
            expect(setMode(InsertReplaceMode)).toBe(SetInsertReplaceMode);
            expect(resetMode(InsertReplaceMode)).toBe(ResetInsertReplaceMode);
            expect(requestMode(InsertReplaceMode)).toBe(RequestInsertReplaceMode);
            expect(SetInsertReplaceMode).toBe(`${CSI}4h`);
            expect(ResetInsertReplaceMode).toBe(`${CSI}4l`);
            expect(RequestInsertReplaceMode).toBe(`${CSI}4$p`);
        });

        it("biDirectionalSupportMode (BDSM) - ANSI Mode 8", () => {
            expect.assertions(9);
            
            
            expect(BiDirectionalSupportMode.code).toBe(8);
            expect(BiDirectionalSupportMode.isDecMode).toBe(false);
            expect(BDSM.code).toBe(8);
            expect(setMode(BiDirectionalSupportMode)).toBe(SetBiDirectionalSupportMode);
            expect(resetMode(BiDirectionalSupportMode)).toBe(ResetBiDirectionalSupportMode);
            expect(requestMode(BiDirectionalSupportMode)).toBe(RequestBiDirectionalSupportMode);
            expect(SetBiDirectionalSupportMode).toBe(`${CSI}8h`);
            expect(ResetBiDirectionalSupportMode).toBe(`${CSI}8l`);
            expect(RequestBiDirectionalSupportMode).toBe(`${CSI}8$p`);
        });

        it("sendReceiveMode (SRM/LocalEchoMode) - ANSI Mode 12", () => {
            expect.assertions(13);

            
            expect(SendReceiveMode.code).toBe(12);
            expect(SendReceiveMode.isDecMode).toBe(false);
            expect(SRM.code).toBe(12);
            expect(LocalEchoMode.code).toBe(12);
            expect(setMode(SendReceiveMode)).toBe(SetSendReceiveMode);
            expect(resetMode(SendReceiveMode)).toBe(ResetSendReceiveMode);
            expect(requestMode(SendReceiveMode)).toBe(RequestSendReceiveMode);
            expect(SetSendReceiveMode).toBe(`${CSI}12h`);
            expect(ResetSendReceiveMode).toBe(`${CSI}12l`);
            expect(RequestSendReceiveMode).toBe(`${CSI}12$p`);
            expect(SetLocalEchoMode).toBe(SetSendReceiveMode);
            expect(ResetLocalEchoMode).toBe(ResetSendReceiveMode);
            expect(RequestLocalEchoMode).toBe(RequestSendReceiveMode);
        });

        it("lineFeedNewLineMode (LNM) - ANSI Mode 20", () => {
            expect.assertions(9);
            
            expect(LineFeedNewLineMode.code).toBe(20);
            expect(LineFeedNewLineMode.isDecMode).toBe(false);
            expect(LNM.code).toBe(20);
            expect(setMode(LineFeedNewLineMode)).toBe(SetLineFeedNewLineMode);
            expect(resetMode(LineFeedNewLineMode)).toBe(ResetLineFeedNewLineMode);
            expect(requestMode(LineFeedNewLineMode)).toBe(RequestLineFeedNewLineMode);
            expect(SetLineFeedNewLineMode).toBe(`${CSI}20h`);
            expect(ResetLineFeedNewLineMode).toBe(`${CSI}20l`);
            expect(RequestLineFeedNewLineMode).toBe(`${CSI}20$p`);
        });

        // DEC Modes
        it("cursorKeysMode (DECCKM) - DEC Mode 1", () => {
            expect.assertions(9);
            
            expect(CursorKeysMode.code).toBe(1);
            expect(CursorKeysMode.isDecMode).toBe(true);
            expect(DECCKM.code).toBe(1);
            expect(setMode(CursorKeysMode)).toBe(SetCursorKeysMode);
            expect(resetMode(CursorKeysMode)).toBe(ResetCursorKeysMode);
            expect(requestMode(CursorKeysMode)).toBe(RequestCursorKeysMode);
            expect(SetCursorKeysMode).toBe(`${CSI}?1h`);
            expect(ResetCursorKeysMode).toBe(`${CSI}?1l`);
            expect(RequestCursorKeysMode).toBe(`${CSI}?1$p`);
        });

        it("originMode (DECOM) - DEC Mode 6", () => {
            expect.assertions(9);
            
            expect(OriginMode.code).toBe(6);
            expect(OriginMode.isDecMode).toBe(true);
            expect(DECOM.code).toBe(6);
            expect(setMode(OriginMode)).toBe(SetOriginMode);
            expect(resetMode(OriginMode)).toBe(ResetOriginMode);
            expect(requestMode(OriginMode)).toBe(RequestOriginMode);
            expect(SetOriginMode).toBe(`${CSI}?6h`);
            expect(ResetOriginMode).toBe(`${CSI}?6l`);
            expect(RequestOriginMode).toBe(`${CSI}?6$p`);
        });

        it("autoWrapMode (DECAWM) - DEC Mode 7", () => {
            expect.assertions(9);
            
            expect(AutoWrapMode.code).toBe(7);
            expect(AutoWrapMode.isDecMode).toBe(true);
            expect(DECAWM.code).toBe(7);
            expect(setMode(AutoWrapMode)).toBe(SetAutoWrapMode);
            expect(resetMode(AutoWrapMode)).toBe(ResetAutoWrapMode);
            expect(requestMode(AutoWrapMode)).toBe(RequestAutoWrapMode);
            expect(SetAutoWrapMode).toBe(`${CSI}?7h`);
            expect(ResetAutoWrapMode).toBe(`${CSI}?7l`);
            expect(RequestAutoWrapMode).toBe(`${CSI}?7$p`);
        });

        it("x10MouseMode - DEC Mode 9", () => {
            expect.assertions(8);
            
            expect(X10MouseMode.code).toBe(9);
            expect(X10MouseMode.isDecMode).toBe(true);
            expect(setMode(X10MouseMode)).toBe(SetX10MouseMode);
            expect(resetMode(X10MouseMode)).toBe(ResetX10MouseMode);
            expect(requestMode(X10MouseMode)).toBe(RequestX10MouseMode);
            expect(SetX10MouseMode).toBe(`${CSI}?9h`);
            expect(ResetX10MouseMode).toBe(`${CSI}?9l`);
            expect(RequestX10MouseMode).toBe(`${CSI}?9$p`);
        });

        it("textCursorEnableMode (DECTCEM) - DEC Mode 25", () => {
            expect.assertions(11);
            
            expect(TextCursorEnableMode.code).toBe(25);
            expect(TextCursorEnableMode.isDecMode).toBe(true);
            expect(DECTCEM.code).toBe(25);
            expect(setMode(TextCursorEnableMode)).toBe(SetTextCursorEnableMode);
            expect(resetMode(TextCursorEnableMode)).toBe(ResetTextCursorEnableMode);
            expect(requestMode(TextCursorEnableMode)).toBe(RequestTextCursorEnableMode);
            expect(SetTextCursorEnableMode).toBe(`${CSI}?25h`);
            expect(ResetTextCursorEnableMode).toBe(`${CSI}?25l`);
            expect(RequestTextCursorEnableMode).toBe(`${CSI}?25$p`);
            expect(ShowCursor).toBe(SetTextCursorEnableMode);
            expect(HideCursor).toBe(ResetTextCursorEnableMode);
        });

        it("numericKeypadMode (DECNKM) - DEC Mode 66", () => {
            expect.assertions(9);
            
            expect(NumericKeypadMode.code).toBe(66);
            expect(NumericKeypadMode.isDecMode).toBe(true);
            expect(DECNKM.code).toBe(66);
            expect(setMode(NumericKeypadMode)).toBe(SetNumericKeypadMode);
            expect(resetMode(NumericKeypadMode)).toBe(ResetNumericKeypadMode);
            expect(requestMode(NumericKeypadMode)).toBe(RequestNumericKeypadMode);
            expect(SetNumericKeypadMode).toBe(`${CSI}?66h`);
            expect(ResetNumericKeypadMode).toBe(`${CSI}?66l`);
            expect(RequestNumericKeypadMode).toBe(`${CSI}?66$p`);
        });

        it("backarrowKeyMode (DECBKM) - DEC Mode 67", () => {
            expect.assertions(9);
            
            expect(BackarrowKeyMode.code).toBe(67);
            expect(BackarrowKeyMode.isDecMode).toBe(true);
            expect(DECBKM.code).toBe(67);
            expect(setMode(BackarrowKeyMode)).toBe(SetBackarrowKeyMode);
            expect(resetMode(BackarrowKeyMode)).toBe(ResetBackarrowKeyMode);
            expect(requestMode(BackarrowKeyMode)).toBe(RequestBackarrowKeyMode);
            expect(SetBackarrowKeyMode).toBe(`${CSI}?67h`);
            expect(ResetBackarrowKeyMode).toBe(`${CSI}?67l`);
            expect(RequestBackarrowKeyMode).toBe(`${CSI}?67$p`);
        });

        it("leftRightMarginMode (DECLRMM) - DEC Mode 69", () => {
            expect.assertions(9);
            
            expect(LeftRightMarginMode.code).toBe(69);
            expect(LeftRightMarginMode.isDecMode).toBe(true);
            expect(DECLRMM.code).toBe(69);
            expect(setMode(LeftRightMarginMode)).toBe(SetLeftRightMarginMode);
            expect(resetMode(LeftRightMarginMode)).toBe(ResetLeftRightMarginMode);
            expect(requestMode(LeftRightMarginMode)).toBe(RequestLeftRightMarginMode);
            expect(SetLeftRightMarginMode).toBe(`${CSI}?69h`);
            expect(ResetLeftRightMarginMode).toBe(`${CSI}?69l`);
            expect(RequestLeftRightMarginMode).toBe(`${CSI}?69$p`);
        });

        it("normalMouseMode - DEC Mode 1000", () => {
            expect.assertions(8);
            
            expect(NormalMouseMode.code).toBe(1000);
            expect(NormalMouseMode.isDecMode).toBe(true);
            expect(setMode(NormalMouseMode)).toBe(SetNormalMouseMode);
            expect(resetMode(NormalMouseMode)).toBe(ResetNormalMouseMode);
            expect(requestMode(NormalMouseMode)).toBe(RequestNormalMouseMode);
            expect(SetNormalMouseMode).toBe(`${CSI}?1000h`);
            expect(ResetNormalMouseMode).toBe(`${CSI}?1000l`);
            expect(RequestNormalMouseMode).toBe(`${CSI}?1000$p`);
        });

        it("highlightMouseMode - DEC Mode 1001", () => {
            expect.assertions(8);
            
            expect(HighlightMouseMode.code).toBe(1001);
            expect(HighlightMouseMode.isDecMode).toBe(true);
            expect(setMode(HighlightMouseMode)).toBe(SetHighlightMouseMode);
            expect(resetMode(HighlightMouseMode)).toBe(ResetHighlightMouseMode);
            expect(requestMode(HighlightMouseMode)).toBe(RequestHighlightMouseMode);
            expect(SetHighlightMouseMode).toBe(`${CSI}?1001h`);
            expect(ResetHighlightMouseMode).toBe(`${CSI}?1001l`);
            expect(RequestHighlightMouseMode).toBe(`${CSI}?1001$p`);
        });

        it("buttonEventMouseMode - DEC Mode 1002", () => {
            expect.assertions(8);
            
            expect(ButtonEventMouseMode.code).toBe(1002);
            expect(ButtonEventMouseMode.isDecMode).toBe(true);
            expect(setMode(ButtonEventMouseMode)).toBe(SetButtonEventMouseMode);
            expect(resetMode(ButtonEventMouseMode)).toBe(ResetButtonEventMouseMode);
            expect(requestMode(ButtonEventMouseMode)).toBe(RequestButtonEventMouseMode);
            expect(SetButtonEventMouseMode).toBe(`${CSI}?1002h`);
            expect(ResetButtonEventMouseMode).toBe(`${CSI}?1002l`);
            expect(RequestButtonEventMouseMode).toBe(`${CSI}?1002$p`);
        });

        it("anyEventMouseMode - DEC Mode 1003", () => {
            expect.assertions(8);
            
            expect(AnyEventMouseMode.code).toBe(1003);
            expect(AnyEventMouseMode.isDecMode).toBe(true);
            expect(setMode(AnyEventMouseMode)).toBe(SetAnyEventMouseMode);
            expect(resetMode(AnyEventMouseMode)).toBe(ResetAnyEventMouseMode);
            expect(requestMode(AnyEventMouseMode)).toBe(RequestAnyEventMouseMode);
            expect(SetAnyEventMouseMode).toBe(`${CSI}?1003h`);
            expect(ResetAnyEventMouseMode).toBe(`${CSI}?1003l`);
            expect(RequestAnyEventMouseMode).toBe(`${CSI}?1003$p`);
        });

        it("focusEventMode - DEC Mode 1004", () => {
            expect.assertions(8);
            
            expect(FocusEventMode.code).toBe(1004);
            expect(FocusEventMode.isDecMode).toBe(true);
            expect(setMode(FocusEventMode)).toBe(SetFocusEventMode);
            expect(resetMode(FocusEventMode)).toBe(ResetFocusEventMode);
            expect(requestMode(FocusEventMode)).toBe(RequestFocusEventMode);
            expect(SetFocusEventMode).toBe(`${CSI}?1004h`);
            expect(ResetFocusEventMode).toBe(`${CSI}?1004l`);
            expect(RequestFocusEventMode).toBe(`${CSI}?1004$p`);
        });

        it("utf8ExtMouseMode - DEC Mode 1005", () => {
            expect.assertions(8);
            
            expect(Utf8ExtensionMouseMode.code).toBe(1005);
            expect(Utf8ExtensionMouseMode.isDecMode).toBe(true);
            expect(setMode(Utf8ExtensionMouseMode)).toBe(SetUtf8ExtensionMouseMode);
            expect(resetMode(Utf8ExtensionMouseMode)).toBe(ResetUtf8ExtensionMouseMode);
            expect(requestMode(Utf8ExtensionMouseMode)).toBe(RequestUtf8ExtensionMouseMode);
            expect(SetUtf8ExtensionMouseMode).toBe(`${CSI}?1005h`);
            expect(ResetUtf8ExtensionMouseMode).toBe(`${CSI}?1005l`);
            expect(RequestUtf8ExtensionMouseMode).toBe(`${CSI}?1005$p`);
        });

        it("sgrExtMouseMode - DEC Mode 1006", () => {
            expect.assertions(8);
            
            expect(SgrExtensionMouseMode.code).toBe(1006);
            expect(SgrExtensionMouseMode.isDecMode).toBe(true);
            expect(setMode(SgrExtensionMouseMode)).toBe(SetSgrExtensionMouseMode);
            expect(resetMode(SgrExtensionMouseMode)).toBe(ResetSgrExtensionMouseMode);
            expect(requestMode(SgrExtensionMouseMode)).toBe(RequestSgrExtensionMouseMode);
            expect(SetSgrExtensionMouseMode).toBe(`${CSI}?1006h`);
            expect(ResetSgrExtensionMouseMode).toBe(`${CSI}?1006l`);
            expect(RequestSgrExtensionMouseMode).toBe(`${CSI}?1006$p`);
        });

        it("urxvtExtMouseMode - DEC Mode 1015", () => {
            expect.assertions(8);
            
            expect(UrxvtExtensionMouseMode.code).toBe(1015);
            expect(UrxvtExtensionMouseMode.isDecMode).toBe(true);
            expect(setMode(UrxvtExtensionMouseMode)).toBe(SetUrxvtExtensionMouseMode);
            expect(resetMode(UrxvtExtensionMouseMode)).toBe(ResetUrxvtExtensionMouseMode);
            expect(requestMode(UrxvtExtensionMouseMode)).toBe(RequestUrxvtExtensionMouseMode);
            expect(SetUrxvtExtensionMouseMode).toBe(`${CSI}?1015h`);
            expect(ResetUrxvtExtensionMouseMode).toBe(`${CSI}?1015l`);
            expect(RequestUrxvtExtensionMouseMode).toBe(`${CSI}?1015$p`);
        });

        it("sgrPixelExtMouseMode - DEC Mode 1016", () => {
            expect.assertions(8);
            
            expect(SgrPixelExtensionMouseMode.code).toBe(1016);
            expect(SgrPixelExtensionMouseMode.isDecMode).toBe(true);
            expect(setMode(SgrPixelExtensionMouseMode)).toBe(SetSgrPixelExtensionMouseMode);
            expect(resetMode(SgrPixelExtensionMouseMode)).toBe(ResetSgrPixelExtensionMouseMode);
            expect(requestMode(SgrPixelExtensionMouseMode)).toBe(RequestSgrPixelExtensionMouseMode);
            expect(SetSgrPixelExtensionMouseMode).toBe(`${CSI}?1016h`);
            expect(ResetSgrPixelExtensionMouseMode).toBe(`${CSI}?1016l`);
            expect(RequestSgrPixelExtensionMouseMode).toBe(`${CSI}?1016$p`);
        });

        it("altScreenMode - DEC Mode 1047", () => {
            expect.assertions(8);
            
            expect(AltScreenMode.code).toBe(1047);
            expect(AltScreenMode.isDecMode).toBe(true);
            expect(setMode(AltScreenMode)).toBe(SetAltScreenMode);
            expect(resetMode(AltScreenMode)).toBe(ResetAltScreenMode);
            expect(requestMode(AltScreenMode)).toBe(RequestAltScreenMode);
            expect(SetAltScreenMode).toBe(`${CSI}?1047h`);
            expect(ResetAltScreenMode).toBe(`${CSI}?1047l`);
            expect(RequestAltScreenMode).toBe(`${CSI}?1047$p`);
        });

        it("saveCursorMode - DEC Mode 1048", () => {
            expect.assertions(8);
            
            expect(SaveCursorMode.code).toBe(1048);
            expect(SaveCursorMode.isDecMode).toBe(true);
            expect(setMode(SaveCursorMode)).toBe(SetSaveCursorMode);
            expect(resetMode(SaveCursorMode)).toBe(ResetSaveCursorMode);
            expect(requestMode(SaveCursorMode)).toBe(RequestSaveCursorMode);
            expect(SetSaveCursorMode).toBe(`${CSI}?1048h`);
            expect(ResetSaveCursorMode).toBe(`${CSI}?1048l`);
            expect(RequestSaveCursorMode).toBe(`${CSI}?1048$p`);
        });

        it("altScreenSaveCursorMode - DEC Mode 1049", () => {
            expect.assertions(8);
            
            expect(AltScreenSaveCursorMode.code).toBe(1049);
            expect(AltScreenSaveCursorMode.isDecMode).toBe(true);
            expect(setMode(AltScreenSaveCursorMode)).toBe(SetAltScreenSaveCursorMode);
            expect(resetMode(AltScreenSaveCursorMode)).toBe(ResetAltScreenSaveCursorMode);
            expect(requestMode(AltScreenSaveCursorMode)).toBe(RequestAltScreenSaveCursorMode);
            expect(SetAltScreenSaveCursorMode).toBe(`${CSI}?1049h`);
            expect(ResetAltScreenSaveCursorMode).toBe(`${CSI}?1049l`);
            expect(RequestAltScreenSaveCursorMode).toBe(`${CSI}?1049$p`);
        });

        it("bracketedPasteMode - DEC Mode 2004", () => {
            expect.assertions(8);
            
            expect(BracketedPasteMode.code).toBe(2004);
            expect(BracketedPasteMode.isDecMode).toBe(true);
            expect(setMode(BracketedPasteMode)).toBe(SetBracketedPasteMode);
            expect(resetMode(BracketedPasteMode)).toBe(ResetBracketedPasteMode);
            expect(requestMode(BracketedPasteMode)).toBe(RequestBracketedPasteMode);
            expect(SetBracketedPasteMode).toBe(`${CSI}?2004h`);
            expect(ResetBracketedPasteMode).toBe(`${CSI}?2004l`);
            expect(RequestBracketedPasteMode).toBe(`${CSI}?2004$p`);
        });

        it("synchronizedOutputMode - DEC Mode 2026", () => {
            expect.assertions(8);
            
            expect(SynchronizedOutputMode.code).toBe(2026);
            expect(SynchronizedOutputMode.isDecMode).toBe(true);
            expect(setMode(SynchronizedOutputMode)).toBe(SetSynchronizedOutputMode);
            expect(resetMode(SynchronizedOutputMode)).toBe(ResetSynchronizedOutputMode);
            expect(requestMode(SynchronizedOutputMode)).toBe(RequestSynchronizedOutputMode);
            expect(SetSynchronizedOutputMode).toBe(`${CSI}?2026h`);
            expect(ResetSynchronizedOutputMode).toBe(`${CSI}?2026l`);
            expect(RequestSynchronizedOutputMode).toBe(`${CSI}?2026$p`);
        });

        it("graphemeClusteringMode - DEC Mode 2027", () => {
            expect.assertions(8);
            
            expect(GraphemeClusteringMode.code).toBe(2027);
            expect(GraphemeClusteringMode.isDecMode).toBe(true);
            expect(setMode(GraphemeClusteringMode)).toBe(SetGraphemeClusteringMode);
            expect(resetMode(GraphemeClusteringMode)).toBe(ResetGraphemeClusteringMode);
            expect(requestMode(GraphemeClusteringMode)).toBe(RequestGraphemeClusteringMode);
            expect(SetGraphemeClusteringMode).toBe(`${CSI}?2027h`);
            expect(ResetGraphemeClusteringMode).toBe(`${CSI}?2027l`);
            expect(RequestGraphemeClusteringMode).toBe(`${CSI}?2027$p`);
        });

        it("win32InputMode - DEC Mode 9001", () => {
            expect.assertions(8);
            
            expect(Win32InputMode.code).toBe(9001);
            expect(Win32InputMode.isDecMode).toBe(true);
            expect(setMode(Win32InputMode)).toBe(SetWin32InputMode);
            expect(resetMode(Win32InputMode)).toBe(ResetWin32InputMode);
            expect(requestMode(Win32InputMode)).toBe(RequestWin32InputMode);
            expect(SetWin32InputMode).toBe(`${CSI}?9001h`);
            expect(ResetWin32InputMode).toBe(`${CSI}?9001l`);
            expect(RequestWin32InputMode).toBe(`${CSI}?9001$p`);
        });
    });

    // Remove tests for TerminalModes class as it's no longer exported/used
});
