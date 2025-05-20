import { describe, expect, it } from "vitest";

import { CSI } from "../../src/constants";
import {
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
    XTermWindowOp,
    xtermWindowOp,
    XTWINOPS,
} from "../../src/window-ops";

describe("xtermWindowOp", () => {
    it("should generate a basic window operation sequence", () => {
        expect(xtermWindowOp(1)).toBe(`${CSI}1t`);
    });

    it("should generate a window operation sequence with multiple parameters", () => {
        expect(xtermWindowOp(3, 100, 200)).toBe(`${CSI}3;100;200t`);
    });

    it("should ignore negative parameters, except for the primary one if it's a special float", () => {
        expect(xtermWindowOp(3, -5, 100, -2)).toBe(`${CSI}3;100t`);
    });

    it("should return an empty string for invalid primary parameter (zero)", () => {
        expect(xtermWindowOp(0)).toBe("");
    });

    it("should return an empty string for invalid primary parameter (negative integer)", () => {
        expect(xtermWindowOp(-1)).toBe("");
    });

    it("should allow specific float primary parameters", () => {
        expect(xtermWindowOp(XTermWindowOp.MAXIMIZE_WINDOW_VERTICALLY)).toBe(`${CSI}10.1t`);
        expect(xtermWindowOp(XTermWindowOp.MAXIMIZE_WINDOW_HORIZONTALLY)).toBe(`${CSI}10.2t`);
        expect(xtermWindowOp(XTermWindowOp.UNDO_FULL_SCREEN_MODE)).toBe(`${CSI}10.3t`);
    });

    it("should handle a single parameter correctly", () => {
        expect(xtermWindowOp(XTermWindowOp.DEICONIFY_WINDOW)).toBe(`${CSI}1t`);
    });

    it("should handle multiple parameters correctly", () => {
        expect(xtermWindowOp(XTermWindowOp.MOVE_WINDOW, 10, 20)).toBe(`${CSI}3;10;20t`);
    });
});

describe("xTWINOPS alias", () => {
    it("should be an alias for xtermWindowOp", () => {
        expect(XTWINOPS(1)).toBe(`${CSI}1t`);
        expect(XTWINOPS(3, 100, 200)).toBe(`${CSI}3;100;200t`);
    });
});

describe("window Operation Helpers", () => {
    it("deiconifyWindow should generate correct sequence", () => {
        expect(deiconifyWindow()).toBe(`${CSI}1t`);
    });

    it("iconifyWindow should generate correct sequence", () => {
        expect(iconifyWindow()).toBe(`${CSI}2t`);
    });

    it("moveWindow should generate correct sequence", () => {
        expect(moveWindow(50, 150)).toBe(`${CSI}3;50;150t`);
    });

    it("resizeTextAreaChars should use XTermWindowOp.RESIZE_TEXT_AREA_CHARS", () => {
        expect(resizeTextAreaChars(24, 80)).toBe(`${CSI}4;24;80t`);
    });

    it("requestTextAreaSizeChars should use XTermWindowOp.REQUEST_WINDOW_SIZE_WIN_OP_COMPAT", () => {
        expect(requestTextAreaSizeChars()).toBe(`${CSI}14t`);
    });

    it("requestCellSizePixels should use XTermWindowOp.REPORT_CELL_SIZE_PIXELS", () => {
        expect(requestCellSizePixels()).toBe(`${CSI}16t`);
    });

    it("raiseWindow should generate correct sequence", () => {
        expect(raiseWindow()).toBe(`${CSI}5t`);
    });

    it("lowerWindow should generate correct sequence", () => {
        expect(lowerWindow()).toBe(`${CSI}6t`);
    });

    it("refreshWindow should generate correct sequence", () => {
        expect(refreshWindow()).toBe(`${CSI}7t`);
    });

    it("resizeTextAreaPixels should generate correct sequence for XTermWindowOp.RESIZE_TEXT_AREA_PIXELS", () => {
        expect(resizeTextAreaPixels(600, 800)).toBe(`${CSI}8;600;800t`);
    });

    it("restoreMaximizedWindow should generate correct sequence for XTermWindowOp.RESTORE_MAXIMIZED_WINDOW", () => {
        expect(restoreMaximizedWindow()).toBe(`${CSI}9t`);
    });

    it("maximizeWindow should generate correct sequence for XTermWindowOp.MAXIMIZE_WINDOW", () => {
        expect(maximizeWindow()).toBe(`${CSI}10t`);
    });

    it("reportWindowState should generate correct sequence for XTermWindowOp.REPORT_WINDOW_STATE", () => {
        expect(reportWindowState()).toBe(`${CSI}11t`);
    });

    it("reportWindowPosition should generate correct sequence for XTermWindowOp.REPORT_WINDOW_POSITION", () => {
        expect(reportWindowPosition()).toBe(`${CSI}13t`);
    });

    it("requestTextAreaSizePixels should generate correct sequence for XTermWindowOp.REPORT_TEXT_AREA_SIZE_PIXELS", () => {
        expect(requestTextAreaSizePixels()).toBe(`${CSI}18t`);
    });

    it("setPageSizeLines should generate correct sequence for XTermWindowOp.RESIZE_SCREEN_AND_TEXT_AREA", () => {
        expect(setPageSizeLines(50)).toBe(`${CSI}24;50t`);
    });

    it("xTermWindowOp.MAXIMIZE_WINDOW_VERTICALLY should be 10.1", () => {
        expect(XTermWindowOp.MAXIMIZE_WINDOW_VERTICALLY).toBe(10.1);
    });

    it("xTermWindowOp.MAXIMIZE_WINDOW_HORIZONTALLY should be 10.2", () => {
        expect(XTermWindowOp.MAXIMIZE_WINDOW_HORIZONTALLY).toBe(10.2);
    });

    it("xTermWindowOp.UNDO_FULL_SCREEN_MODE should be 10.3", () => {
        expect(XTermWindowOp.UNDO_FULL_SCREEN_MODE).toBe(10.3);
    });

    it("xTermWindowOp.REPORT_TEXT_AREA_SIZE_CHARS should be 14", () => {
        expect(XTermWindowOp.REPORT_TEXT_AREA_SIZE_CHARS).toBe(14);
    });

    it("xTermWindowOp.REPORT_ICON_LABEL should be 19", () => {
        expect(XTermWindowOp.REPORT_ICON_LABEL).toBe(19);
    });

    it("xTermWindowOp.REPORT_WINDOW_TITLE should be 21", () => {
        expect(XTermWindowOp.REPORT_WINDOW_TITLE).toBe(21);
    });

    it("xTermWindowOp.PUSH_WINDOW_TITLE should be 22", () => {
        expect(XTermWindowOp.PUSH_WINDOW_TITLE).toBe(22);
    });

    it("xTermWindowOp.POP_WINDOW_TITLE should be 23", () => {
        expect(XTermWindowOp.POP_WINDOW_TITLE).toBe(23);
    });
});
