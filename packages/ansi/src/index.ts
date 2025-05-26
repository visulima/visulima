/**
 * Output a beeping sound.
 */
export const beep = "\u0007";

export {
    ALT_SCREEN_OFF,
    ALT_SCREEN_ON,
    alternativeScreenOff,
    alternativeScreenOn,
} from "./alternative-screen";
export {
    clearLineAndHomeCursor,
    clearScreenAndHomeCursor,
    clearScreenFromTopLeft,
    resetTerminal,
} from "./clear";
export type { CursorStyle } from "./cursor"; // Enum
export {
    CURSOR_BACKWARD_1,
    CURSOR_DOWN_1,
    CURSOR_FORWARD_1,
    CURSOR_UP_1,
    cursorBackward,
    cursorBackwardTab,
    cursorDown,
    cursorForward,
    cursorHide,
    cursorHorizontalAbsolute,
    cursorHorizontalForwardTab,
    cursorLeft,
    cursorMove,
    cursorNextLine,
    cursorPosition,
    cursorPreviousLine,
    cursorRestore, // Function
    cursorSave, // Function
    cursorShow,
    cursorTo,
    cursorToColumn1,
    cursorUp,
    cursorVerticalAbsolute,
    eraseCharacter,
    REQUEST_CURSOR_POSITION,
    REQUEST_EXTENDED_CURSOR_POSITION,
    RESTORE_CURSOR_DEC, // Constant for ESC 8
    SAVE_CURSOR_DEC, // Constant for ESC 7
    setCursorStyle,
} from "./cursor";
export type { EraseDisplayMode, EraseLineMode } from "./erase";
export {
    eraseDisplay,
    eraseDown,
    eraseInLine,
    eraseLine,
    eraseLineEnd,
    eraseLines,
    eraseLineStart,
    eraseScreen,
    eraseUp,
} from "./erase";
export { default as hyperlink } from "./hyperlink";
export type { ImageOptions } from "./image";
export { image } from "./image";
export type { IITerm2Payload, ITerm2FileProps } from "./iterm2";
export {
    IT2_AUTO,
    it2Cells,
    it2Percent,
    it2Pixels,
    iTerm2,
    ITerm2File,
    ITerm2FileEnd,
    ITerm2FilePart,
    ITerm2MultipartFileStart,
} from "./iterm2";
export type {
    AnsiMode,
    DecMode,
    Mode,
    ModeSetting,
} from "./mode";
export {
    BDSM,
    BiDirectionalSupportMode,
    createAnsiMode,
    createDecMode,
    DECRPM,
    DECRQM,
    InsertReplaceMode,
    IRM,
    // decset, // Not directly found in snippets, user might have specific context
    // decrst, // Not directly found in snippets
    isModeNotRecognized,
    isModePermanentlyReset,
    isModePermanentlySet,
    isModeReset,
    isModeSet,
    KAM,
    KeyboardActionMode,
    LineFeedNewLineMode,
    LNM,
    LocalEchoMode,
    reportMode,
    RequestBiDirectionalSupportMode,
    RequestInsertReplaceMode,
    RequestKeyboardActionMode,
    RequestLineFeedNewLineMode,
    RequestLocalEchoMode,
    requestMode,
    RequestSendReceiveMode,
    ResetBiDirectionalSupportMode,
    ResetInsertReplaceMode,
    ResetKeyboardActionMode,
    ResetLineFeedNewLineMode,
    ResetLocalEchoMode,
    resetMode,
    ResetSendReceiveMode,
    RM,
    SendReceiveMode,
    SetBiDirectionalSupportMode,
    SetInsertReplaceMode,
    SetKeyboardActionMode,
    SetLineFeedNewLineMode,
    SetLocalEchoMode,
    setMode,
    SetSendReceiveMode,
    SM,
    SRM,
    // User added: BracketedPasteMode, DisableModifiersMode, OriginMode, SendFocusEventsMode, SGRMouseMode, TextCursorEnableMode.
    // These specific constants need to be verified if they are exported from mode.ts.
    // If they are, they should be added here. Example:
    // BracketedPasteMode, (if exported from mode.ts)
} from "./mode";
export type { MouseButtonType, MouseModifiers } from "./mouse";
export {
    disableMouseAllEventTracking,
    disableMouseButtonEventTracking,
    disableMouseHighlightEventTracking,
    disableMouseSGRModeEventTracking,
    disableMouseURXVTModeEventTracking,
    disableMouseX10EventTracking,
    enableMouseAllEventTracking,
    enableMouseButtonEventTracking,
    enableMouseCellMotionEventTracking,
    enableMouseSGRModeEventTracking,
    enableMouseURXVTModeEventTracking,
    enableMouseX10EventTracking,
    encodeMouseButtonByte,
    MouseButton,
    mouseSgrSequence,
    mouseX10Sequence,
} from "./mouse";
export {
    SCREEN_MAX_LEN_DEFAULT,
    SCREEN_TYPICAL_LIMIT,
    screenPassthrough,
    tmuxPassthrough,
} from "./passthrough";
export {
    RESET_INITIAL_STATE,
    RIS,
} from "./reset";
export {
    clearTabStop,
    deleteCharacter,
    deleteLine,
    insertCharacter,
    insertLine,
    repeatPreviousCharacter,
    requestPresentationStateReport,
    setLeftRightMargins,
    setTopBottomMargins,
} from "./screen";
export {
    SCROLL_DOWN_1,
    SCROLL_UP_1,
    scrollDown,
    scrollUp,
} from "./scroll";
export type {
    RawImageData,
    SixelColor,
    SixelDecoderOptions,
    SixelEncoderOptions,
    SixelPalette,
} from "./sixel";
export {
    SixelDecoder,
    SixelEncoder,
    sixelGraphics,
} from "./sixel";
export type { AnsiStatusReport, DecStatusReport, StatusReport /* , TerminalAttributes, TerminalFeatures, TerminalParameters */ } from "./status";
export {
    CPR,
    createAnsiStatusReport,
    createDecStatusReport,
    cursorPositionReport,
    DA1,
    DA2,
    DA3,
    DECXCPR,
    deviceStatusReport,
    DSR,
    extendedCursorPositionReport,
    reportDeviceAttributes,
    reportExtendedDeviceAttributes,
    reportKeyboardLanguage,
    reportKeyboardLanguageDEC,
    reportPrimaryDeviceAttributes,
    reportPrinterStatus,
    reportSecondaryDeviceAttributes,
    reportTerminalIdentity,
    reportTerminalParameters,
    reportTerminalStatus,
    reportTertiaryDeviceAttributes,
    reportUDKStatus,
    requestCursorPositionReport,
    requestDeviceAttributes,
    requestExtendedCursorPositionReport,
    requestExtendedDeviceAttributes,
    requestPrimaryDeviceAttributes,
    requestPrinterStatus,
    requestSecondaryDeviceAttributes,
    requestTerminalIdentity,
    requestTerminalParameters,
    requestTerminalStatus,
    requestTertiaryDeviceAttributes,
    requestUDKStatus,
    sendDeviceAttributes,
    // RequestCursorPosition, // This is an alias for requestCursorPositionReport constant in status.ts
    // RequestPrinterStatus, // This would be a specific constant if defined
    // RequestTerminalStatus, // This would be a specific constant if defined
    // RequestUDKStatus, // This would be a specific constant if defined
} from "./status";
export { default as strip } from "./strip";
export {
    requestTermcap,
    requestTerminfo,
    XTGETTCAP,
} from "./termcap";
export {
    decsin,
    decswt,
    setIconName,
    setIconNameAndWindowTitle,
    setIconNameAndWindowTitleWithST,
    setIconNameWithST,
    setWindowTitle,
    setWindowTitleWithST,
} from "./title";
export type { XTermWindowOp } from "./window-ops";
export {
    deiconifyWindow,
    iconifyWindow,
    lowerWindow,
    maximizeWindow,
    moveWindow,
    raiseWindow,
    refreshWindow,
    reportWindowPosition,
    reportWindowState,
    requestCellSizePixels,
    requestTextAreaSizeChars,
    requestTextAreaSizePixels,
    resizeTextAreaChars,
    resizeTextAreaPixels,
    restoreMaximizedWindow,
    setPageSizeLines,
    xtermWindowOp,
    XTWINOPS,
} from "./window-ops";
export {
    keyModifierOptions,
    queryKeyModifierOptions,
    queryModifyOtherKeys,
    resetKeyModifierOptions,
    resetModifyOtherKeys,
    setKeyModifierOptions,
    setModifyOtherKeys1,
    setModifyOtherKeys2,
    XTMODKEYS,
    XTQMODKEYS,
} from "./xterm";

// Notes:
// - Exports from constants.ts and helpers.ts are not included as they are likely internal.
// - Some specific mode constants from user edits (e.g., BracketedPasteMode) were not directly visible in
//   the provided snippets of mode.ts. If they are indeed exported from mode.ts, they should be added
//   to the mode.ts export block above.
// - Some assumed types from user edits (e.g., TerminalAttributes) are commented out in the status.ts
//   type exports as they were not directly visible in the snippets.
// - Ensured `export type` is used for type-only exports where identified.
