/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

type Pixel = LiteralUnion<AnsiColors, string> | undefined;

export type Props = {
    /**
     * Character drawn for a transparent (undefined) pixel; defaults to a space.
     */
    readonly emptyChar?: string;

    /**
     * A row-major grid of colors, one entry per pixel. `undefined` is treated
     * as transparent. Two vertical pixels share one character cell via the
     * upper-half-block technique, so the rendered height is `ceil(rows / 2)`.
     */
    readonly pixels: ReadonlyArray<ReadonlyArray<Pixel>>;
};

const UPPER_HALF = "▀";

/**
 * Render a small pixel grid using the upper-half-block technique: each text
 * cell packs two vertical pixels — the top pixel as the glyph's foreground and
 * the bottom pixel as its background — doubling vertical resolution.
 */
export default function Image({ emptyChar = " ", pixels }: Props): ReactElement {
    let width = 0;

    for (const row of pixels) {
        width = Math.max(width, row.length);
    }

    const cellRows: ReactElement[] = [];

    for (let y = 0; y < pixels.length; y += 2) {
        const top = pixels[y] ?? [];
        const bottom = pixels[y + 1] ?? [];
        const spans: ReactElement[] = [];

        for (let x = 0; x < width; x += 1) {
            const topColor = top[x];
            const bottomColor = bottom[x];

            if (topColor === undefined && bottomColor === undefined) {
                spans.push(

                    <Text key={x}>{emptyChar}</Text>,
                );

                continue;
            }

            spans.push(

                <Text backgroundColor={bottomColor} color={topColor} key={x}>
                    {UPPER_HALF}
                </Text>,
            );
        }

        cellRows.push(

            <Box key={y}>{spans}</Box>,
        );
    }

    return <Box flexDirection="column">{cellRows}</Box>;
}

export { Image };
export type { Props as ImageProps };
