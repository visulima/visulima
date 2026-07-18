/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

// A compact three-row "seven-segment" font. Every glyph is three columns wide
// so digits align into a stable readout.
const FONT: Record<string, readonly [string, string, string]> = {
    " ": ["   ", "   ", "   "],
    0: [" ▄ ", "█ █", "▀▄▀"],
    1: [" ▄ ", " █ ", " ▪ "],
    2: ["▄▄ ", " ▄▀", "▀▄▄"],
    3: ["▄▄ ", " ▄▀", "▄▄▀"],
    4: ["   ", "█▄█", "  █"],
    5: ["▄▄▄", "█▄ ", "▄▄▀"],
    6: [" ▄ ", "█▄ ", "▀▄▀"],
    7: ["▄▄▄", "  █", " █ "],
    8: [" ▄ ", "▄▀▄", "▀▄▀"],
    9: [" ▄ ", "▀▄█", " ▄▀"],
    "-": ["   ", " ─ ", "   "],
    ".": ["   ", "   ", " ▪ "],
    ":": ["   ", " ▪ ", " ▪ "],
};

const FALLBACK: readonly [string, string, string] = ["   ", " ? ", "   "];

export type Props = {
    /**
     * Color of the digits.
     * @default "cyan"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Number of spaces between glyphs.
     * @default 1
     */
    readonly gap?: number;

    /**
     * The value to render. Numbers are stringified; unsupported characters
     * render as `?`.
     */
    readonly value: number | string;
};

/**
 * A large seven-segment-style numeric readout. Supports digits, space, minus,
 * dot and colon — enough for counters, clocks and timers.
 */
export default function Digits({ color = "cyan", gap = 1, value }: Props): ReactElement {
    const text = String(value);
    const spacer = " ".repeat(Math.max(0, gap));

    const characters: string[] = [];

    for (const char of text) {
        characters.push(char);
    }

    const lines = [0, 1, 2].map((rowIndex) => characters.map((char) => (FONT[char] ?? FALLBACK)[rowIndex]).join(spacer));

    return (
        <Box flexDirection="column">
            {lines.map((line, index) => (
                // eslint-disable-next-line react-x/no-array-index-key -- row index (0..2) is stable
                <Text color={color} key={index}>
                    {line}
                </Text>
            ))}
        </Box>
    );
}

export { Digits };
export type { Props as DigitsProps };
