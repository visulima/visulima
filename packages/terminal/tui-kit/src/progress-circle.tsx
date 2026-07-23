/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { CanvasContext } from "@visulima/tui/canvas";
import { createBrailleGrid } from "@visulima/tui/canvas";
import Box from "@visulima/tui/components/box";
import Canvas from "@visulima/tui/components/canvas";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Color of the filled portion of the ring.
     * @default "cyan"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Format the centered readout. Defaults to a rounded percentage.
     */
    readonly formatValue?: (ratio: number) => string;

    /**
     * Upper bound of the range.
     * @default 100
     */
    readonly max?: number;

    /**
     * Lower bound of the range.
     * @default 0
     */
    readonly min?: number;

    /**
     * Show the readout in the middle of the ring.
     * @default true
     */
    readonly showValue?: boolean;

    /**
     * Diameter of the ring in character rows.
     * @default 8
     */
    readonly size?: number;

    /**
     * Color of the unfilled track behind the ring.
     * @default "gray"
     */
    readonly trackColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Current value, clamped into `[min, max]`.
     */
    readonly value: number;
};

const defaultFormat = (ratio: number): string => `${Math.round(ratio * 100)}%`;

/**
 * A circular progress ring rendered at 2x4 braille sub-cell resolution. The
 * filled arc grows clockwise from the top in proportion to `value`, with an
 * optional centered readout.
 */
export default function ProgressCircle({
    color = "cyan",
    formatValue = defaultFormat,
    max = 100,
    min = 0,
    showValue = true,
    size = 8,
    trackColor = "gray",
    value,
}: Props): ReactElement {
    const range = max - min || 1;
    const ratio = Math.max(0, Math.min(1, (value - min) / range));

    const rows = Math.max(3, size);
    const cols = Math.max(3, Math.round((rows * 4) / 2 / 2));

    return (
        <Box alignItems="center" flexDirection="column">
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    context.clear();

                    const pixelWidth = context.width * 2;
                    const pixelHeight = context.height * 4;
                    const cx = pixelWidth / 2;
                    const cy = pixelHeight / 2;
                    const radius = Math.max(1, Math.min(cx, cy) - 1);

                    const trackGrid = createBrailleGrid(context.width, context.height);
                    const fillGrid = createBrailleGrid(context.width, context.height);

                    const steps = Math.max(64, Math.round(Math.PI * 2 * radius));
                    const filledSteps = Math.round(ratio * steps);

                    for (let step = 0; step < steps; step += 1) {
                        // Clockwise from the top.
                        const angle = (step / steps) * Math.PI * 2 - Math.PI / 2;
                        const px = Math.round(cx + radius * Math.cos(angle));
                        const py = Math.round(cy + radius * Math.sin(angle));

                        (step < filledSteps ? fillGrid : trackGrid).plotPoint(px, py);
                    }

                    trackGrid.flush(context, { color: trackColor });
                    fillGrid.flush(context, { color });
                }}
                height={rows}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[value, min, max, size, color, trackColor]}
                width={cols}
            />
            {showValue
                ? (
                <Box marginTop={-Math.ceil(rows / 2) - 1}>
                    <Text bold color={color}>
                        {formatValue(ratio)}
                    </Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { ProgressCircle };
export type { Props as ProgressCircleProps };
