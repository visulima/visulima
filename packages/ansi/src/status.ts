import { CSI, SEP } from "./constants";

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

class AnsiStatusReportImpl implements StatusReport {
    constructor(public readonly reportCode: number) {}

    public readonly isDecReport = false;
}
class DecStatusReportImpl implements StatusReport {
    constructor(public readonly reportCode: number) {}

    public readonly isDecReport = true;
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
 * const report = createAnsiStatusReport(5); // Request for terminal status
 * const sequence = deviceStatusReport(report); // CSI 5 n
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
 * const report = createDecStatusReport(15); // Request for printer status (DEC)
 * const sequence = deviceStatusReport(report); // CSI ? 15 n
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
 * const ansiReport = createAnsiStatusReport(5); // Terminal status
 * const decReport = createDecStatusReport(25); // UDK status
 *
 * console.log(deviceStatusReport(ansiReport)); // Output: "\x1b[5n"
 * console.log(deviceStatusReport(decReport));  // Output: "\x1b[?25n"
 * console.log(deviceStatusReport(ansiReport, decReport)); // Output: "\x1b[?5;25n"
 * ```
 */
export const deviceStatusReport = (...reports: StatusReport[]): string => {
    if (reports.length === 0) {
        // Although the Go version doesn't explicitly handle this, returning empty for no reports seems reasonable.
        // Or, one could argue a DSR without specific parameters is just `CSI n` (which implies a general status request, often cursor position).
        // For now, matching Go's structure which implies parameters are usually given for DSR.
        // If a generic DSR is needed, it would typically be a specific constant like RequestCursorPositionReport.
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
        // Note: The Go code sets `dec = true` if *any* report is DECStatusReport, and prefixes the whole sequence.
        // This implies that mixing ANSI and DEC report types in a single DSR sequence (e.g., CSI 5;?6n) is not standard.
        // Typically, a DSR is either all standard (CSI Ps;Ps n) or all DEC-private (CSI ?Ps;Ps n).
        // The current implementation follows Go's logic of a single prefix if any report is DEC.
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
 * // requestTerminalStatus is a pre-defined StatusReport object
 * console.log(DSR(requestTerminalStatus)); // Output: "\x1b[5n"
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
 * // Terminal expected to respond with e.g., "\x1b[10;5R" if cursor is at line 10, column 5.
 * ```
 */
export const requestCursorPositionReport = `${CSI}6n`;

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
 * // Terminal expected to respond with e.g., "\x1b[?10;5;1R" if cursor is at line 10, column 5, page 1.
 * ```
 */
export const requestExtendedCursorPositionReport = `${CSI}?6n`;

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
 * // Cursor at line 10, column 5
 * console.log(cursorPositionReport(10, 5)); // Output: "\x1b[10;5R"
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
 * console.log(CPR(10, 5)); // Equivalent to cursorPositionReport(10, 5)
 * ```
 */
export const CPR = cursorPositionReport;

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
 * // Cursor at line 10, column 5, page 1
 * console.log(extendedCursorPositionReport(10, 5, 1)); // Output: "\x1b[?10;5;1R"
 *
 * // Cursor at line 10, column 5 (page omitted)
 * console.log(extendedCursorPositionReport(10, 5, 0)); // Output: "\x1b[?10;5R"
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
 * console.log(DECXCPR(10, 5, 1)); // Equivalent to extendedCursorPositionReport(10, 5, 1)
 * ```
 */
export const DECXCPR = extendedCursorPositionReport;

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
 * console.log(reportSequence); // Output: "\x1b[5n"
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
 * // Terminal expected to respond with CSI 0 n (OK) or CSI 3 n (Failure).
 * ```
 */
export const DSR_TerminalStatus = deviceStatusReport(requestTerminalStatus); // CSI 5 n

/**
 * ANSI escape sequence `CSI 0 n` indicating Terminal is OK (Operating Normally).
 * This is a typical response to {@link DSR_TerminalStatus} (`CSI 5 n`) or `deviceStatusReport(requestTerminalStatus)`.
 * @see requestTerminalStatus
 * @see DSR_TerminalStatus
 */
export const reportTerminalOK = `${CSI}0n`;

/**
 * ANSI escape sequence `CSI 3 n` indicating Terminal is NOT OK (Malfunction).
 * This is a typical response to {@link DSR_TerminalStatus} (`CSI 5 n`) or `deviceStatusReport(requestTerminalStatus)`.
 * @see requestTerminalStatus
 * @see DSR_TerminalStatus
 */
export const reportTerminalNotOK = `${CSI}3n`;

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
 * console.log(reportSequence); // Output: "\x1b[?15n"
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
 * // Terminal expected to respond with e.g., CSI ? 10 n (Ready).
 * ```
 */
export const DSR_PrinterStatusDEC = deviceStatusReport(requestPrinterStatusDEC); // CSI ? 15 n

/**
 * ANSI escape sequence `CSI ? 10 n` indicating Printer is Ready (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterReadyDEC = `${CSI}?10n`;

/**
 * ANSI escape sequence `CSI ? 11 n` indicating Printer is Not Ready (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterNotReadyDEC = `${CSI}?11n`;

/**
 * ANSI escape sequence `CSI ? 13 n` indicating Printer has No Paper (DEC-specific response).
 * Typical response to {@link DSR_PrinterStatusDEC} or `deviceStatusReport(requestPrinterStatusDEC)`.
 * @see requestPrinterStatusDEC
 * @see DSR_PrinterStatusDEC
 */
export const reportPrinterNoPaperDEC = `${CSI}?13n`;

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
 * // Terminal expected to respond with e.g., CSI ? 21 n (UDKs unlocked).
 * ```
 */
export const DSR_UDKStatusDEC = deviceStatusReport(requestUDKStatusDEC); // CSI ? 25 n

/**
 * ANSI escape sequence `CSI ? 20 n` indicating User Defined Keys (UDKs) are locked (DEC-specific response).
 * Typical response to {@link DSR_UDKStatusDEC}.
 */
export const reportUDKLockedDEC = `${CSI}?20n`;

/**
 * ANSI escape sequence `CSI ? 21 n` indicating User Defined Keys (UDKs) are unlocked (DEC-specific response).
 * Typical response to {@link DSR_UDKStatusDEC}.
 */
export const reportUDKUnlockedDEC = `${CSI}?21n`;

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
 * // Terminal might respond with a sequence like CSI ? 27 ; 1 n (for US English).
 * ```
 */
export const DSR_KeyboardLanguageDEC = deviceStatusReport(requestKeyboardLanguageDEC); // CSI ? 26 n
// Example response for US English: CSI ? 27 ; 1 n

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
 * // Report US English (hypothetical code 1)
 * console.log(reportKeyboardLanguageDEC(1)); // Output: "\x1b[?27;1n"
 * ```
 */
export const reportKeyboardLanguageDEC = (langCode: number): string => `${CSI}?27${SEP}${langCode.toString()}n`;

/** DSR: Report Data Integrity (DEC specific) */
// This is often DECPRR - Report presentation state reply, CSI ? Pi $ r
// Not typically a 'n' terminated DSR. But if it were, it'd be:
// export const requestDataIntegrityDEC: StatusReport = createDecStatusReport(75);
// export const DSR_DataIntegrityDEC = deviceStatusReport(requestDataIntegrityDEC); // CSI ? 75 n
// Responses: CSI ? 70 n (No errors), CSI ? 7x n (errors)

/** DSR: Report Multi-Session Configuration (DEC specific) */
// DECRQSS - Request Session State, typically OSC sequence, not DSR.

// The Go file only covers the general DSR mechanism and cursor position reports.
// Adding a few common DSRs for completeness but will stick to Go's scope for primary testing.
