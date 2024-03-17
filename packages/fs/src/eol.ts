import { platform } from "node:process";

const regDetect = /\r?\n/g;

/** End-of-line character for POSIX platforms such as macOS and Linux. */
export const LF = "\n" as const;

/** End-of-line character for Windows platforms. */
export const CRLF = "\r\n" as const;

/**
 * End-of-line character evaluated for the current platform.
 */
export const EOL: "\n" | "\r\n" = platform === "win32" ? CRLF : LF;

/**
 * Detect the EOL character for string input.
 * Returns null if no newline.
 */
export const detect = (content: string): typeof EOL | null => {
    const d = content.match(regDetect);

    if (!d || d.length === 0) {
        return null;
    }

    const crlf = d.filter((newline) => newline === CRLF).length;
    const lf = d.length - crlf;

    return crlf > lf ? CRLF : LF;
};

/**
 * Format the file to the targeted EOL.
 */
export const format = (content: string, eol: typeof EOL): string => content.replaceAll(regDetect, eol);
