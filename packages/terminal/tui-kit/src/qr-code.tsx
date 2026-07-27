/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

export type Props = {
    /**
     * Color of the "dark" modules.
     * @default "black"
     */
    readonly darkColor?: Color;

    /**
     * Color of the "light" modules and quiet zone.
     * @default "white"
     */
    readonly lightColor?: Color;

    /**
     * A pre-encoded square grid of modules (`true` = dark). Provide this to
     * render without the optional `qrcode` peer; it takes precedence over
     * `value`.
     */
    readonly matrix?: ReadonlyArray<ReadonlyArray<boolean>>;

    /**
     * Width of the light border around the code, in modules.
     * @default 2
     */
    readonly quietZone?: number;

    /**
     * A string to encode. Requires the optional `qrcode` peer dependency; when
     * absent, provide `matrix` instead.
     */
    readonly value?: string;
};

const UPPER_HALF = "▀";

/** Pad a module matrix with a light quiet zone on all sides. */
const withQuietZone = (matrix: ReadonlyArray<ReadonlyArray<boolean>>, zone: number): boolean[][] => {
    if (zone <= 0) {
        return matrix.map((row) => [...row]);
    }

    let maxWidth = 0;

    for (const row of matrix) {
        maxWidth = Math.max(maxWidth, row.length);
    }

    const width = maxWidth + zone * 2;
    const blankRow = (): boolean[] => {
        const row: boolean[] = [];

        for (let index = 0; index < width; index += 1) {
            row.push(false);
        }

        return row;
    };
    const out: boolean[][] = [];

    for (let index = 0; index < zone; index += 1) {
        out.push(blankRow());
    }

    for (const row of matrix) {
        const padded = blankRow();

        row.forEach((cell, index) => {
            padded[index + zone] = cell;
        });

        out.push(padded);
    }

    for (let index = 0; index < zone; index += 1) {
        out.push(blankRow());
    }

    return out;
};

/**
 * Render a QR code from a module matrix using the upper-half-block technique,
 * so two module rows share one character row. Pass `matrix` for a self-contained
 * render, or `value` to encode a string via the optional `qrcode` peer.
 */
export default function QrCode({ darkColor = "black", lightColor = "white", matrix, quietZone = 2, value }: Props): ReactElement {
    const [encoded, setEncoded] = useState<ReadonlyArray<ReadonlyArray<boolean>> | undefined>(undefined);

    useEffect(() => {
        if (matrix !== undefined || value === undefined) {
            return undefined;
        }

        let cancelled = false;

        const encode = async (): Promise<void> => {
            try {
                // Optional peer — only needed for the string-encoding path.
                const qrcode = (await import("qrcode")) as unknown as {
                    create: (text: string) => { modules: { data: Uint8Array | number[]; size: number } };
                };
                const { modules } = qrcode.create(value);
                const grid: boolean[][] = [];

                for (let y = 0; y < modules.size; y += 1) {
                    const row: boolean[] = [];

                    for (let x = 0; x < modules.size; x += 1) {
                        row.push(Boolean(modules.data[y * modules.size + x]));
                    }

                    grid.push(row);
                }

                if (!cancelled) {
                    setEncoded(grid);
                }
            } catch {
                // qrcode not installed — nothing to render from `value`.
            }
        };

        // eslint-disable-next-line react-you-might-not-need-an-effect/no-external-store-subscription -- lazily loads the optional `qrcode` peer, not a subscribable store
        encode().catch(() => {
            // Swallow: the string-encoding path is best-effort.
        });

        return () => {
            cancelled = true;
        };
    }, [matrix, value]);

    const source = matrix ?? encoded;
    const padded = useMemo(() => {
        if (source === undefined) {
            return undefined;
        }

        return withQuietZone(source, quietZone);
    }, [quietZone, source]);

    if (padded === undefined) {
        return (
            <Box>
                <Text dimColor>{value === undefined ? "" : "Encoding…"}</Text>
            </Box>
        );
    }

    const rows: ReactElement[] = [];

    for (let y = 0; y < padded.length; y += 2) {
        const top = padded[y] ?? [];
        const bottom = padded[y + 1] ?? [];
        const spans: ReactElement[] = [];

        for (const [x, element] of top.entries()) {
            spans.push(

                <Text backgroundColor={bottom[x] ? darkColor : lightColor} color={element ? darkColor : lightColor} key={x}>
                    {UPPER_HALF}
                </Text>,
            );
        }

        rows.push(

            <Box key={y}>{spans}</Box>,
        );
    }

    return <Box flexDirection="column">{rows}</Box>;
}

export { QrCode };
export type { Props as QrCodeProps };
