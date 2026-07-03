/* eslint-disable @typescript-eslint/no-use-before-define, e18e/prefer-static-regex, jsdoc/lines-before-block, no-await-in-loop, unicorn/no-null */
/**
 * Terminal palette auto-detection via OSC escape sequences.
 *
 * Queries the terminal for its current 16-color palette, foreground,
 * background, and cursor colors using OSC 4/10/11/12 sequences.
 * @see https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands
 */
import type { Writable } from "node:stream";

const BEL = "\u0007";
const OSC = "\u001B]";

export type TerminalPalette = {
    readonly background: string;
    readonly colors: ReadonlyArray<string>;
    readonly cursor: string;
    readonly foreground: string;
};

/**
 * Parse an OSC color response like `rgb:RRRR/GGGG/BBBB` to a hex string.
 * Terminal color responses use 16-bit values per channel; we extract the top 8 bits.
 */
const parseOscColorResponse = (response: string): string | null => {
    const match = /rgb:([\da-f]{2,4})\/([\da-f]{2,4})\/([\da-f]{2,4})/i.exec(response);

    if (!match) {
        return null;
    }

    const toHex = (value: string): string => {
        if (value.length <= 2) {
            return value.padStart(2, "0");
        }

        return value.slice(0, 2);
    };

    return `#${toHex(match[1]!)}${toHex(match[2]!)}${toHex(match[3]!)}`;
};

/**
 * Check if the terminal likely supports OSC palette queries.
 */
export const isTerminalPaletteQuerySupported = (): boolean => {
    const termProgram = process.env["TERM_PROGRAM"] ?? "";
    const supported = new Set(["Alacritty", "contour", "foot", "Ghostty", "iTerm2", "iTerm.app", "kitty", "rio", "WezTerm"]);

    if (supported.has(termProgram)) {
        return true;
    }

    const term = process.env["TERM"] ?? "";

    return term.startsWith("xterm") || Boolean(process.env["WT_SESSION"]);
};

/**
 * Send an OSC query and wait for the terminal's response.
 */
const MAX_RESPONSE_BYTES = 256;

const queryOsc = (stdin: NodeJS.ReadableStream, stdout: Writable, sequence: string, timeout = 500): Promise<string | null> =>
    new Promise((resolve) => {
        let buffer = "";
        let timer: ReturnType<typeof setTimeout> | undefined;

        const cleanup = () => {
            if (timer) {
                clearTimeout(timer);
            }

            stdin.removeListener("data", onData);
        };

        const onData = (data: Buffer | string) => {
            buffer += data.toString();

            // Guard against unbounded accumulation from misbehaving terminals
            if (buffer.length > MAX_RESPONSE_BYTES) {
                cleanup();
                resolve(null);

                return;
            }

            if (buffer.includes(BEL) || buffer.includes("\u001B\\")) {
                cleanup();
                resolve(buffer);
            }
        };

        timer = setTimeout(() => {
            cleanup();
            resolve(null);
        }, timeout);

        stdin.on("data", onData);
        stdout.write(sequence);
    });

/**
 * Query the terminal for its current color palette.
 * @param stdin Readable stream (typically process.stdin in raw mode)
 * @param stdout Writable stream (typically process.stdout)
 * @param timeout Per-query timeout in milliseconds (default: 500)
 */
export const queryTerminalPalette = async (stdin: NodeJS.ReadableStream, stdout: Writable, timeout = 500): Promise<Partial<TerminalPalette>> => {
    const result: Partial<{ background: string; colors: string[]; cursor: string; foreground: string }> = {};

    const fgResponse = await queryOsc(stdin, stdout, `${OSC}10;?${BEL}`, timeout);

    if (fgResponse) {
        const fg = parseOscColorResponse(fgResponse);

        if (fg) {
            result.foreground = fg;
        }
    }

    const bgResponse = await queryOsc(stdin, stdout, `${OSC}11;?${BEL}`, timeout);

    if (bgResponse) {
        const bg = parseOscColorResponse(bgResponse);

        if (bg) {
            result.background = bg;
        }
    }

    const cursorResponse = await queryOsc(stdin, stdout, `${OSC}12;?${BEL}`, timeout);

    if (cursorResponse) {
        const cursor = parseOscColorResponse(cursorResponse);

        if (cursor) {
            result.cursor = cursor;
        }
    }

    const colors: string[] = [];

    for (let index = 0; index < 16; index++) {
        const colorResponse = await queryOsc(stdin, stdout, `${OSC}4;${index};?${BEL}`, timeout);

        if (colorResponse) {
            const color = parseOscColorResponse(colorResponse);

            colors.push(color ?? "");
        } else {
            colors.push("");
        }
    }

    if (colors.some((c) => c.length > 0)) {
        result.colors = colors;
    }

    return result;
};
