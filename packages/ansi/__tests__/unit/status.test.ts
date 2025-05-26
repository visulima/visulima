import { describe, expect, it } from "vitest";

import { CSI, SEP } from "../../src/constants";
import type { AnsiStatusReport, DecStatusReport } from "../../src/status";
import {
    CPR,
    createAnsiStatusReport,
    createDecStatusReport,
    cursorPositionReport,
    DECXCPR,
    deviceStatusReport,
    DSR,
    DSR_KeyboardLanguageDEC,
    DSR_PrinterStatusDEC,
    DSR_TerminalStatus,
    DSR_UDKStatusDEC,
    extendedCursorPositionReport,
    reportKeyboardLanguageDEC,
    reportPrinterNoPaperDEC,
    reportPrinterNotReadyDEC,
    reportPrinterReadyDEC,
    reportTerminalNotOK,
    reportTerminalOK,
    reportUDKLockedDEC,
    reportUDKUnlockedDEC,
    requestCursorPositionReport,
    requestExtendedCursorPositionReport,
    requestKeyboardLanguageDEC,
    requestPrinterStatusDEC,
    requestTerminalStatus,
    requestUDKStatusDEC,
    StatusReport,
} from "../../src/status";

describe("status Reports", () => {
    describe("statusReport Creation", () => {
        it("should create ANSI StatusReport", () => {
            expect.assertions(2);

            const report: AnsiStatusReport = createAnsiStatusReport(5);

            expect(report.reportCode).toBe(5);
            expect(report.isDecReport).toBe(false);
        });

        it("should create DEC StatusReport", () => {
            expect.assertions(2);

            const report: DecStatusReport = createDecStatusReport(15);

            expect(report.reportCode).toBe(15);
            expect(report.isDecReport).toBe(true);
        });
    });

    describe("deviceStatusReport (DSR general function)", () => {
        const ansiReport5 = createAnsiStatusReport(5);
        const ansiReport6 = createAnsiStatusReport(6);
        const decReport15 = createDecStatusReport(15);
        const decReport25 = createDecStatusReport(25);

        it("should generate DSR for a single ANSI report", () => {
            expect.assertions(1);
            expect(deviceStatusReport(ansiReport5)).toBe(`${CSI}5n`);
        });

        it("should generate DSR for a single DEC report", () => {
            expect.assertions(1);
            expect(deviceStatusReport(decReport15)).toBe(`${CSI}?15n`);
        });

        it("should generate DSR for multiple ANSI reports", () => {
            expect.assertions(1);
            expect(deviceStatusReport(ansiReport5, ansiReport6)).toBe(`${CSI}5${SEP}6n`);
        });

        it("should generate DSR for multiple DEC reports", () => {
            expect.assertions(1);
            expect(deviceStatusReport(decReport15, decReport25)).toBe(`${CSI}?15${SEP}25n`);
        });

        it("should prefix with ? if any report is DEC (mixed reports)", () => {
            expect.assertions(2);
            // Standard doesn't typically mix like CSI 5;?6n. It's usually CSI ?5;6n if any are DEC.
            // This test reflects the implemented logic which prefixes if *any* are DEC.
            expect(deviceStatusReport(ansiReport5, decReport15)).toBe(`${CSI}?5${SEP}15n`);
            expect(deviceStatusReport(decReport15, ansiReport5)).toBe(`${CSI}?15${SEP}5n`);
        });

        it("should return empty string if no reports are provided", () => {
            expect.assertions(1);
            expect(deviceStatusReport()).toBe("");
        });

        it("dSR alias should work for a single report", () => {
            expect.assertions(2);
            expect(DSR(ansiReport5)).toBe(`${CSI}5n`);
            expect(DSR(decReport15)).toBe(`${CSI}?15n`);
        });
    });

    describe("cursor Position Reports", () => {
        it("requestCursorPositionReport should be correct", () => {
            expect.assertions(1);
            expect(requestCursorPositionReport).toBe(`${CSI}6n`);
        });

        it("requestExtendedCursorPositionReport should be correct", () => {
            expect.assertions(1);
            expect(requestExtendedCursorPositionReport).toBe(`${CSI}?6n`);
        });

        it("cursorPositionReport (CPR) should format correctly", () => {
            expect.assertions(2);
            expect(cursorPositionReport(10, 20)).toBe(`${CSI}10${SEP}20R`);
            expect(CPR(5, 1)).toBe(`${CSI}5${SEP}1R`);
        });

        it("cursorPositionReport should handle 0 or negative inputs by defaulting to 1", () => {
            expect.assertions(3);
            expect(cursorPositionReport(0, 0)).toBe(`${CSI}1${SEP}1R`);
            expect(cursorPositionReport(-5, 10)).toBe(`${CSI}1${SEP}10R`);
            expect(cursorPositionReport(10, -5)).toBe(`${CSI}10${SEP}1R`);
        });

        it("extendedCursorPositionReport (DECXCPR) should format correctly with page", () => {
            expect.assertions(2);
            expect(extendedCursorPositionReport(10, 20, 3)).toBe(`${CSI}?10${SEP}20${SEP}3R`);
            expect(DECXCPR(5, 1, 1)).toBe(`${CSI}?5${SEP}1${SEP}1R`);
        });

        it("extendedCursorPositionReport should omit page if page <= 0", () => {
            expect.assertions(2);
            expect(extendedCursorPositionReport(10, 20, 0)).toBe(`${CSI}?10${SEP}20R`);
            expect(extendedCursorPositionReport(10, 20, -1)).toBe(`${CSI}?10${SEP}20R`);
        });

        it("extendedCursorPositionReport should handle 0 or negative line/column by defaulting to 1", () => {
            expect.assertions(3);
            expect(extendedCursorPositionReport(0, 0, 1)).toBe(`${CSI}?1${SEP}1${SEP}1R`);
            expect(extendedCursorPositionReport(-5, 10, 2)).toBe(`${CSI}?1${SEP}10${SEP}2R`);
            expect(extendedCursorPositionReport(10, -5, 0)).toBe(`${CSI}?10${SEP}1R`);
        });
    });

    describe("specific DSR Constants and Helper Reports", () => {
        it("requestTerminalStatus and DSR_TerminalStatus", () => {
            expect.assertions(3);
            expect(requestTerminalStatus.reportCode).toBe(5);
            expect(requestTerminalStatus.isDecReport).toBe(false);
            expect(DSR_TerminalStatus).toBe(`${CSI}5n`);
        });

        it("reportTerminalOK and reportTerminalNotOK", () => {
            expect.assertions(2);
            expect(reportTerminalOK).toBe(`${CSI}0n`);
            expect(reportTerminalNotOK).toBe(`${CSI}3n`);
        });

        it("requestPrinterStatusDEC and DSR_PrinterStatusDEC", () => {
            expect.assertions(3);
            expect(requestPrinterStatusDEC.reportCode).toBe(15);
            expect(requestPrinterStatusDEC.isDecReport).toBe(true);
            expect(DSR_PrinterStatusDEC).toBe(`${CSI}?15n`);
        });

        it("printer status DEC reports", () => {
            expect.assertions(3);
            expect(reportPrinterReadyDEC).toBe(`${CSI}?10n`);
            expect(reportPrinterNotReadyDEC).toBe(`${CSI}?11n`);
            expect(reportPrinterNoPaperDEC).toBe(`${CSI}?13n`);
        });

        it("requestUDKStatusDEC and DSR_UDKStatusDEC", () => {
            expect.assertions(3);
            expect(requestUDKStatusDEC.reportCode).toBe(25);
            expect(requestUDKStatusDEC.isDecReport).toBe(true);
            expect(DSR_UDKStatusDEC).toBe(`${CSI}?25n`);
        });

        it("uDK status DEC reports", () => {
            expect.assertions(2);
            expect(reportUDKLockedDEC).toBe(`${CSI}?20n`);
            expect(reportUDKUnlockedDEC).toBe(`${CSI}?21n`);
        });

        it("requestKeyboardLanguageDEC and DSR_KeyboardLanguageDEC", () => {
            expect.assertions(3);
            expect(requestKeyboardLanguageDEC.reportCode).toBe(26);
            expect(requestKeyboardLanguageDEC.isDecReport).toBe(true);
            expect(DSR_KeyboardLanguageDEC).toBe(`${CSI}?26n`);
        });

        it("reportKeyboardLanguageDEC function", () => {
            expect.assertions(2);
            expect(reportKeyboardLanguageDEC(1)).toBe(`${CSI}?27${SEP}1n`); // US English example
            expect(reportKeyboardLanguageDEC(7)).toBe(`${CSI}?27${SEP}7n`); // German example
        });
    });
});
