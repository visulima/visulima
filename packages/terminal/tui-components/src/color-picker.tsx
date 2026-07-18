/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

const DEFAULT_PALETTE: ReadonlyArray<Color> = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
    "gray",
    "redBright",
    "greenBright",
    "yellowBright",
    "blueBright",
    "magentaBright",
    "cyanBright",
    "whiteBright",
];

export type Props = {
    /**
     * Accent color for the focused-cell outline.
     * @default "blue"
     */
    readonly accentColor?: Color;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Number of swatches per row.
     * @default 8
     */
    readonly columns?: number;

    /**
     * Selected color when uncontrolled.
     */
    readonly defaultValue?: Color;

    /**
     * Disable input and dim the grid.
     */
    readonly isDisabled?: boolean;

    /**
     * Fires when the highlighted swatch changes.
     */
    readonly onChange?: (color: Color) => void;

    /**
     * Fires on Enter with the highlighted swatch.
     */
    readonly onSubmit?: (color: Color) => void;

    /**
     * Colors to offer. Defaults to the 16 standard ANSI colors.
     */
    readonly palette?: ReadonlyArray<Color>;

    /**
     * Render the highlighted color's name beneath the grid.
     * @default true
     */
    readonly showName?: boolean;

    /**
     * The two-cell glyph filled with each palette color (default `"██"`).
     */
    readonly swatch?: string;

    /**
     * Controlled selected color. When provided, `defaultValue` is ignored.
     */
    readonly value?: Color;
};

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

/**
 * A grid of color swatches. Arrow keys move the highlight, Enter selects. The
 * highlighted swatch's name is shown below the grid by default.
 */
export default function ColorPicker({
    accentColor = "blue",
    autoFocus = false,
    columns = 8,
    defaultValue,
    isDisabled = false,
    onChange,
    onSubmit,
    palette = DEFAULT_PALETTE,
    showName = true,
    swatch = "██",
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;
    // Guard against columns <= 0, which would never advance the row loop.
    const columnCount = Math.max(1, columns);

    const startIndex = Math.max(0, palette.indexOf((controlledValue ?? defaultValue) as Color));
    const [cursor, setCursor] = useState(startIndex);

    const effectiveCursor = isControlled ? Math.max(0, palette.indexOf(controlledValue)) : cursor;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const move = useCallback(
        (delta: number) => {
            if (palette.length === 0) {
                return;
            }

            const next = wrap(effectiveCursor + delta, palette.length);

            if (!isControlled) {
                setCursor(next);
            }

            onChangeRef.current?.(palette[next]!);
        },
        [effectiveCursor, isControlled, palette],
    );

    const inputHandler = useCallback(
        (_input: string, key: { downArrow: boolean; leftArrow: boolean; return: boolean; rightArrow: boolean; upArrow: boolean }) => {
            if (key.leftArrow) {
                move(-1);
            } else if (key.rightArrow) {
                move(1);
            } else if (key.upArrow) {
                move(-columnCount);
            } else if (key.downArrow) {
                move(columnCount);
            } else if (key.return) {
                onSubmit?.(palette[effectiveCursor]!);
            }
        },
        [columnCount, effectiveCursor, move, onSubmit, palette],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    const rows: Color[][] = [];

    for (let index = 0; index < palette.length; index += columnCount) {
        rows.push(palette.slice(index, index + columnCount));
    }

    return (
        <Box flexDirection="column">
            {rows.map((row, rowIndex) => (
                // eslint-disable-next-line react-x/no-array-index-key -- row index is stable for the render
                <Box key={rowIndex}>
                    {row.map((color, columnIndex) => {
                        const index = rowIndex * columnCount + columnIndex;
                        const isActive = isFocused && index === effectiveCursor;

                        return (
                            // eslint-disable-next-line react-x/no-array-index-key -- cell index is stable for the render
                            <Box key={columnIndex}>
                                <Text color={isActive ? accentColor : undefined}>{isActive ? "[" : " "}</Text>
                                <Text color={color} dimColor={isDisabled}>
                                    {swatch}
                                </Text>
                                <Text color={isActive ? accentColor : undefined}>{isActive ? "]" : " "}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}
            {showName
                ? (
                <Box marginTop={1}>
                    <Text dimColor>{String(palette[effectiveCursor] ?? "")}</Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { ColorPicker };
export type { Props as ColorPickerProps };
