/* eslint-disable no-secrets/no-secrets */
/* eslint-disable max-classes-per-file */
import { CSI, DCS, SEP, ST } from "./constants";

class AnsiStatusReportImpl implements StatusReport {
    public readonly isDecReport = false;

    public constructor(public readonly reportCode: number) {}
}
class DecStatusReportImpl implements StatusReport {
    public readonly isDecReport = true;

    public constructor(public readonly reportCode: number) {}
}

/** Represents an ANSI terminal status report type. */
export type AnsiStatusReport = StatusReport;

/** Represents a DEC terminal status report type. */
export type DecStatusReport = StatusReport;

/**
 * Interface for terminal status reports.
 */
export interface StatusReport {
    readonly isDecReport: boolean;
    readonly reportCode: number;
}

/**
 * Creates an ANSI-type status report object.
 * These reports are typically requested using `CSI Ps n`.
 * @param code The numeric code for the ANSI status report.
 * @returns An object implementing the {@link StatusReport} interface, marked as not DEC-specific.
 * @example
 * ```typescript
 * import { createAnsiStatusReport, deviceStatusReport } from "@visulima/ansi";
 *
 * const report = createAnsiStatusReport(5);
 * const sequence = deviceStatusReport(report);
 * console.log(sequence);
 * ```
 */
export const createAnsiStatusReport = (code: number): AnsiStatusReport => new AnsiStatusReportImpl(code);

/**
 * Creates a DEC private status report object.
 * These reports are typically requested using `CSI ? Ps n`.
 * @param code The numeric code for the DEC private status report.
 * @returns An object implementing the {@link StatusReport} interface, marked as DEC-specific.
 * @example
 * ```typescript
 * import { createDecStatusReport, deviceStatusReport } from "@visulima/ansi";
 *
 * const report = createDecStatusReport(15);
 * const sequence = deviceStatusReport(report);
 * console.log(sequence);
 * ```
 */
export const createDecStatusReport = (code: number): DecStatusReport => new DecStatusReportImpl(code);

/**
 * Generates a Device Status Report (DSR) sequence to request terminal status information.
 *
 * Standard DSR: `CSI Ps n` (where `Ps` are numeric parameters separated by semicolons).
 * DEC-specific DSR: `CSI ? Ps n` (where `Ps` are numeric parameters separated by semicolons).
 *
 * If any of the provided {@link StatusReport} objects are DEC-specific (i.e., `isDecReport` is true),
 * the entire sequence will be prefixed with `?`, indicating a DEC private DSR query.
 * Mixing standard and DEC-specific report types in a single request is handled by this logic,
 * but typically, a DSR query is either entirely standard or entirely DEC-specific.
 * @param reports One or more {@link StatusReport} objects indicating the statuses to request.
 * If no reports are provided, an empty string is returned.
 * @returns The DSR sequence string (e.g., `"\x1b[5n"`, `"\x1b[?1;2n"`).
 * @see https://vt100.net/docs/vt510-rm/DSR.html
 * @example
 * ```typescript
 * import { deviceStatusReport, createAnsiStatusReport, createDecStatusReport } from "@visulima/ansi";
 *
 * const ansiReport = createAnsiStatusReport(5);
 * const decReport = createDecStatusReport(25);
 *
 * console.log(deviceStatusReport(ansiReport));
 * console.log(deviceStatusReport(decReport));
 * console.log(deviceStatusReport(ansiReport, decReport));
 * ```
 */
export const deviceStatusReport = (...reports: StatusReport[]): string => {
    if (reports.length === 0) {
        return "";
    }

    let hasDecReport = false;

    const reportCodes = reports.map((report) => {
        if (report.isDecReport) {
            hasDecReport = true;
        }

        return report.reportCode.toString();
    });

    let seq = CSI;

    if (hasDecReport) {
        seq += "?";
    }

    return `${seq + reportCodes.join(SEP)}n`;
};

/**
 * DSR (Device Status Report) alias.
 * This function serves as a shorthand for {@link deviceStatusReport} when requesting a single status.
 * @param report A single {@link StatusReport} object.
 * @returns The DSR sequence string.
 * @see deviceStatusReport
 * @example
 * ```typescript
 * import { DSR, requestTerminalStatus } from "@visulima/ansi";
 *
 * console.log(DSR(requestTerminalStatus));
 * ```
 */
export const DSR = (report: StatusReport): string => deviceStatusReport(report);

/**
 * ANSI escape sequence to request the cursor's current position (row and column).
 * This is a common Device Status Report (DSR) request.
 * Sequence: `CSI 6 n`
 * The terminal typically responds with a Cursor Position Report (CPR) like `CSI Pl ; Pc R`.
 * @see cursorPositionReport
 * @see https://vt100.net/docs/vt510-rm/CPR.html
 * @example
 * ```typescript
 * import { requestCursorPositionReport } from "@visulima/ansi";
 *
 * process.stdout.write(requestCursorPositionReport);
 * ```
 */
export const requestCursorPositionReport: string = `${CSI}6n`;

/**
 * ANSI escape sequence to request the cursor's current position including page number (DEC private).
 * This is a DEC-specific Device Status Report (DSR) request, often called DECXCPR.
 * Sequence: `CSI ? 6 n`
 * The terminal typically responds with an Extended Cursor Position Report (DECXCPR) like `CSI ? Pl ; Pc ; Pp R`.
 * @see extendedCursorPositionReport
 * @see https://vt100.net/docs/vt510-rm/DECXCPR.html
 * @example
 * ```typescript
 * import { requestExtendedCursorPositionReport } from "@visulima/ansi";
 *
 * process.stdout.write(requestExtendedCursorPositionReport);
 * ```
 */
export const requestExtendedCursorPositionReport: string = `${CSI}?6n`;

/**
 * Generates the Cursor Position Report (CPR) response sequence.
 * This sequence is typically sent by the terminal in response to a DSR CPR request (`CSI 6 n`).
 *
 * Sequence: `CSI Pl ; Pc R`
 * - `Pl`: Line number (1-based).
 * - `Pc`: Column number (1-based).
 * @param line The line number (1-based). Values less than 1 are treated as 1.
 * @param column The column number (1-based). Values less than 1 are treated as 1.
 * @returns The CPR sequence string.
 * @example
 * ```typescript
 * import { cursorPositionReport } from "@visulima/ansi";
 *
 * console.log(cursorPositionReport(10, 5));
 * ```
 */
export const cursorPositionReport = (line: number, column: number): string => {
    const r = Math.max(1, line);
    const c = Math.max(1, column);

    return `${CSI + r.toString() + SEP + c.toString()}R`;
};

/**
 * Alias for {@link cursorPositionReport}.
 * Provides a shorter name for the CPR response sequence generator.
 * @see cursorPositionReport
 * @example
 * ```typescript
 * import { CPR } from "@visulima/ansi";
 *
 * console.log(CPR(10, 5));
 * ```
 */
export const CPR: (line: number, column: number) => string = cursorPositionReport;

/**
 * Extended Cursor Position Report (DECXCPR) response format.
 * @param line The line number (1-based).
 * @param column The column number (1-based).
 * @param page The page number (1-based). If 0 or less, it's omitted.
 * @returns The DECXCPR sequence string.
 * @example
 * ```typescript
 * import { extendedCursorPositionReport } from "@visulima/ansi";
 *
 * console.log(extendedCursorPositionReport(10, 5, 1));
 *
 * console.log(extendedCursorPositionReport(10, 5, 0));
 * ```
 */
export const extendedCursorPositionReport = (line: number, column: number, page: number): string => {
    const r = Math.max(1, line);
    const c = Math.max(1, column);
    let seq = `${CSI}?`;

    seq += r.toString() + SEP + c.toString();

    if (page > 0) {
        seq += SEP + page.toString();
    }

    seq += "R";

    return seq;
};

/**
 * Alias for {@link extendedCursorPositionReport}.
 * Provides a shorter name for the DECXCPR response sequence generator.
 * @see extendedCursorPositionReport
 * @example
 * ```typescript
 * import { DECXCPR } from "@visulima/ansi";
 *
 * console.log(DECXCPR(10, 5, 1));
 * ```
 */
export const DECXCPR: (line: number, column: number, page: number) => string = extendedCursorPositionReport;

/**
 * ANSI escape sequence to request the terminal's name and version (XTVERSION).
 * Sequence: `CSI > 0 q`
 * The terminal typically responds with a DCS sequence: `DCS > | text ST`
 * Where `text` is the terminal name and version.
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-PC-Style-Function-Keys
 * @example
 * ```typescript
 * import { RequestNameVersion } from "@visulima/ansi";
 *
 * process.stdout.write(RequestNameVersion);
 * ```
 */
export const RequestNameVersion: string = `${CSI}>0q`;

/**
 * Alias for {@link RequestNameVersion}.
 * @see RequestNameVersion
 */
export const XTVERSION: string = RequestNameVersion;

// Primary Device Attributes (DA1)
// https://vt100.net/docs/vt510-rm/DA1.html

/**
 * ANSI escape sequence to request Primary Device Attributes (DA1).
 * Sequence: `CSI c` or `CSI 0 c`. Using `CSI c` as it's the more common base form.
 * The terminal responds with `CSI ? Pn ; Pn ; ... c`.
 * @example
 * ```typescript
 * import { requestPrimaryDeviceAttributes } from "@visulima/ansi";
 *
 * process.stdout.write(requestPrimaryDeviceAttributes);
 * ```
 */
export const requestPrimaryDeviceAttributes: string = `${CSI}c`;

/**
 * Alias for {@link requestPrimaryDeviceAttributes}.
 */
export const DA1: string = requestPrimaryDeviceAttributes;

/**
 * Generates the response sequence for Primary Device Attributes (DA1).
 * Sequence: `CSI ? Ps ; ... c`
 *
 * Common attributes include:
 * - 1  132 columns
 * - 2  Printer port
 * - 4  Sixel
 * - 6  Selective erase
 * - 7  Soft character set (DRCS)
 * - 8  User-defined keys (UDKs)
 * - 9  National replacement character sets (NRCS) (International terminal only)
 * - 12 Yugoslavian (SCS)
 * - 15 Technical character set
 * - 18 Windowing capability
 * - 21 Horizontal scrolling
 * - 23 Greek
 * - 24 Turkish
 * - 42 ISO Latin-2 character set
 * - 44 PCTerm
 * - 45 Soft key map
 * - 46 ASCII emulation
 * @param attributes Numeric attribute codes.
 * @returns The DA1 response sequence.
 * @example
 * ```typescript
 * import { reportPrimaryDeviceAttributes } from "@visulima/ansi";
 *
 * console.log(reportPrimaryDeviceAttributes(1, 9));
 * console.log(reportPrimaryDeviceAttributes(61));
 * ```
 */
export const reportPrimaryDeviceAttributes = (...attributes: number[]): string => {
    if (attributes.length === 0) {
        return "";
    }

    return `${CSI}?${attributes.join(SEP)}c`;
};

// Secondary Device Attributes (DA2)
// https://vt100.net/docs/vt510-rm/DA2.html

/**
 * ANSI escape sequence to request Secondary Device Attributes (DA2).
 * Sequence: `CSI > c` or `CSI > 0 c`. Using `CSI > c` as the base.
 * The terminal responds with `CSI > Pv ; Pl ; Pc c` (Version; Level; Cartridge).
 * @example
 * ```typescript
 * import { requestSecondaryDeviceAttributes } from "@visulima/ansi";
 *
 * process.stdout.write(requestSecondaryDeviceAttributes);
 * ```
 */
export const requestSecondaryDeviceAttributes: string = `${CSI}>c`;

/**
 * Alias for {@link requestSecondaryDeviceAttributes}.
 */
export const DA2: string = requestSecondaryDeviceAttributes;

/**
 * Generates the response sequence for Secondary Device Attributes (DA2).
 * Sequence: `CSI > Pv ; Pl ; Pc c`
 * @param version Terminal version number.
 * @param level Terminal model/level number.
 * @param cartridge ROM cartridge (0 for none).
 * @returns The DA2 response sequence.
 * @example
 * ```typescript
 * import { reportSecondaryDeviceAttributes } from "@visulima/ansi";
 *
 * console.log(reportSecondaryDeviceAttributes(0, 2, 0));
 * console.log(reportSecondaryDeviceAttributes(41, 370, 0));
 * ```
 */
export const reportSecondaryDeviceAttributes = (version: number, level: number, cartridge = 0): string => {
    const pv = Math.max(0, version);
    const pl = Math.max(0, level);
    const pc = Math.max(0, cartridge);

    return `${CSI}>${pv}${SEP}${pl}${SEP}${pc}c`;
};

// Tertiary Device Attributes (DA3)
// https://vt100.net/docs/vt510-rm/DA3.html

/**
 * ANSI escape sequence to request Tertiary Device Attributes (DA3).
 * Sequence: `CSI = c` or `CSI = 0 c`. Using `CSI = c` as the base.
 * The terminal responds with `DCS ! | unitID ST`. (DECRPTUI - Report Unit ID)
 * @example
 * ```typescript
 * import { requestTertiaryDeviceAttributes } from "@visulima/ansi";
 *
 * process.stdout.write(requestTertiaryDeviceAttributes);
 * ```
 */
export const requestTertiaryDeviceAttributes: string = `${CSI}=c`;

/**
 * Alias for {@link requestTertiaryDeviceAttributes}.
 */
export const DA3: string = requestTertiaryDeviceAttributes;

/**
 * Generates the response sequence for Tertiary Device Attributes (DA3), which is a DECRPTUI.
 * Sequence: `DCS ! | unitID ST`
 * @param unitID The unit ID string for the terminal.
 * @returns The DA3 response sequence (DECRPTUI).
 * If unitID is empty, it's arguably an invalid report, but we'll return `DCS ! | ST` to match some behaviors.
 * @example
 * ```typescript
 * import { reportTertiaryDeviceAttributes } from "@visulima/ansi";
 *
 * console.log(reportTertiaryDeviceAttributes("MYTERM001"));
 * console.log(reportTertiaryDeviceAttributes(""));
 * ```
 */
export const reportTertiaryDeviceAttributes = (unitID: string): string =>
    `${DCS}!|${unitID}${ST}`;

// For user convenience, re-exporting some constants if they are direct requests
// This part is more about aligning with other direct constants if they differ from the `request*` functions.
// However, our `request*` functions are already constants.

// For requests like `CSI > 0 q` (RequestNameVersion / XTVERSION)
// it's a direct constant, already defined above.

// For `CSI c` (RequestPrimaryDeviceAttributes)
// `requestPrimaryDeviceAttributes` is already `CSIc`.

// For `CSI > c` (RequestSecondaryDeviceAttributes)
// `requestSecondaryDeviceAttributes` is already `CSI>c`.

// For `CSI = c` (RequestTertiaryDeviceAttributes)
// `requestTertiaryDeviceAttributes` is already `CSI=c`.

// Some terminals also have functions like PrimaryDeviceAttributes(attrs ...int) string
// which can *generate* a request with parameters (e.g., CSI 0 c or CSI ? Ps ; ... c).
// Our current `requestPrimaryDeviceAttributes` is just `CSI c`.
// To fully match, we might need functions that can take a `0` or other params if the request form varies.

// Let's ensure the `sendDeviceAttributes` `CSI ? Ps ; ... c` is covered by `reportPrimaryDeviceAttributes`. It is.
// The request `CSI c` or `CSI 0 c`.
// We have `requestPrimaryDeviceAttributes = CSI c`.
// To add `CSI 0 c`, we can make a new constant or a function.
// Let's add specific request constants if they are different forms.

/**
 * ANSI escape sequence to request Primary Device Attributes (DA1) with explicit parameter 0.
 * Sequence: `CSI 0 c`.
 * This is an alternative form of {@link requestPrimaryDeviceAttributes}.
 * @example
 * ```typescript
 * import { requestPrimaryDeviceAttributesParam0 } from "@visulima/ansi";
 *
 * process.stdout.write(requestPrimaryDeviceAttributesParam0);
 * ```
 */
export const requestPrimaryDeviceAttributesParam0: string = `${CSI}0c`;

/**
 * ANSI escape sequence to request Secondary Device Attributes (DA2) with explicit parameter 0.
 * Sequence: `CSI > 0 c`.
 * This is an alternative form of {@link requestSecondaryDeviceAttributes}.
 * Note: This is also what XTerm uses for `sendDeviceAttributes` with no arguments in some contexts,
 * but it's different from `XTVERSION` (`CSI > 0 q`).
 * @example
 * ```typescript
 * import { requestSecondaryDeviceAttributesParam0 } from "@visulima/ansi";
 *
 * process.stdout.write(requestSecondaryDeviceAttributesParam0);
 * ```
 */
export const requestSecondaryDeviceAttributesParam0: string = `${CSI}>0c`;

/**
 * ANSI escape sequence to request Tertiary Device Attributes (DA3) with explicit parameter 0.
 * Sequence: `CSI = 0 c`.
 * This is an alternative form of {@link requestTertiaryDeviceAttributes}.
 * @example
 * ```typescript
 * import { requestTertiaryDeviceAttributesParam0 } from "@visulima/ansi";
 *
 * process.stdout.write(requestTertiaryDeviceAttributesParam0);
 * ```
 */
export const requestTertiaryDeviceAttributesParam0: string = `${CSI}=0c`;

// Restore the original content for DSRs that were deleted
// Other common DSR codes (often as requests)
// These are typically single parameter DSRs

/**
 * A {@link StatusReport} object to request the terminal's general status.
 * Corresponds to DSR request `CSI 5 n`.
 * The terminal is expected to respond with `CSI 0 n` (OK) or `CSI 3 n` (Failure).
 * @see DSR_TerminalStatus
 * @see reportTerminalOK
 * @see reportTerminalNotOK
 * @example
 * ```typescript
 * import { DSR, requestTerminalStatus } from "@visulima/ansi";
 *
 * const reportSequence = DSR(requestTerminalStatus);
 * console.log(reportSequence);
 * ```
 */
export const requestTerminalStatus: StatusReport = createAnsiStatusReport(5);

/**
 * ANSI escape sequence `CSI 5 n` to request terminal status.
 * This is generated using `deviceStatusReport(requestTerminalStatus)`.
 * @see requestTerminalStatus
 * @example
 * ```typescript
 * import { DSR_TerminalStatus } from "@visulima/ansi";
 *
 * process.stdout.write(DSR_TerminalStatus);
 * ```
 */
export const DSR_TerminalStatus: string = deviceStatusReport(requestTerminalStatus); // CSI 5 n

/**
 * ANSI escape sequence `CSI 0 n` indicating Terminal is OK (Operating Normally).
 * This is a typical response to {@link DSR_TerminalStatus} (`CSI 5 n`) or `deviceStatusReport(requestTerminalStatus)`.
 * @see requestTerminalStatus
 * @see DSR_TerminalStatus
 */
export const reportTerminalOK: string = `${CSI}0n`;

/**
 * ANSI escape sequence `CSI 3 n` indicating Terminal is NOT OK (Malfunction).
 * This is a typical response to {@link DSR_TerminalStatus} (`CSI 5 n`) or `deviceStatusReport(requestTerminalStatus)`.
 * @see requestTerminalStatus
 * @see DSR_TerminalStatus
 */
export const reportTerminalNotOK: string = `${CSI}3n`;

/**
 * A DEC-specific {@link StatusReport} object to request printer status.
 * Corresponds to DSR request `CSI ? 15 n`.
 * The terminal is expected to respond with sequences like `CSI ? 10 n` (Ready), `CSI ? 11 n` (Not Ready), or `CSI ? 13 n` (No Paper).
 * @see DSR_PrinterStatusDEC
 * @see reportPrinterReadyDEC
 * @see reportPrinterNotReadyDEC
 * @see reportPrinterNoPaperDEC
 * @example
 * ```typescript
 * import { DSR, requestPrinterStatusDEC } from "@visulima/ansi";
 *
 * const reportSequence = DSR(requestPrinterStatusDEC);
 * console.log(reportSequence);
 * ```
 */
export const requestPrinterStatusDEC: StatusReport = createDecStatusReport(15);

/**
 * ANSI escape sequence `CSI ? 15 n` to request DEC-specific printer status.
 * This is generated using `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @example
 * ```typescript
 * import { DSR_PrinterStatusDEC } from "@visulima/ansi";
 *
 * process.stdout.write(DSR_PrinterStatusDEC);
 * ```
 */
export const DSR_PrinterStatusDEC: string = deviceStatusReport(requestPrinterStatusDEC); // CSI ? 15 n

/**
 * ANSI escape sequence `CSI ? 10 n` indicating Printer is Ready (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterReadyDEC: string = `${CSI}?10n`;

/**
 * ANSI escape sequence `CSI ? 11 n` indicating Printer is Not Ready (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterNotReadyDEC: string = `${CSI}?11n`;

/**
 * ANSI escape sequence `CSI ? 13 n` indicating Printer has No Paper (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterNoPaperDEC: string = `${CSI}?13n`;

/**
 * A DEC-specific {@link StatusReport} object to request User Defined Keys (UDK) status.
 * Corresponds to DSR request `CSI ? 25 n`.
 * The terminal is expected to respond with `CSI ? 20 n` (UDKs locked) or `CSI ? 21 n` (UDKs unlocked).
 * @see DSR_UDKStatusDEC
 * @see reportUDKLockedDEC
 * @see reportUDKUnlockedDEC
 */
export const requestUDKStatusDEC: StatusReport = createDecStatusReport(25);

/**
 * ANSI escape sequence `CSI ? 25 n` to request DEC-specific UDK status.
 * This is generated using `deviceStatusReport(requestUDKStatusDEC)`.
 * @see requestUDKStatusDEC
 * @example
 * ```typescript
 * import { DSR_UDKStatusDEC } from "@visulima/ansi";
 *
 * process.stdout.write(DSR_UDKStatusDEC);
 * ```
 */
export const DSR_UDKStatusDEC: string = deviceStatusReport(requestUDKStatusDEC); // CSI ? 25 n

/**
 * ANSI escape sequence `CSI ? 20 n` indicating User Defined Keys (UDKs) are locked (DEC-specific response).
 * Typical response to {@link DSR_UDKStatusDEC}.
 */
export const reportUDKLockedDEC: string = `${CSI}?20n`;

/**
 * ANSI escape sequence `CSI ? 21 n` indicating User Defined Keys (UDKs) are unlocked (DEC-specific response).
 * Typical response to {@link DSR_UDKStatusDEC}.
 */
export const reportUDKUnlockedDEC: string = `${CSI}?21n`;

/**
 * A DEC-specific {@link StatusReport} object to request keyboard language status.
 * This is often related to DECRQPSR (Request Presentation State Report) rather than a simple DSR with 'n'.
 * For the purpose of this module, following the DSR pattern `CSI ? Ps n`.
 * Corresponds to DSR request `CSI ? 26 n`.
 * @see DSR_KeyboardLanguageDEC
 * @see reportKeyboardLanguageDEC
 */
export const requestKeyboardLanguageDEC: StatusReport = createDecStatusReport(26);

/**
 * ANSI escape sequence `CSI ? 26 n` to request DEC-specific keyboard language status.
 * This is generated using `deviceStatusReport(requestKeyboardLanguageDEC)`.
 * Note: Keyboard language reporting is complex and varies; this is a simplified DSR-style request.
 * @see requestKeyboardLanguageDEC
 * @see reportKeyboardLanguageDEC
 * @example
 * ```typescript
 * import { DSR_KeyboardLanguageDEC } from "@visulima/ansi";
 *
 * process.stdout.write(DSR_KeyboardLanguageDEC);
 * ```
 */
export const DSR_KeyboardLanguageDEC: string = deviceStatusReport(requestKeyboardLanguageDEC); // CSI ? 26 n

/**
 * Generates a DEC Keyboard Language Report sequence.
 * This is an example of how a terminal might report its keyboard language.
 * Sequence: `CSI ? Pl ; Pv n` (example format)
 * - `Pl`: Parameter indicating language report (e.g., 27).
 * - `Pv`: Value representing the language code.
 * @param langCode The numeric code representing the keyboard language.
 * @returns The keyboard language report sequence string.
 * @example
 * ```typescript
 * import { reportKeyboardLanguageDEC } from "@visulima/ansi";
 *
 * console.log(reportKeyboardLanguageDEC(1));
 * ```
 */
export const reportKeyboardLanguageDEC: (langCode: number) => string = (langCode: number): string => `${CSI}?27${SEP}${langCode.toString()}n`;
