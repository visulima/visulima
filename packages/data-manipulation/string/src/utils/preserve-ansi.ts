import { ANSI_ESCAPE_LINK, ESCAPES } from "../constants";
import AnsiStateTracker from "./ansi-state-tracker";
import readControlSequence from "./read-control-sequence";
import wrapAnsiHyperlink from "./wrap-ansi-hyperlink";

/**
 * Advances the tracker over every control sequence in one line.
 * @param line The line to scan.
 * @param tracker The tracker to update.
 * @param currentUrl The hyperlink open when the line started.
 * @returns The hyperlink still open when the line ended.
 */
const trackLine = (line: string, tracker: AnsiStateTracker, currentUrl: string | undefined): string | undefined => {
    let activeUrl = currentUrl;
    let index = 0;

    while (index < line.length) {
        if (!ESCAPES.has(line[index] as string)) {
            index += 1;

            continue;
        }

        const sequence = readControlSequence(line, index);

        if (sequence === undefined) {
            // A bare or truncated escape: nothing to track, step over the introducer.
            index += 1;

            continue;
        }

        if (line.startsWith(ANSI_ESCAPE_LINK, index + 1)) {
            const uri = sequence.slice(1 + ANSI_ESCAPE_LINK.length, -1);

            // `ESC ]8;;BEL` with an empty URI closes the hyperlink.
            activeUrl = uri.length === 0 ? undefined : uri;
        } else {
            tracker.processEscape(sequence);
        }

        index += sequence.length;
    }

    return activeUrl;
};

/**
 * Closes the styling active at the end of each wrapped line and reopens it on the next.
 *
 * This is the single place line-boundary styling is handled; the wrap strategies emit plain lines
 * and leave the bookkeeping here. It shares {@link AnsiStateTracker} with the rest of the package,
 * so compound sequences (`\u009B 1;31 m`), 256-colour and truecolour survive a wrap — previously the
 * boundary was matched with a single-parameter pattern that could not see them, and any style it
 * failed to parse was dropped from every continuation line while bleeding past the end of the block.
 * @param rawLines Array of wrapped lines
 * @returns String with preserved ANSI codes
 */
const preserveAnsi = (rawLines: string[]): string => {
    if (rawLines.length === 0) {
        return "";
    }

    if (rawLines.length === 1) {
        return rawLines[0] as string;
    }

    const tracker = new AnsiStateTracker();
    const lastIndex = rawLines.length - 1;

    let result = "";
    let activeUrl: string | undefined;

    for (const [lineIndex, line] of rawLines.entries()) {
        if (lineIndex > 0) {
            // Reopen whatever was still active when the previous line was cut.
            result += tracker.getStartEscapesForAllActiveAttributes();

            if (activeUrl !== undefined) {
                result += wrapAnsiHyperlink(activeUrl);
            }
        }

        result += line;

        activeUrl = trackLine(line, tracker, activeUrl);

        if (lineIndex < lastIndex) {
            // Close before the newline so the styling cannot bleed into whatever a caller draws
            // between the lines (a box border, a gutter, a diff marker).
            if (activeUrl !== undefined) {
                result += wrapAnsiHyperlink("");
            }

            result += tracker.getEndEscapesForAllActiveAttributes();
            result += "\n";
        }
    }

    return result;
};

export default preserveAnsi;
